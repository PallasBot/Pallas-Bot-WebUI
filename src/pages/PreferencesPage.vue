<script setup lang="ts">
import { onActivated, onMounted, ref, watch, computed } from "vue";
import { RouterLink } from "vue-router";
import { useRoute } from "vue-router";
import { changeConsoleLogin } from "@/api/consoleApi";
import ConsoleDevModePanel from "@/components/ConsoleDevModePanel.vue";
import PageChrome from "@/components/PageChrome.vue";
import PrefsGlassPreview from "@/components/PrefsGlassPreview.vue";
import PrefsSettingCard from "@/components/PrefsSettingCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSwitch from "@/components/ui/UiSwitch.vue";
import { consolePrefs, setConsolePrefs, CONTROL_RADIUS_MIN, CONTROL_RADIUS_MAX } from "@/utils/consolePrefs";
import { ACCENT_PRESET_OPTIONS } from "@/config/accentPresets";
import type { AccentPreset, DensityMode, RadiusMode, SurfaceStyle, ThemeMode, UiPreset } from "@/utils/consolePrefs";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import { consoleSetupStatus, loadConsoleSetupStatus } from "@/state/consoleSetup";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";
import { consoleMetaHealth, patchWebuiDevMode } from "@/state/consoleMeta";
import { boolSwitchLabel } from "@/utils/configFieldDisplay";

const route = useRoute();
const panelNavIcon = usePanelNavIcon();

const webuiDevModeActive = computed(() =>
  Boolean(consoleMetaHealth.value?.console?.pallas_webui_dev_mode),
);

const glassSurfaceOn = computed({
  get: () => consolePrefs.surfaceStyle === "glass",
  set(v: boolean) {
    setSurfaceStyle(v ? "glass" : "solid");
  },
});

const compactDensityOn = computed({
  get: () => consolePrefs.density === "compact",
  set(v: boolean) {
    setDensity(v ? "compact" : "comfortable");
  },
});

function onWebuiDevModeUpdated(active: boolean) {
  patchWebuiDevMode(active);
}

function setTheme(v: ThemeMode) {
  setConsolePrefs({ theme: v });
}
function setRadius(v: RadiusMode) {
  setConsolePrefs({ radius: v });
}
function setControlRadius(v: number) {
  setConsolePrefs({ controlRadius: v });
}
function setSurfaceStyle(v: SurfaceStyle) {
  setConsolePrefs({ surfaceStyle: v });
}
function setGlassBlur(v: number) {
  setConsolePrefs({ glassBlur: Math.min(40, Math.max(8, Math.round(v))) });
}
function setCardGlassOpacity(v: number) {
  setConsolePrefs({ cardGlassOpacity: Math.min(0.72, Math.max(0.12, v)) });
}

const glassBlurDraft = ref(consolePrefs.glassBlur);
const cardGlassOpacityDraft = ref(consolePrefs.cardGlassOpacity);
const controlRadiusDraft = ref(consolePrefs.controlRadius);

watch(
  () => consolePrefs.glassBlur,
  (v) => {
    glassBlurDraft.value = v;
  },
);
watch(
  () => consolePrefs.cardGlassOpacity,
  (v) => {
    cardGlassOpacityDraft.value = v;
  },
);
watch(
  () => consolePrefs.controlRadius,
  (v) => {
    controlRadiusDraft.value = v;
  },
);

function onGlassBlurInput(v: number) {
  glassBlurDraft.value = Math.min(40, Math.max(8, Math.round(v)));
}

function onGlassBlurCommit() {
  setGlassBlur(glassBlurDraft.value);
}

function onCardGlassOpacityInput(v: number) {
  cardGlassOpacityDraft.value = Math.min(0.72, Math.max(0.12, v));
}

function onCardGlassOpacityCommit() {
  setCardGlassOpacity(cardGlassOpacityDraft.value);
}

/** 拖动即写入 prefs 并热更新 CSS 变量 */
function onControlRadiusInput(v: number) {
  const next = Math.min(CONTROL_RADIUS_MAX, Math.max(CONTROL_RADIUS_MIN, Math.round(v)));
  controlRadiusDraft.value = next;
  setControlRadius(next);
}
function setDensity(v: DensityMode) {
  setConsolePrefs({ density: v });
}
function setAccentPreset(v: AccentPreset) {
  setConsolePrefs({ accentPreset: v });
}
function setUiPreset(v: UiPreset) {
  setConsolePrefs({ uiPreset: v });
}

const pwdErr = ref("");
const pwdOk = ref("");
const p1 = ref("");
const p2 = ref("");
const pwdBusy = ref(false);

async function submitPassword() {
  pwdErr.value = "";
  pwdOk.value = "";
  if (p1.value.length < 8) {
    pwdErr.value = "新口令至少 8 位。";
    return;
  }
  if (p1.value !== p2.value) {
    pwdErr.value = "两次输入不一致。";
    return;
  }
  pwdBusy.value = true;
  try {
    const r = await changeConsoleLogin(p1.value);
    pwdOk.value = r.message || "已更新。";
    toastSaveSuccess("控制台口令已更新");
    p1.value = "";
    p2.value = "";
    await loadSetupStatus(true);
  } catch (e) {
    pwdErr.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "更新失败");
  } finally {
    pwdBusy.value = false;
  }
}

