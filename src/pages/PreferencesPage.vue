<script setup lang="ts">
import { computed, onActivated, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { changeConsoleLogin } from "@/api/consoleApi";
import { MAIN_NAV_ITEMS } from "@/config/mainNav";
import { SIDEBAR_PIN_DEFINITIONS, sidebarPinToken } from "@/config/sidebarPins";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import { consolePrefs, resetSidebarNavToDefaults, setConsolePrefs } from "@/utils/consolePrefs";
import type { DensityMode, RadiusMode, ThemeMode } from "@/utils/consolePrefs";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { useSidebarNavLists } from "@/composables/useSidebarNavLists";
import {
  addNavTokenToSidebar,
  moveNavTokenInOrder,
  removeNavTokenFromSidebar,
} from "@/utils/sidebarNavActions";

const route = useRoute();
const panelNavIcon = usePanelNavIcon();

const { sidebarNavRows, sidebarPoolRows } = useSidebarNavLists();

function navOrderIndex(token: string): number {
  return consolePrefs.sidebarNavOrder.indexOf(token);
}

function canMoveNavUp(token: string): boolean {
  return navOrderIndex(token) > 0;
}

function canMoveNavDown(token: string): boolean {
  const i = navOrderIndex(token);
  return i >= 0 && i < consolePrefs.sidebarNavOrder.length - 1;
}

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

type SidebarSectionRow = {
  token: string;
  title: string;
  pathHint: string;
  defaultSection: string;
};

const sidebarSectionRows = computed((): SidebarSectionRow[] => {
  const mains: SidebarSectionRow[] = MAIN_NAV_ITEMS.map((i) => ({
    token: i.to,
    title: i.label,
    pathHint: i.to,
    defaultSection: i.section,
  }));
  const pins: SidebarSectionRow[] = SIDEBAR_PIN_DEFINITIONS.map((p) => ({
    token: sidebarPinToken(p.id),
    title: p.label,
    pathHint: `${p.path}${p.hash || ""}`,
    defaultSection: p.section,
  }));
  return [...mains, ...pins].sort((a, b) => {
    const c = a.defaultSection.localeCompare(b.defaultSection, "zh-CN");
    if (c !== 0) return c;
    return a.title.localeCompare(b.title, "zh-CN");
  });
});

/** 草稿：token → 分组名；空串表示沿用内置 */
const sidebarSectionInputs = reactive<Record<string, string>>({});

function loadSidebarSectionInputs() {
  for (const row of sidebarSectionRows.value) {
    const cur = consolePrefs.sidebarNavSectionByToken[row.token];
    sidebarSectionInputs[row.token] = typeof cur === "string" && cur.trim() ? cur.trim() : "";
  }
}

function saveSidebarSectionInputs() {
  const out: Record<string, string> = {};
  for (const row of sidebarSectionRows.value) {
    const v = (sidebarSectionInputs[row.token] ?? "").trim();
    if (v && v !== row.defaultSection) out[row.token] = v;
  }
  setConsolePrefs({ sidebarNavSectionByToken: out });
  loadSidebarSectionInputs();
}

function clearSidebarSectionOverrides() {
  setConsolePrefs({ sidebarNavSectionByToken: {} });
  loadSidebarSectionInputs();
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
  loadSidebarSectionInputs();
});

