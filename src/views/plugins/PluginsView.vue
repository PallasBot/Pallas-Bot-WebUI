<script setup lang="ts">
import {
  fetchPlugins,
  fetchPluginConfig,
  fetchPluginsHelpMenuVisibility,
  putPluginConfig,
  putPluginsHelpMenuVisibility,
} from "@/api/consoleApi";
import type { PluginConfigData, PluginConfigField, PluginRow } from "@/api/pallasTypes";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { View } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, inject, onMounted, ref, watch } from "vue";

const loading = ref(true);
const saving = ref(false);
const rows = ref<PluginRow[]>([]);
const hiddenSet = ref<Set<string>>(new Set());
const ignoredSet = ref<Set<string>>(new Set());
const dialog = ref(false);
const current = ref<PluginRow | null>(null);
const activeFuncIndex = ref(0);
const conn = inject(pallasConnectionKey, null);
const plugCategory = ref<string>("all");
const plugSearch = ref("");
const helpVisible = ref(true);
const pluginCfgLoading = ref(false);
const pluginCfgSaving = ref(false);
const pluginCfg = ref<PluginConfigData | null>(null);
const pluginCfgForm = ref<Record<string, unknown>>({});
const jsonExpanded = ref<Record<string, boolean>>({});
const showChangedOnly = ref(false);

function pluginTypeLabel(p: PluginRow): string {
  const t = (p.metadata?.type || "").trim();
  return t || "未标注";
}

function syncVisibilityForCurrent() {
  if (!current.value) return;
  helpVisible.value = !hiddenSet.value.has(current.value.name);
}

async function load() {
  loading.value = true;
  try {
    const [plugins, vis] = await Promise.all([fetchPlugins(), fetchPluginsHelpMenuVisibility()]);
    rows.value = plugins;
    hiddenSet.value = new Set(vis.hidden_plugins || []);
    ignoredSet.value = new Set(vis.ignored_plugins || []);
    syncVisibilityForCurrent();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载插件失败");
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

watch(
  () => conn?.healthTick.value,
  () => {
    if (conn?.ok.value && !loading.value && rows.value.length === 0) {
      void load();
    }
  },
);

watch(
  () => conn?.ok.value,
  (v) => {
    if (v !== true) return;
    if (rows.value.length === 0) void load();
  },
  { immediate: true },
);

const plugCategories = computed(() => {
  const s = new Set<string>();
  for (const p of rows.value) s.add(pluginTypeLabel(p));
  return [...s].sort((a, b) => a.localeCompare(b, "zh-CN"));
});

const filteredPlugins = computed(() => {
  let list = rows.value;
  if (plugCategory.value !== "all") {
    list = list.filter((p) => pluginTypeLabel(p) === plugCategory.value);
  }
  const q = plugSearch.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q) ||
        (p.metadata?.name || "").toLowerCase().includes(q) ||
        (p.metadata?.description || "").toLowerCase().includes(q),
    );
  }
  return list;
});

const helpVisibleCount = computed(() => rows.value.filter((p) => !hiddenSet.value.has(p.name)).length);

function openMeta(p: PluginRow) {
  current.value = p;
  activeFuncIndex.value = 0;
  syncVisibilityForCurrent();
  void loadPluginConfig(p.name);
  dialog.value = true;
}

async function loadPluginConfig(pluginName: string) {
  pluginCfgLoading.value = true;
  try {
    const data = await fetchPluginConfig(pluginName);
    pluginCfg.value = data;
    const form: Record<string, unknown> = {};
    for (const f of data.fields) form[f.name] = f.current;
    pluginCfgForm.value = form;
    const expandMap: Record<string, boolean> = {};
    for (const f of data.fields) {
      if (fieldInputType(f) === "json") expandMap[f.name] = false;
    }
    jsonExpanded.value = expandMap;
  } catch (e) {
    pluginCfg.value = null;
    pluginCfgForm.value = {};
    ElMessage.error(e instanceof Error ? e.message : "插件配置加载失败");
  } finally {
    pluginCfgLoading.value = false;
  }
}

function toggleJsonField(name: string) {
  jsonExpanded.value[name] = !jsonExpanded.value[name];
}

function jsonPreview(name: string): string {
  const t = fieldJsonText(name).trim();
  if (!t) return "";
  return t.length > 120 ? `${t.slice(0, 120)} ...` : t;
}

