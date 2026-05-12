<script setup lang="ts">
import { fetchCommonConfig, fetchCommonConfigSections, putCommonConfig } from "@/api/consoleApi";
import type { CommonConfigSectionMeta, PluginConfigData, PluginConfigField } from "@/api/pallasTypes";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { ElMessage } from "element-plus";
import { computed, inject, onMounted, ref, watch } from "vue";

const conn = inject(pallasConnectionKey, null);
const sections = ref<CommonConfigSectionMeta[]>([]);
const loading = ref(true);
const currentId = ref<string>("");
const cfgLoading = ref(false);
const cfgSaving = ref(false);
const cfg = ref<PluginConfigData | null>(null);
const cfgForm = ref<Record<string, unknown>>({});
const jsonExpanded = ref<Record<string, boolean>>({});
const showChangedOnly = ref(false);

async function loadSections() {
  loading.value = true;
  try {
    const rows = await fetchCommonConfigSections();
    sections.value = rows;
    if (!currentId.value && rows.length) {
      currentId.value = rows[0]!.id;
    }
    if (currentId.value) void loadCfg(currentId.value);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载配置段失败");
    sections.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadSections();
});

watch(
  () => conn?.healthTick.value,
  () => {
    if (conn?.ok.value && !loading.value && sections.value.length === 0) {
      void loadSections();
    }
  },
);

watch(
  () => conn?.ok.value,
  (v) => {
    if (v !== true) return;
    if (sections.value.length === 0) void loadSections();
  },
  { immediate: true },
);

watch(currentId, (id) => {
  if (id) void loadCfg(id);
});

async function loadCfg(sectionId: string) {
  cfgLoading.value = true;
  try {
    const data = await fetchCommonConfig(sectionId);
    cfg.value = data;
    const form: Record<string, unknown> = {};
    for (const f of data.fields) form[f.name] = f.current;
    cfgForm.value = form;
    const expandMap: Record<string, boolean> = {};
    for (const f of data.fields) {
      if (fieldInputType(f) === "json") expandMap[f.name] = false;
    }
    jsonExpanded.value = expandMap;
  } catch (e) {
    cfg.value = null;
    cfgForm.value = {};
    ElMessage.error(e instanceof Error ? e.message : "配置加载失败");
  } finally {
    cfgLoading.value = false;
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
  const v = cfgForm.value[name];
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return String(v ?? "");
  }
}

function updateFieldJson(name: string, text: string) {
  cfgForm.value[name] = text;
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
  const cur = normalizeCompareValue(cfgForm.value[f.name]);
  const def = normalizeCompareValue(f.default);
  try {
    return JSON.stringify(cur) !== JSON.stringify(def);
  } catch {
    return String(cur) !== String(def);
  }
}

const visibleFields = computed<PluginConfigField[]>(() => {
  const fields = cfg.value?.fields ?? [];
  if (!showChangedOnly.value) return fields;
  return fields.filter((f) => isFieldChanged(f));
});

const currentTitle = computed(() => sections.value.find((s) => s.id === currentId.value)?.title || "");

async function saveCfg() {
  if (!cfg.value) return;
  cfgSaving.value = true;
  try {
    const payload: Record<string, unknown> = {};
    for (const f of cfg.value.fields) {
      const raw = cfgForm.value[f.name];
      if (fieldInputType(f) === "json" && typeof raw === "string") {
        const txt = raw.trim();
        payload[f.name] = txt ? JSON.parse(txt) : null;
      } else {
        payload[f.name] = raw;
      }
    }
    const data = await putCommonConfig(currentId.value, payload);
    cfg.value = data;
    const form: Record<string, unknown> = {};
    for (const f of data.fields) form[f.name] = f.current;
    cfgForm.value = form;
    ElMessage.success("已写入 .env；部分项需重启 Bot 后进程内才完全生效。");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    cfgSaving.value = false;
  }
}
</script>