useSaveHotkey(() => !pwdBusy.value, () => submitPassword());

onMounted(() => {
  scrollToPasswordIfNeeded();
  void loadSetupStatus();
});

onActivated(() => {
  scrollToPasswordIfNeeded();
  void loadSetupStatus();
});

watch(
  () => route.hash,
  () => {
    scrollToPasswordIfNeeded();
  },
);

function scrollToPasswordIfNeeded() {
  if (route.hash === "#console-password") {
    requestAnimationFrame(() => {
      document.getElementById("console-password")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

async function loadSetupStatus(force = false) {
  await loadConsoleSetupStatus({ force });
}
</script>

<template>
  <div class="console-hub-page prefs-page">
    <PageChrome
      :icon="panelNavIcon"
      title="偏好与口令"
      lead="自定义控制台外观与安全设置。"
    />

    <div
      v-if="consoleSetupStatus?.requires_setup"
      class="alert alert--warn"
    >
      当前仍处于首次引导阶段，请先完成控制台口令改密。
      <span v-if="consoleSetupStatus.default_password_active">默认口令仍有效，生产环境请勿继续保留。</span>
      <RouterLink to="/setup" class="prefs-page__setup-link">打开 Setup Wizard</RouterLink>
    </div>

    <div class="prefs-page__grid">
      <PrefsSettingCard
        icon="sun"
        title="颜色模式"
        lead="切换深色、浅色或跟随系统。"
      >
        <div class="prefs-segment prefs-segment--fill">
          <button
            type="button"
            class="prefs-segment__btn"
            :class="{ 'prefs-segment__btn--active': consolePrefs.theme === 'light' }"
            @click="setTheme('light')"
          >
            浅色
          </button>
          <button
            type="button"
            class="prefs-segment__btn"
            :class="{ 'prefs-segment__btn--active': consolePrefs.theme === 'dark' }"
            @click="setTheme('dark')"
          >
            深色
          </button>
          <button
            type="button"
            class="prefs-segment__btn"
            :class="{ 'prefs-segment__btn--active': consolePrefs.theme === 'system' }"
            @click="setTheme('system')"
          >
            跟随系统
          </button>
        </div>
      </PrefsSettingCard>

      <PrefsSettingCard
        icon="sparkles"
        title="配色风格"
        lead="彩色模式可换主题色，毛玻璃会透出对应色调；黑白模式为纯灰阶，与主题色无关。"
      >
        <div class="prefs-segment prefs-segment--fill">
          <button
            type="button"
            class="prefs-segment__btn"
            :class="{ 'prefs-segment__btn--active': consolePrefs.uiPreset === 'gs' }"
            @click="setUiPreset('gs')"
          >
            彩色
          </button>
          <button
            type="button"
            class="prefs-segment__btn"
            :class="{ 'prefs-segment__btn--active': consolePrefs.uiPreset === 'shadcn' }"
            @click="setUiPreset('shadcn')"
          >
            黑白
          </button>
        </div>
      </PrefsSettingCard>

      <PrefsSettingCard
        icon="layout"
        title="界面风格"
        lead="毛玻璃更有层次，纯色更省资源。"
      >
        <div class="prefs-switch-row">
          <span class="prefs-switch-row__label">毛玻璃效果</span>
          <UiSwitch
            v-model="glassSurfaceOn"
            :label="boolSwitchLabel(glassSurfaceOn)"
            show-label
          />
        </div>
      </PrefsSettingCard>

      <PrefsSettingCard
        icon="terminal"
        title="开发模式"
        lead="联调时可跳过控制台登录与 API token；生产环境务必关闭。"
      >
        <ConsoleDevModePanel
          :active="webuiDevModeActive"
          :show-banner="false"
          toolbar
          @updated="onWebuiDevModeUpdated"
        />
      </PrefsSettingCard>

      <PrefsSettingCard
        v-if="consolePrefs.surfaceStyle === 'glass'"
        icon="sliders"
        title="模糊强度"
        lead="调节背景模糊半径；数值越大越朦胧，饱和度会随强度略增。"
      >
        <PrefsGlassPreview
          label="拖动滑块查看模糊变化"
          :blur="glassBlurDraft"
          :opacity="cardGlassOpacityDraft"
        />
        <div class="prefs-form-field prefs-form-field--range">
          <label class="prefs-form-field__label">模糊半径 {{ glassBlurDraft }}px</label>
          <input
            class="inp"
            type="range"
            min="8"
            max="40"
            step="1"
            :value="glassBlurDraft"
            @input="onGlassBlurInput(Number(($event.target as HTMLInputElement).value))"
            @change="onGlassBlurCommit"
          >
        </div>
      </PrefsSettingCard>

      <PrefsSettingCard
        v-if="consolePrefs.surfaceStyle === 'glass'"
        icon="layers"
        title="卡片不透明度"
        lead="调节毛玻璃面板底色浓度；数值越低越透、模糊越明显。"
      >
        <PrefsGlassPreview
          label="拖动滑块查看透明度变化"
          :blur="glassBlurDraft"
          :opacity="cardGlassOpacityDraft"
        />
        <div class="prefs-form-field prefs-form-field--range">
          <label class="prefs-form-field__label">不透明度 {{ Math.round(cardGlassOpacityDraft * 100) }}%</label>
          <input
            class="inp"
            type="range"
            min="12"
            max="72"
            step="1"
            :value="Math.round(cardGlassOpacityDraft * 100)"
            @input="onCardGlassOpacityInput(Number(($event.target as HTMLInputElement).value) / 100)"
            @change="onCardGlassOpacityCommit"
          >
        </div>
      </PrefsSettingCard>

      <PrefsSettingCard
        v-if="consolePrefs.uiPreset === 'gs'"
        icon="palette"
        title="主题色"
        lead="影响按钮、链接与选中高亮。"
      >
        <div class="prefs-accent-row">
          <button
            v-for="opt in ACCENT_PRESET_OPTIONS"
            :key="opt.id"
            type="button"
            class="prefs-accent-swatch"
            :class="{ 'prefs-accent-swatch--on': consolePrefs.accentPreset === opt.id }"
            :aria-label="opt.label"
            :aria-pressed="consolePrefs.accentPreset === opt.id"
            @click="setAccentPreset(opt.id)"
          >
            <span
              class="prefs-accent-swatch__dot"
              :style="{ background: opt.swatch }"
            >
              <span
                v-if="consolePrefs.accentPreset === opt.id"
                class="prefs-accent-swatch__check"
                aria-hidden="true"
              >✓</span>
            </span>
            <span class="prefs-accent-swatch__label">{{ opt.label }}</span>
          </button>
        </div>
      </PrefsSettingCard>

      <PrefsSettingCard
        icon="square"
        title="圆角风格"
        lead="滑块调节按钮与输入框圆角；分段为快捷预设。开关与 Chip 保持胶囊，不受滑块影响。"
      >
        <div class="prefs-segment prefs-segment--fill">
          <button
            type="button"
            class="prefs-segment__btn"
            :class="{ 'prefs-segment__btn--active': consolePrefs.radius === 'tight' }"
            @click="setRadius('tight')"
          >
            紧凑
          </button>
          <button
            type="button"
            class="prefs-segment__btn"
            :class="{ 'prefs-segment__btn--active': consolePrefs.radius === 'default' }"
            @click="setRadius('default')"
          >
            默认
          </button>
          <button
            type="button"
            class="prefs-segment__btn"
            :class="{ 'prefs-segment__btn--active': consolePrefs.radius === 'round' }"
            @click="setRadius('round')"
          >
            更圆
          </button>
        </div>
        <div class="prefs-form-field prefs-form-field--range">
          <label class="prefs-form-field__label">控件圆角 {{ controlRadiusDraft }}px</label>
          <input
            class="inp"
            type="range"
            :min="CONTROL_RADIUS_MIN"
            :max="CONTROL_RADIUS_MAX"
            step="1"
            :value="controlRadiusDraft"
            @input="onControlRadiusInput(Number(($event.target as HTMLInputElement).value))"
          >
        </div>
      </PrefsSettingCard>

      <PrefsSettingCard
        icon="layers"
        title="内容密度"
        lead="紧凑模式缩小间距与控件高度。"
      >
        <div class="prefs-switch-row">
          <span class="prefs-switch-row__label">紧凑布局</span>
          <UiSwitch
            v-model="compactDensityOn"
            :label="boolSwitchLabel(compactDensityOn)"
            show-label
          />
        </div>
      </PrefsSettingCard>

      <PrefsSettingCard
        card-id="console-password"
        icon="lock"
        title="控制台口令"
        lead="用于登录 WebUI，至少 8 位。"
        wide
      >
        <div
          v-if="pwdErr"
          class="alert alert--err"
          style="margin-bottom: 12px"
        >
          {{ pwdErr }}
        </div>
        <div
          v-if="pwdOk"
          class="alert alert--ok"
          style="margin-bottom: 12px"
        >
          {{ pwdOk }}
        </div>
        <div class="prefs-form-field">
          <label class="prefs-form-field__label">新口令</label>
          <UiInput
            v-model="p1"
            type="password"
            revealable
            autocomplete="new-password"
          />
        </div>
        <div class="prefs-form-field">
          <label class="prefs-form-field__label">确认口令</label>
          <UiInput
            v-model="p2"
            type="password"
            revealable
            autocomplete="new-password"
          />
        </div>
        <UiButton
          variant="primary"
          :disabled="pwdBusy"
          @click="submitPassword"
        >
          {{ pwdBusy ? "提交中…" : "保存口令" }}
        </UiButton>
      </PrefsSettingCard>
    </div>
  </div>
</template>
