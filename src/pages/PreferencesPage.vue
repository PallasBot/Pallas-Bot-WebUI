<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { changeConsoleLogin } from "@/api/consoleApi";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
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

const sidebarSectionDraft = ref("");

function formatSidebarSectionMap(map: Record<string, string>): string {
  const entries = Object.entries(map).filter(([k, v]) => k.trim() && v.trim());
  entries.sort(([a], [b]) => a.localeCompare(b, "zh-CN"));
  return entries.map(([k, v]) => `${k}=${v}`).join("\n");
}

function syncSidebarSectionDraft() {
  sidebarSectionDraft.value = formatSidebarSectionMap(consolePrefs.sidebarNavSectionByToken);
}

function applySidebarSectionDraft() {
  const out: Record<string, string> = {};
  for (const line of sidebarSectionDraft.value.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (key && val) out[key] = val;
  }
  setConsolePrefs({ sidebarNavSectionByToken: out });
  syncSidebarSectionDraft();
}

function clearSidebarSectionOverrides() {
  setConsolePrefs({ sidebarNavSectionByToken: {} });
  sidebarSectionDraft.value = "";
}

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
  syncSidebarSectionDraft();
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
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>侧栏
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/preferences" />
        </div>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0 0 12px; line-height: 1.55">
          可在侧栏拖动排序、移除项。未显示在侧栏中的入口会归在侧栏底部的「未在侧栏」里；在任意设置卡片的标题栏点「+」也可把当前页面对应的侧栏项或子区块加回。若误删导致只剩一项，仍可继续操作；侧栏过空时可点下方恢复默认。
        </p>
        <button
          type="button"
          class="btn btn--primary"
          @click="resetSidebarNavToDefaults"
        >
          恢复侧栏默认顺序与项目
        </button>
        <details style="margin-top: 14px">
          <summary
            class="muted"
            style="cursor: pointer; font-weight: 650; user-select: none"
          >自定义侧栏分组标题</summary>
          <p
            class="muted"
            style="margin: 10px 0 8px; line-height: 1.55; font-size: 13px"
          >
            每行一条 <code>token=分组名</code>：token 为主导航路径（如 <code>/logs</code>）或固定项（如 <code>pin:bot-social-groups</code>）。相邻且分组名相同的项在侧栏中会归为一组；未写到的 token 仍用内置分组。
          </p>
          <textarea
            v-model="sidebarSectionDraft"
            class="inp"
            rows="7"
            spellcheck="false"
            aria-label="侧栏分组映射"
            style="width: 100%; max-width: 100%; box-sizing: border-box; font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.45; min-height: 120px"
          />
          <div
            class="row-actions"
            style="margin-top: 10px"
          >
            <button
              type="button"
              class="btn btn--primary"
              @click="applySidebarSectionDraft"
            >
              保存分组
            </button>
            <button
              type="button"
              class="btn"
              @click="clearSidebarSectionOverrides"
            >
              清除自定义分组
            </button>
          </div>
        </details>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>颜色模式
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/preferences" />
        </div>
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
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>圆角风格
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/preferences" />
        </div>
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
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>内容密度
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/preferences" />
        </div>
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
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>控制台口令
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/preferences" />
        </div>
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
