<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { changeConsoleLogin } from "@/api/consoleApi";
import { consolePrefs, resetSidebarNavToDefaults, setConsolePrefs } from "@/utils/consolePrefs";
import type { DensityMode, RadiusMode, ThemeMode } from "@/utils/consolePrefs";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const route = useRoute();
const panelNavIcon = usePanelNavIcon();

function setTheme(v: ThemeMode) {
  setConsolePrefs({ theme: v });
}
function setRadius(v: RadiusMode) {
  setConsolePrefs({ radius: v });
}
function setDensity(v: DensityMode) {
  setConsolePrefs({ density: v });
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
    p1.value = "";
    p2.value = "";
  } catch (e) {
    pwdErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    pwdBusy.value = false;
  }
}

onMounted(() => {
  scrollToPasswordIfNeeded();
});

watch(
  () => route.hash,
  () => {
    scrollToPasswordIfNeeded();
  },
);

function scrollToPasswordIfNeeded() {
  if (route.hash !== "#console-password") return;
  requestAnimationFrame(() => {
    document.getElementById("console-password")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
</script>

<template>
  <div>
    <div
      id="sidebar-prefs"
      class="panel"
    >
      <div class="panel__hd">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>侧栏
        </h2>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0 0 12px; line-height: 1.55">
          可在侧栏拖动排序、移除项，或通过「添加快捷入口」把颗粒配置中的群列表等固定到侧栏。若误删导致只剩一项，仍可继续操作；若侧栏过空，请点下方恢复默认。
        </p>
        <button
          type="button"
          class="btn btn--primary"
          @click="resetSidebarNavToDefaults"
        >
          恢复侧栏默认顺序与项目
        </button>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>颜色模式
        </h2>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0 0 12px">「跟随系统」会监听系统深色 / 浅色切换。</p>
        <div class="row-actions">
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.theme === 'dark' }"
            @click="setTheme('dark')"
          >
            深色
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.theme === 'light' }"
            @click="setTheme('light')"
          >
            浅色
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.theme === 'system' }"
            @click="setTheme('system')"
          >
            跟随系统
          </button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>圆角风格
        </h2>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0 0 12px">影响卡片、面板、按钮与下拉框等控件的圆角。</p>
        <div class="row-actions">
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.radius === 'tight' }"
            @click="setRadius('tight')"
          >
            紧凑
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.radius === 'default' }"
            @click="setRadius('default')"
          >
            默认
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.radius === 'round' }"
            @click="setRadius('round')"
          >
            更圆
          </button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>内容密度
        </h2>
      </div>
      <div class="panel__bd">
        <div class="row-actions">
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.density === 'comfortable' }"
            @click="setDensity('comfortable')"
          >
            舒适
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.density === 'compact' }"
            @click="setDensity('compact')"
          >
            紧凑
          </button>
        </div>
      </div>
    </div>

    <div
      id="console-password"
      class="panel"
    >
      <div class="panel__hd">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>控制台口令
        </h2>
      </div>
      <div class="panel__bd">
        <div
          v-if="pwdErr"
          class="alert alert--err"
        >
          {{ pwdErr }}
        </div>
        <div
          v-if="pwdOk"
          class="alert alert--ok"
        >
          {{ pwdOk }}
        </div>
        <div style="margin-bottom: 14px">
          <label class="muted" style="display: block; margin-bottom: 6px">新口令</label>
          <input
            v-model="p1"
            class="inp"
            type="password"
            autocomplete="new-password"
            style="max-width: 400px; width: 100%"
          >
        </div>
        <div style="margin-bottom: 18px">
          <label class="muted" style="display: block; margin-bottom: 6px">确认</label>
          <input
            v-model="p2"
            class="inp"
            type="password"
            autocomplete="new-password"
            style="max-width: 400px; width: 100%"
          >
        </div>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="pwdBusy"
          @click="submitPassword"
        >
          {{ pwdBusy ? "提交中…" : "保存" }}
        </button>
      </div>
    </div>
  </div>
</template>