onActivated(() => {
  loadSidebarSectionInputs();
  scrollToPasswordIfNeeded();
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
    return;
  }
  if (route.hash === "#sidebar-order") {
    requestAnimationFrame(() => {
      document.getElementById("sidebar-order")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

loadSidebarSectionInputs();
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
          宽屏侧栏可拖动 ⋮ 排序、点 × 移除；未在侧栏的入口在侧栏底部折叠池内。移动端抽屉仅用于跳转，调整顺序、添加或移除请在下方「侧栏顺序与项目」中完成。各页标题栏「+」仍可把入口加回侧栏。若误删导致只剩一项仍可继续操作；侧栏过空时可点「恢复默认」。
        </p>
        <details
          id="sidebar-order"
          class="prefs-sidebar-order"
          style="margin-bottom: 14px"
        >
          <summary
            class="prefs-sidebar-order__summary muted"
          >侧栏顺序与项目</summary>
          <p
            class="muted"
            style="margin: 10px 0 12px; line-height: 1.55; font-size: 13px"
          >
            使用「上移 / 下移」调整顺序；「移除」至少保留一项。下方「未在侧栏」可添加条目。
          </p>
          <div class="prefs-sidebar-order__list">
            <template
              v-for="row in sidebarNavRows"
              :key="'ord-' + row.token"
            >
              <div
                v-if="row.showSection"
                class="prefs-sidebar-order__sec"
                role="presentation"
              >
                {{ row.section }}
              </div>
              <div class="prefs-sidebar-order__row">
                <span
                  class="prefs-sidebar-order__ico"
                  aria-hidden="true"
                >{{ row.kind === "main" ? row.item.icon : row.pin.icon }}</span>
                <div class="prefs-sidebar-order__meta">
                  <div class="prefs-sidebar-order__label">
                    {{ row.kind === "main" ? row.item.label : row.pin.label }}
                  </div>
                  <div class="prefs-sidebar-order__desc muted">
                    {{ row.kind === "main" ? row.item.description : row.pin.description }}
                  </div>
                </div>
                <div class="prefs-sidebar-order__actions">
                  <button
                    type="button"
                    class="btn prefs-sidebar-order__btn"
                    :disabled="!canMoveNavUp(row.token)"
                    @click="moveNavTokenInOrder(row.token, -1)"
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    class="btn prefs-sidebar-order__btn"
                    :disabled="!canMoveNavDown(row.token)"
                    @click="moveNavTokenInOrder(row.token, 1)"
                  >
                    下移
                  </button>
                  <button
                    v-if="sidebarNavRows.length > 1"
                    type="button"
                    class="btn prefs-sidebar-order__btn prefs-sidebar-order__btn--danger"
                    @click="removeNavTokenFromSidebar(row.token)"
                  >
                    移除
                  </button>
                </div>
              </div>
            </template>
          </div>
          <div
            v-if="sidebarPoolRows.length"
            class="prefs-sidebar-order__pool"
          >
            <div class="prefs-sidebar-order__pool-title muted">
              未在侧栏（{{ sidebarPoolRows.length }}）
            </div>
            <template
              v-for="row in sidebarPoolRows"
              :key="'pool-' + row.token"
            >
              <div
                v-if="row.showSection"
                class="prefs-sidebar-order__pool-sec"
                role="presentation"
              >
                {{ row.section }}
              </div>
              <div class="prefs-sidebar-order__pool-row">
                <span
                  class="prefs-sidebar-order__ico"
                  aria-hidden="true"
                >{{ row.kind === "main" ? row.item.icon : row.pin.icon }}</span>
                <span class="prefs-sidebar-order__pool-label">{{ row.kind === "main" ? row.item.label : row.pin.label }}</span>
                <button
                  type="button"
                  class="btn btn--primary prefs-sidebar-order__btn"
                  @click="addNavTokenToSidebar(row.token)"
                >
                  添加
                </button>
              </div>
            </template>
          </div>
        </details>
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
          >侧栏分组标题</summary>
          <p
            class="muted"
            style="margin: 10px 0 8px; line-height: 1.55; font-size: 13px"
          >
            为每个入口填写在侧栏里显示的分组名称；<strong style="color: var(--text)">留空</strong>或与「内置」相同则沿用默认。相邻且分组名相同的项会合并为一段。
          </p>
          <div class="prefs-sidebar-sections">
            <div
              v-for="row in sidebarSectionRows"
              :key="row.token"
              class="prefs-sidebar-sections__row"
            >
              <div class="prefs-sidebar-sections__meta">
                <div class="prefs-sidebar-sections__title">
                  {{ row.title }}
                </div>
                <div class="prefs-sidebar-sections__hint muted">
                  {{ row.pathHint }} · 内置 {{ row.defaultSection }}
                </div>
              </div>
              <input
                v-model="sidebarSectionInputs[row.token]"
                class="inp prefs-sidebar-sections__inp"
                type="text"
                :placeholder="row.defaultSection"
                :aria-label="`${row.title} 的侧栏分组名`"
              >
            </div>
          </div>
          <div
            class="row-actions"
            style="margin-top: 12px"
          >
            <button
              type="button"
              class="btn btn--primary"
              @click="saveSidebarSectionInputs"
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