<template>
  <div class="view-page common-config-page">
    <div class="main-wrap panel--wide">
      <h1 class="main-title">通用配置</h1>
      <p class="main-sub">
        对应仓库 <span class="mono">src/common</span> 下通过环境变量加载的配置段（与插件列表分离）。在
        <span class="mono">src/common/webui_env_sections.py</span> 注册后可在此出现。
      </p>
      <div
        v-loading="loading"
        class="cc-layout"
      >
        <aside class="cc-aside">
          <div class="cc-aside-hd">配置段</div>
          <el-empty
            v-if="!sections.length && !loading"
            description="暂无已注册段"
            :image-size="72"
          />
          <el-scrollbar
            v-else
            class="cc-scroll"
          >
            <button
              v-for="s in sections"
              :key="s.id"
              type="button"
              class="cc-item"
              :class="{ active: s.id === currentId }"
              @click="currentId = s.id"
            >
              <span class="cc-item-title">{{ s.title }}</span>
              <span class="cc-item-id mono">{{ s.id }}</span>
            </button>
          </el-scrollbar>
        </aside>
        <main class="cc-main">
          <div class="cc-main-hd">
            <h2 class="cc-main-title">{{ currentTitle || "—" }}</h2>
            <span
              v-if="cfg?.module"
              class="cc-mod mono"
            >{{ cfg.module }}</span>
          </div>
          <el-skeleton
            v-if="cfgLoading"
            :rows="5"
            animated
          />
          <el-empty
            v-else-if="!cfg?.fields.length"
            description="当前段无可编辑字段"
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
                v-for="f in visibleFields"
                :key="f.name"
                class="cfg-item-card"
              >
                <div class="cfg-item-head">
                  <span class="cfg-item-name">{{ f.env_key }}</span>
                </div>
                <div class="cfg-item-input">
                  <el-switch
                    v-if="fieldInputType(f) === 'bool'"
                    v-model="cfgForm[f.name]"
                  />
                  <el-input-number
                    v-else-if="fieldInputType(f) === 'number'"
                    v-model="cfgForm[f.name]"
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
                      >
                        {{ jsonExpanded[f.name] ? "收起编辑" : "展开编辑" }}
                      </el-button>
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
                    :model-value="String(cfgForm[f.name] ?? '')"
                    :placeholder="fieldDefaultPlaceholder(f)"
                    class="w"
                    @update:model-value="(v: string | number) => (cfgForm[f.name] = String(v))"
                  />
                </div>
                <div class="cfg-field-tip">
                  <span v-if="f.description">{{ f.description }}</span>
                  <span v-if="f.default !== undefined">
                    默认值：{{ typeof f.default === "object" ? JSON.stringify(f.default) : String(f.default) }}
                  </span>
                </div>
              </div>
            </div>
            <el-empty
              v-if="showChangedOnly && !visibleFields.length"
              description="没有与默认值不同的项"
              :image-size="66"
            />
            <div class="mini-actions">
              <el-button
                type="primary"
                :loading="cfgSaving"
                :disabled="!currentId"
                @click="saveCfg"
              >
                保存到 .env
              </el-button>
              <el-button
                plain
                :loading="cfgLoading"
                :disabled="!currentId"
                @click="loadCfg(currentId)"
              >
                重新加载
              </el-button>
            </div>
          </el-form>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.common-config-page {
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}
.main-wrap {
  background: var(--c-nav-bg);
  border-radius: var(--pallas-radius-md);
  border: 1px solid rgba(22, 100, 196, 0.12);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.06);
  padding: 18px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.main-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  color: var(--c-main);
}
.main-sub {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
}
.cc-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
  gap: 14px;
}
.cc-aside {
  border: 1px solid rgba(22, 100, 196, 0.14);
  border-radius: 12px;
  background: var(--el-fill-color-blank);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.cc-aside-hd {
  padding: 10px 12px;
  font-weight: 700;
  font-size: 13px;
  border-bottom: 1px solid rgba(22, 100, 196, 0.14);
  background: linear-gradient(180deg, rgba(22, 100, 196, 0.1), rgba(22, 100, 196, 0.03));
}
.cc-scroll {
  flex: 1;
  min-height: 0;
  padding: 8px;
}
.cc-item {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.cc-item:hover {
  background: rgba(22, 100, 196, 0.06);
}
.cc-item.active {
  border-color: rgba(22, 100, 196, 0.28);
  background: rgba(22, 100, 196, 0.1);
}
.cc-item-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.cc-item-id {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.cc-main {
  border: 1px solid rgba(22, 100, 196, 0.14);
  border-radius: 12px;
  background: var(--el-fill-color-blank);
  padding: 14px 16px;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}
.cc-main-hd {
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px dashed rgba(22, 100, 196, 0.2);
}
.cc-main-title {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 700;
  color: var(--c-main);
}
.cc-mod {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
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
.mini-actions {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
@media (max-width: 900px) {
  .cc-layout {
    grid-template-columns: 1fr;
  }
  .cfg-grid {
    grid-template-columns: 1fr;
  }
  .num-input {
    width: 100%;
  }
}
@media (max-width: 768px) {
  .main-wrap {
    padding: 12px 10px;
  }
  .main-title {
    margin: 0 0 4px;
    font-size: 1rem;
    font-weight: 650;
  }
  .main-sub {
    margin: 0 0 10px;
    font-size: 12px;
  }
  .cc-main-title {
    font-size: 0.9375rem;
  }
  .cc-main-hd {
    margin-bottom: 8px;
    padding-bottom: 8px;
  }
}
</style>