function fieldInputType(f: PluginConfigField): "bool" | "number" | "json" | "string" {
  if (f.kind === "bool") return "bool";
  if (f.kind === "int" || f.kind === "float") return "number";
  if (f.kind === "json") return "json";
  return "string";
}

function fieldJsonText(name: string): string {
  const v = pluginCfgForm.value[name];
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return String(v ?? "");
  }
}

function updateFieldJson(name: string, text: string) {
  pluginCfgForm.value[name] = text;
}

function fieldDefaultPlaceholder(f: PluginConfigField): string {
  if (f.default == null) return "";
  if (typeof f.default === "object") {
    try {
      return JSON.stringify(f.default);
    } catch {
      return "";
    }
  }
  return String(f.default);
}

function normalizeCompareValue(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === "string") return v.trim();
  return v;
}

function isFieldChanged(f: PluginConfigField): boolean {
  const cur = normalizeCompareValue(pluginCfgForm.value[f.name]);
  const def = normalizeCompareValue(f.default);
  try {
    return JSON.stringify(cur) !== JSON.stringify(def);
  } catch {
    return String(cur) !== String(def);
  }
}

const visiblePluginFields = computed<PluginConfigField[]>(() => {
  const fields = pluginCfg.value?.fields ?? [];
  if (!showChangedOnly.value) return fields;
  return fields.filter((f) => isFieldChanged(f));
});

async function savePluginConfig() {
  if (!current.value || !pluginCfg.value) return;
  pluginCfgSaving.value = true;
  try {
    const payload: Record<string, unknown> = {};
    for (const f of pluginCfg.value.fields) {
      const raw = pluginCfgForm.value[f.name];
      if (fieldInputType(f) === "json" && typeof raw === "string") {
        const txt = raw.trim();
        payload[f.name] = txt ? JSON.parse(txt) : null;
      } else {
        payload[f.name] = raw;
      }
    }
    const data = await putPluginConfig(current.value.name, payload);
    pluginCfg.value = data;
    const form: Record<string, unknown> = {};
    for (const f of data.fields) form[f.name] = f.current;
    pluginCfgForm.value = form;
    ElMessage.success("插件配置已写入 .env");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "插件配置保存失败");
  } finally {
    pluginCfgSaving.value = false;
  }
}

type PluginMenuItem = {
  func?: string;
  trigger_method?: string;
  trigger_condition?: string;
  brief_des?: string;
  detail_des?: string;
};

const currentMenuData = computed<PluginMenuItem[]>(() => {
  const extra = current.value?.metadata?.extra;
  if (!extra || typeof extra !== "object") return [];
  const raw = (extra as Record<string, unknown>).menu_data;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is PluginMenuItem => typeof x === "object" && x !== null);
});

const currentMenuItem = computed<PluginMenuItem | null>(() => {
  if (!currentMenuData.value.length) return null;
  const i = Math.max(0, Math.min(activeFuncIndex.value, currentMenuData.value.length - 1));
  return currentMenuData.value[i] ?? null;
});

const currentMenuIndexLabel = computed(() => {
  if (!currentMenuData.value.length) return "0 / 0";
  return `${activeFuncIndex.value + 1} / ${currentMenuData.value.length}`;
});

function goPrevMenuItem() {
  if (!currentMenuData.value.length) return;
  activeFuncIndex.value = Math.max(0, activeFuncIndex.value - 1);
}

function goNextMenuItem() {
  if (!currentMenuData.value.length) return;
  activeFuncIndex.value = Math.min(currentMenuData.value.length - 1, activeFuncIndex.value + 1);
}

async function submitHelpVisibility() {
  if (!current.value || ignoredSet.value.has(current.value.name)) return;
  saving.value = true;
  const nextHidden = new Set(hiddenSet.value);
  if (helpVisible.value) nextHidden.delete(current.value.name);
  else nextHidden.add(current.value.name);
  try {
    const data = await putPluginsHelpMenuVisibility([...nextHidden]);
    hiddenSet.value = new Set(data.hidden_plugins || []);
    ElMessage.success("已更新帮助菜单可见性");
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "更新失败");
    syncVisibilityForCurrent();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="view-page plugins-page">
    <div class="main-wrap panel--wide">
      <h1 class="main-title">插件列表</h1>
      <p class="main-sub">统一展示插件元信息，并可配置是否在「牛牛帮助」菜单展示。</p>
      <el-card
        v-loading="loading"
        shadow="hover"
        class="plug-card-wrap"
      >
        <div class="plug-toolbar">
          <el-radio-group
            v-model="plugCategory"
            class="plug-cat"
            size="default"
          >
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button
              v-for="c in plugCategories"
              :key="c"
              :label="c"
            >{{ c }}</el-radio-button>
          </el-radio-group>
          <el-input
            v-model="plugSearch"
            class="plug-q"
            clearable
            placeholder="搜索 name / 标题 / 简介"
          />
        </div>
        <el-empty
          v-if="!filteredPlugins.length && !loading"
          description="当前筛选下无插件"
          :image-size="80"
        />
        <el-row
          v-else
          :gutter="0"
          class="plug-grid"
        >
          <el-col
            v-for="p in filteredPlugins"
            :key="p.name"
            :xs="24"
            :sm="12"
            :md="8"
            :lg="6"
            :xl="4"
          >
            <el-card
              class="plug-tile"
              shadow="hover"
            >
              <div class="pc-hd">
                <span class="pc-title">{{ p.metadata?.name || p.name }}</span>
                <el-tag
                  size="small"
                  type="info"
                >{{ pluginTypeLabel(p) }}</el-tag>
              </div>
              <div class="pc-meta">
                <div class="pc-name mono">{{ p.name }}</div>
              </div>
              <div class="pc-desc">{{ p.metadata?.description || "—" }}</div>
              <div class="pc-ft">
                <el-button
                  :icon="View"
                  link
                  type="primary"
                  @click="openMeta(p)"
                >详情</el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>
        <div class="ft">
          <el-button
            type="primary"
            plain
            :loading="loading"
            @click="load"
          >刷新</el-button>
          <el-text
            class="c"
            type="info"
          >共 {{ rows.length }} 个，当前筛选 {{ filteredPlugins.length }} 个，帮助菜单展示 {{ helpVisibleCount }} 个</el-text>
        </div>
      </el-card>
    </div>

    <el-dialog
      v-model="dialog"
      class="plugins-dialog"
      :title="current ? `插件配置：${current.metadata?.name || current.name}` : '插件配置'"
      width="min(92vw, 760px)"
      destroy-on-close
    >
      <template v-if="current">
        <div class="dlg-main">
          <div class="dlg-meta-grid">
            <div class="dlg-cell">
              <span class="dlg-k">插件名</span>
              <span class="dlg-v mono">{{ current.name }}</span>
            </div>
            <div class="dlg-cell">
              <span class="dlg-k">模块</span>
              <span class="dlg-v mono">{{ current.module }}</span>
            </div>
            <div class="dlg-cell">
              <span class="dlg-k">类型</span>
              <span class="dlg-v">{{ pluginTypeLabel(current) }}</span>
            </div>
            <div class="dlg-cell">
              <span class="dlg-k">简介</span>
              <span class="dlg-v">{{ current.metadata?.description || "—" }}</span>
            </div>
          </div>
          <div class="menu-block">
            <div class="menu-head">
              <h4 class="menu-title">功能菜单</h4>
            </div>
            <el-empty
              v-if="!currentMenuData.length"
              description="该插件未声明 menu_data"
              :image-size="70"
            />
            <div
              v-else
              class="menu-layout"
            >
              <div class="menu-list">
                <button
                  v-for="(item, idx) in currentMenuData"
                  :key="`${current?.name}-${idx}`"
                  class="menu-item"
                  :class="{ active: idx === activeFuncIndex }"
                  type="button"
                  @click="activeFuncIndex = idx"
                >
                  <span class="mi-idx">#{{ idx + 1 }}</span>
                  <span class="mi-name">{{ item.func || `未命名功能 ${idx + 1}` }}</span>
                </button>
              </div>
              <div class="menu-detail">
                <template v-if="currentMenuItem">
                  <div class="detail-nav">
                    <el-button
                      size="small"
                      plain
                      :disabled="activeFuncIndex <= 0"
                      @click="goPrevMenuItem"
                    >
                      上一项
                    </el-button>
                    <span class="detail-nav-idx">{{ currentMenuIndexLabel }}</span>
                    <el-button
                      size="small"
                      plain
                      :disabled="activeFuncIndex >= currentMenuData.length - 1"
                      @click="goNextMenuItem"
                    >
                      下一项
                    </el-button>
                  </div>
                  <div class="mrow">
                    <span class="mk">功能名</span>
                    <span class="mv">{{ currentMenuItem.func || "未命名功能" }}</span>
                  </div>
                  <div class="mrow">
                    <span class="mk">触发方式</span>
                    <span class="mv mono">{{ currentMenuItem.trigger_method || "—" }}</span>
                  </div>
                  <div class="mrow">
                    <span class="mk">命令</span>
                    <span class="mv mono">{{ currentMenuItem.trigger_condition || "—" }}</span>
                  </div>
                  <div class="mrow">
                    <span class="mk">简述</span>
                    <span class="mv">{{ currentMenuItem.brief_des || "—" }}</span>
                  </div>
                  <div class="mrow">
                    <span class="mk">详情</span>
                    <span class="mv">{{ currentMenuItem.detail_des || "—" }}</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
          <div class="menu-block cfg-edit-block">
            <div class="menu-head">
              <h4 class="menu-title">插件配置</h4>
            </div>
            <el-skeleton
              v-if="pluginCfgLoading"
              :rows="4"
              animated
            />
            <el-empty
              v-else-if="!pluginCfg || !pluginCfg.fields.length"
              description="该插件未提供可编辑配置项"
              :image-size="68"
            />
            <el-form
              v-else
              class="cfg-edit-form"
            >
              <div class="cfg-form-tools">
                <el-switch
                  v-model="showChangedOnly"
                  inline-prompt
                  active-text="仅显示已改项"
                  inactive-text="显示全部"
                />
              </div>
              <div class="cfg-grid">
                <div
                  v-for="f in visiblePluginFields"
                  :key="f.name"
                  class="cfg-item-card"
                >
                  <div class="cfg-item-head">
                    <span class="cfg-item-name">{{ f.env_key }}</span>
                  </div>
                  <div class="cfg-item-input">
                    <el-switch
                      v-if="fieldInputType(f) === 'bool'"
                      v-model="pluginCfgForm[f.name]"
                    />
                    <el-input-number
                      v-else-if="fieldInputType(f) === 'number'"
                      v-model="pluginCfgForm[f.name]"
                      :controls="true"
                      class="num-input"
                    />
                    <template v-else-if="fieldInputType(f) === 'json'">
                      <div class="json-tools">
                        <el-button
                          size="small"
                          text
                          type="primary"
                          @click="toggleJsonField(f.name)"
                        >{{ jsonExpanded[f.name] ? "收起编辑" : "展开编辑" }}</el-button>
                      </div>
                      <el-input
                        v-if="jsonExpanded[f.name]"
                        :model-value="fieldJsonText(f.name)"
                        type="textarea"
                        :rows="4"
                        :placeholder="fieldDefaultPlaceholder(f)"
                        class="w"
                        @update:model-value="(v: string | number) => updateFieldJson(f.name, String(v))"
                      />
                      <el-input
                        v-else
                        :model-value="jsonPreview(f.name)"
                        type="textarea"
                        :rows="2"
                        readonly
                        class="w"
                      />
                    </template>
                    <el-input
                      v-else
                      :model-value="String(pluginCfgForm[f.name] ?? '')"
                      :placeholder="fieldDefaultPlaceholder(f)"
                      class="w"
                      @update:model-value="(v: string | number) => (pluginCfgForm[f.name] = String(v))"
                    />
                  </div>
                  <div class="cfg-field-tip">
                    <span v-if="f.description">{{ f.description }}</span>
                    <span v-if="f.default !== undefined">默认值：{{ typeof f.default === 'object' ? JSON.stringify(f.default) : String(f.default) }}</span>
                  </div>
                </div>
              </div>
              <el-empty
                v-if="showChangedOnly && !visiblePluginFields.length"
                description="当前插件没有已改项"
                :image-size="66"
              />
              <div class="mini-actions">
                <el-button
                  type="primary"
                  :loading="pluginCfgSaving"
                  @click="savePluginConfig"
                >保存插件配置</el-button>
                <el-button
                  plain
                  :loading="pluginCfgLoading"
                  @click="current && loadPluginConfig(current.name)"
                >重新加载</el-button>
              </div>
            </el-form>
          </div>
          <div class="dlg-row dlg-row-ctrl">
            <span class="dlg-k">帮助菜单展示</span>
            <span class="dlg-v dlg-v-inline">
              <el-switch
                v-model="helpVisible"
                :disabled="ignoredSet.has(current.name) || saving"
                inline-prompt
                active-text="显示"
                inactive-text="隐藏"
                @change="submitHelpVisibility"
              />
              <span
                v-if="ignoredSet.has(current.name)"
                class="dlg-tip-inline is-off"
              >该插件不参与帮助菜单展示。</span>
              <span
                v-else
                class="dlg-tip-inline is-on"
              >切换后立即生效。</span>
            </span>
          </div>
          <el-collapse class="dlg-collapse">
            <el-collapse-item name="raw" title="查看原始元数据">
              <el-scrollbar max-height="34vh">
                <pre class="json">{{ JSON.stringify(current, null, 2) }}</pre>
              </el-scrollbar>
            </el-collapse-item>
          </el-collapse>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.main-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.02em;
}
.main-sub {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}
.panel {
  max-width: 1100px;
}
.main-wrap {
  background: var(--c-nav-bg);
  border-radius: var(--pallas-radius-md);
  border: 1px solid rgba(22, 100, 196, 0.12);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.06);
  padding: 18px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.panel--wide {
  width: 100%;
  max-width: none;
  min-height: 100%;
}
.plug-card-wrap {
  border: 1px solid rgba(22, 100, 196, 0.1);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
}
.plug-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 10px;
  border: 1px solid rgba(22, 100, 196, 0.12);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
}
.plug-cat {
  flex: 1;
  min-width: 0;
  :deep(.el-radio-button__inner) {
    border-radius: var(--pallas-radius-sm, 8px);
  }
}
.plug-q {
  width: 280px;
  max-width: 100%;
}
.plug-grid {
  margin-top: 2px;
  flex: 1;
  align-content: start;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 12px;
  :deep(.el-col) {
    width: auto !important;
    max-width: none !important;
    flex: none !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    min-width: 0;
  }
}
.plug-tile {
  height: 100%;
  margin-bottom: 0;
  border: 1px solid rgba(22, 100, 196, 0.1);
  border-radius: 10px;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
  &:hover {
    transform: translateY(-1px);
    border-color: rgba(22, 100, 196, 0.26);
    box-shadow: 0 4px 12px rgba(20, 62, 116, 0.12);
  }
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 11px 12px;
    min-height: 170px;
  }
}
.pc-hd {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.pc-title {
  font-weight: 600;
  color: var(--c-main);
  font-size: 16px;
  line-height: 1.35;
  flex: 1;
  min-width: 0;
}
.pc-name {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.pc-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pc-desc {
  flex: 1;
  font-size: 12px;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.pc-ft {
  margin-top: auto;
  padding-top: 2px;
}
.dlg-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dlg-row {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 12px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid rgba(22, 100, 196, 0.1);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
}
.dlg-row-2col {
  grid-template-columns: 1fr 1fr;
  align-items: start;
}
.dlg-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.dlg-cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid rgba(22, 100, 196, 0.1);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
}
.dlg-row-ctrl {
  align-items: center;
}
.dlg-k {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.dlg-v {
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
}
.dlg-v-inline {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-start;
  padding: 6px 10px;
  border: 1px solid rgba(22, 100, 196, 0.16);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
  width: 100%;
}
.dlg-tip-inline {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
  border: 1px solid transparent;
  white-space: nowrap;
}
.dlg-tip-inline.is-on {
  color: var(--el-color-success-dark-2);
  background: rgba(103, 194, 58, 0.12);
  border-color: rgba(103, 194, 58, 0.28);
}
.dlg-tip-inline.is-off {
  color: var(--el-text-color-secondary);
  background: rgba(144, 147, 153, 0.1);
  border-color: rgba(144, 147, 153, 0.28);
}
:deep(.dlg-v-inline .el-switch__core) {
  min-width: 40px;
  height: 20px;
}
:deep(.dlg-v-inline .el-switch__label) {
  font-size: 11px;
}
.dlg-collapse {
  margin-top: 2px;
}
.menu-block {
  margin-top: 8px;
  padding: 0 12px 12px;
  border: 1px solid rgba(22, 100, 196, 0.14);
  border-radius: 12px;
  background: var(--el-fill-color-blank);
}
.menu-head {
  margin: 0 -12px 10px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(22, 100, 196, 0.14);
  background: linear-gradient(180deg, rgba(22, 100, 196, 0.12), rgba(22, 100, 196, 0.04));
  border-radius: 12px 12px 0 0;
}
.menu-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--c-main);
}
.cfg-edit-block {
  margin-top: 10px;
}
.cfg-edit-form {
  padding: 2px 2px 0;
}
.cfg-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(280px, 1fr));
  gap: 10px;
}
.cfg-form-tools {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 10px;
}
.cfg-item-card {
  border: 1px solid rgba(22, 100, 196, 0.14);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.cfg-item-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}
.cfg-item-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1.35;
  word-break: break-word;
}
.cfg-item-input {
  min-width: 0;
}
.num-input {
  width: 240px;
  max-width: 100%;
}
.json-tools {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}
.cfg-field-tip {
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
.w {
  width: 100%;
}
@media (max-width: 900px) {
  .cfg-grid {
    grid-template-columns: 1fr;
  }
  .num-input {
    width: 100%;
  }
}
.menu-layout {
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
  gap: 12px;
}
.menu-list {
  border: 1px solid rgba(22, 100, 196, 0.14);
  border-radius: 10px;
  padding: 8px;
  max-height: 360px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.menu-item {
  border: 1px solid transparent;
  background: transparent;
  text-align: left;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}
.menu-item:hover {
  background: rgba(22, 100, 196, 0.06);
}
.menu-item.active {
  border-color: rgba(22, 100, 196, 0.25);
  background: rgba(22, 100, 196, 0.1);
}
.mi-idx {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  min-width: 26px;
}
.mi-name {
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}
.menu-detail {
  border: 1px solid rgba(22, 100, 196, 0.14);
  border-radius: 10px;
  padding: 10px 12px;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed rgba(22, 100, 196, 0.18);
}
.detail-nav-idx {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.mrow {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
  align-items: start;
}
.mk {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.mv {
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
}
@media (max-width: 900px) {
  .dlg-meta-grid {
    grid-template-columns: 1fr;
  }
  .dlg-row-2col {
    grid-template-columns: 1fr;
  }
  .menu-layout {
    grid-template-columns: 1fr;
  }
  .menu-list {
    max-height: 180px;
  }
}
@media (max-width: 768px) {
  .main-wrap {
    padding: 12px 10px;
  }
  .main-title {
    font-size: 1.1rem;
  }
  .main-sub {
    margin-top: 6px;
    font-size: 13px;
  }
  .plug-toolbar {
    gap: 8px;
    margin-bottom: 10px;
    padding: 8px;
  }
  .plug-cat {
    width: 100%;
  }
  .plug-q {
    width: 100%;
    max-width: none;
  }
  .plug-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .plug-tile {
    margin-bottom: 0;
    :deep(.el-card__body) {
      min-height: 0;
      padding: 10px;
      gap: 6px;
    }
    &:hover {
      transform: none;
      box-shadow: none;
    }
  }
  .pc-title {
    font-size: 15px;
  }
  .pc-desc {
    -webkit-line-clamp: 2;
  }
  .plugins-dialog {
    :deep(.el-dialog) {
      width: 100vw !important;
      max-width: none !important;
      height: 88dvh;
      margin: 12dvh 0 0 !important;
      border-radius: 16px 16px 0 0;
      overflow: hidden;
      box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.22);
      display: flex;
      flex-direction: column;
    }
    :deep(.el-dialog__header) {
      padding: 10px 12px 8px;
      border-bottom: 1px solid rgba(22, 100, 196, 0.14);
      flex-shrink: 0;
    }
    :deep(.el-dialog__title) {
      font-size: 14px;
      font-weight: 700;
    }
    :deep(.el-dialog__body) {
      padding: 10px;
      overflow: auto;
      flex: 1;
      -webkit-overflow-scrolling: touch;
    }
  }
  .dlg-main {
    gap: 10px;
    padding-bottom: 6px;
  }
  .dlg-cell {
    padding: 7px 8px;
  }
  .dlg-k {
    font-size: 11px;
  }
  .dlg-v {
    font-size: 12px;
    line-height: 1.45;
  }
  .menu-title {
    font-size: 14px;
  }
  .menu-detail {
    min-height: 0;
    padding: 8px 10px;
  }
  .cfg-item-card {
    padding: 8px;
    gap: 6px;
  }
  .cfg-field-tip {
    font-size: 11px;
    gap: 6px;
  }
  .mini-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .mini-actions :deep(.el-button) {
    width: 100%;
    margin-left: 0 !important;
  }
  .menu-block {
    padding: 0 8px 10px;
  }
  .menu-head {
    margin: 0 -8px 8px;
    padding: 8px;
  }
  .mrow {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .dlg-row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 8px;
  }
  .cfg-grid {
    grid-template-columns: 1fr;
  }
  .ft {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
}
.mono {
  font-family: ui-monospace, Consolas, monospace;
}
.al {
  border: 1px solid rgba(22, 100, 196, 0.15);
}
.ft {
  margin-top: auto;
  padding-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  .c {
    font-size: 13px;
  }
}
.json {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: ui-monospace, Consolas, monospace;
}
</style>
