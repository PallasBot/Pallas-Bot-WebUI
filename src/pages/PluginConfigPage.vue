<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import {
  fetchPluginConfig,
  fetchPlugins,
  fetchPluginsHelpMenuVisibility,
  postPluginConfigCheck,
  putPluginConfig,
  putPluginsHelpMenuVisibility,
} from "@/api/consoleApi";
import type { PluginConfigData, PluginConfigField, PluginRow } from "@/api/pallasTypes";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import PallasImageGatewaysEditor from "@/components/PallasImageGatewaysEditor.vue";
import { PALLAS_IMAGE_GATEWAY_FIELD_NAMES } from "@/utils/pallasImageGateways";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { axiosErrorDetail } from "@/api/http";
import { toastApiError, toastProbeLines, toastSaveSuccess } from "@/utils/consoleToastFeedback";

const route = useRoute();
const panelNavIcon = usePanelNavIcon();
const err = ref("");
const loading = ref(false);
const saving = ref(false);
const checking = ref(false);
const checkLines = ref<string[]>([]);
const checkErr = ref("");
const data = ref<PluginConfigData | null>(null);
const pluginRow = ref<PluginRow | null>(null);
const helpMenuHiddenList = ref<string[]>([]);
const helpMenuIgnoredList = ref<string[]>([]);
const helpMenuBusy = ref(false);
const helpMenuErr = ref("");
const saveFeedbackRef = ref<HTMLElement | null>(null);

const showInHelpMenu = computed(() => {
  if (!pluginRow.value) return false;
  if (pluginRow.value.help_ignored) return false;
  return Boolean(pluginRow.value.help_visible ?? !pluginRow.value.help_hidden);
});

async function loadHelpMenuState() {
  const name = pluginName.value;
  if (!name) return;
  helpMenuBusy.value = true;
  helpMenuErr.value = "";
  try {
    const [rows, vis] = await Promise.all([fetchPlugins(), fetchPluginsHelpMenuVisibility()]);
    pluginRow.value = rows.find((r) => r.name === name) ?? null;
    helpMenuHiddenList.value = [...vis.hidden_plugins];
    helpMenuIgnoredList.value = [...vis.ignored_plugins];
  } catch (e) {
    helpMenuErr.value = e instanceof Error ? e.message : String(e);
    pluginRow.value = null;
  } finally {
    helpMenuBusy.value = false;
  }
}

async function toggleHelpMenuVisible(wantVisible: boolean) {
  const name = pluginName.value;
  if (!name || !pluginRow.value?.name) return;
  if (pluginRow.value.help_ignored) return;
  helpMenuBusy.value = true;
  helpMenuErr.value = "";
  try {
    const set = new Set(helpMenuHiddenList.value);
    if (wantVisible) set.delete(name);
    else set.add(name);
    const out = await putPluginsHelpMenuVisibility([...set]);
    helpMenuHiddenList.value = [...out.hidden_plugins];
    const rows = await fetchPlugins({ bypassCache: true });
    pluginRow.value = rows.find((r) => r.name === name) ?? null;
  } catch (e) {
    helpMenuErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    helpMenuBusy.value = false;
  }
}

const pluginName = computed(() => String(route.params.name || ""));
const supportsConfigCheck = computed(() => pluginName.value === "pallas_image");
const usesGatewayEditor = computed(() => pluginName.value === "pallas_image");

const visibleFields = computed(() => {
  if (!data.value) return [];
  if (!usesGatewayEditor.value) return data.value.fields;
  const hidden = new Set<string>(PALLAS_IMAGE_GATEWAY_FIELD_NAMES);
  return data.value.fields.filter((f) => !hidden.has(f.name));
});

function onGatewayFieldValues(next: Record<string, string>) {
  fieldValues.value = { ...fieldValues.value, ...next };
}

async function load() {
  loading.value = true;
  err.value = "";
  try {
    data.value = await fetchPluginConfig(pluginName.value);
  } catch (e) {
    err.value = axiosErrorDetail(e);
    data.value = null;
  } finally {
    loading.value = false;
  }
  void loadHelpMenuState();
}

watch(
  () => route.params.name,
  () => {
    void load();
  },
);

onMounted(() => {
  void load();
});

useSaveHotkey(
  () => Boolean(data.value) && !loading.value && !saving.value && !checking.value,
  () => save(),
);

function fieldModel(f: PluginConfigField): string {
  const v = f.current;
  if (f.kind === "json") return JSON.stringify(v ?? null, null, 2);
  if (typeof v === "boolean") return v ? "true" : "false";
  return v === null || v === undefined ? "" : String(v);
}

function parseField(f: PluginConfigField, raw: unknown): unknown {
  const text = String(raw ?? "");
  if (f.kind === "bool") return text === "true" || text === "1";
  if (f.kind === "int") {
    const t = text.trim();
    if (!t) return f.default ?? 0;
    const n = parseInt(t, 10);
    if (!Number.isFinite(n)) throw new Error(`${f.name}: 请输入整数`);
    return n;
  }
  if (f.kind === "float") {
    const t = text.trim();
    if (!t) return f.default ?? 0;
    const n = parseFloat(t);
    if (!Number.isFinite(n)) throw new Error(`${f.name}: 请输入数字`);
    return n;
  }
  if (f.kind === "json") {
    const t = text.trim();
    if (!t) {
      if (Array.isArray(f.default)) return [];
      if (f.default !== null && f.default !== undefined && typeof f.default === "object") {
        return f.default;
      }
      return Array.isArray(f.current) ? [] : (f.current ?? []);
    }
    return JSON.parse(text) as unknown;
  }
  return text;
}

const fieldValues = ref<Record<string, string>>({});

watch(
  data,
  (d) => {
    fieldValues.value = {};
    if (!d) return;
    for (const f of d.fields) {
      fieldValues.value[f.name] = fieldModel(f);
    }
  },
  { immediate: true },
);

async function runConfigCheck() {
  if (!data.value || !supportsConfigCheck.value) return;
  checking.value = true;
  checkErr.value = "";
  checkLines.value = [];
  const values: Record<string, unknown> = {};
  try {
    for (const f of data.value.fields) {
      const raw = fieldValues.value[f.name] ?? "";
      values[f.name] = parseField(f, raw);
    }
    const r = await postPluginConfigCheck(pluginName.value, values);
    checkLines.value = r.lines;
    toastProbeLines(r.lines);
  } catch (e) {
    checkErr.value = axiosErrorDetail(e);
    toastApiError(e, "检测失败");
  } finally {
    checking.value = false;
  }
}

async function save() {
  if (!data.value) return;
  saving.value = true;
  err.value = "";
  const values: Record<string, unknown> = {};
  try {
    for (const f of data.value.fields) {
      const raw = fieldValues.value[f.name] ?? "";
      values[f.name] = parseField(f, raw);
    }
    data.value = await putPluginConfig(pluginName.value, values);
    toastSaveSuccess("配置已保存");
  } catch (e) {
    err.value = axiosErrorDetail(e);
    toastApiError(e, "保存失败");
    await nextTick();
    saveFeedbackRef.value?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="plugin-config-page">
    <p
      v-if="pluginName && data?.module"
      class="muted"
      style="margin: 0 0 12px; font-size: 13px"
    >
      {{ data.module }}
    </p>

    <div
      v-if="err && !data"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <ConsolePageSkeleton
      v-if="loading"
      :panels="2"
    />
    <template v-else>
    <div
      v-if="pluginName"
      class="panel"
      style="margin-bottom: 16px"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>帮助菜单
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/plugins" />
        </div>
      </div>
      <div class="panel__bd">
        <p
          v-if="helpMenuBusy && !pluginRow"
          class="muted"
        >
          加载帮助菜单状态…
        </p>
        <div
          v-else-if="helpMenuErr"
          class="alert alert--err"
        >
          {{ helpMenuErr }}
        </div>
        <template v-else-if="pluginRow">
          <label
            class="plugin-help-menu-label"
            :class="{ 'plugin-help-menu-label--disabled': pluginRow.help_ignored || helpMenuBusy }"
          >
            <input
              type="checkbox"
              :checked="showInHelpMenu"
              :disabled="helpMenuBusy || Boolean(pluginRow.help_ignored)"
              @click.prevent="void toggleHelpMenuVisible(!showInHelpMenu)"
            >
            <span>在「牛牛帮助」总列表中显示该插件</span>
          </label>
          <p
            v-if="pluginRow.help_ignored"
            class="muted"
            style="margin: 10px 0 0; line-height: 1.55"
          >
            该插件在帮助插件的 ignored_plugins 中，无法出现在帮助菜单。
          </p>
          <p
            v-else
            class="muted"
            style="margin: 10px 0 0; line-height: 1.55"
          >
            变更立即写入服务端；下一条「牛牛帮助」即按新列表渲染。
          </p>
        </template>
      </div>
    </div>

    <div
      v-if="data && data.plugin === pluginName"
      class="panel"
      style="margin-bottom: 16px"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>配置项定义
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/plugins" />
        </div>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0; line-height: 1.55">
          本页展示该插件已发布的 <strong style="color: var(--text)">{{ data.fields.length }}</strong> 个可配置项；表单与保存行为由服务端校验与落库。若列表为空，表示该模块未暴露可调参数或未注册 schema。
        </p>
      </div>
    </div>

    <div
      v-if="data"
      class="panel plugin-config-page__fields-panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>字段
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/plugins" />
          <button
            v-if="supportsConfigCheck"
            type="button"
            class="btn"
            :disabled="checking || saving"
            :aria-busy="checking || undefined"
            @click="runConfigCheck"
          >
            {{ checking ? "检测中…" : "配置检测" }}
          </button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="saving || checking"
            :aria-busy="saving || undefined"
            title="Ctrl+S"
            @click="save"
          >
            {{ saving ? "保存中…" : "保存" }}
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <div
          v-if="err"
          ref="saveFeedbackRef"
          class="plugin-config-page__save-feedback"
          role="alert"
          aria-live="assertive"
        >
          <div class="alert alert--err">
            {{ err }}
          </div>
        </div>
        <div
          v-if="supportsConfigCheck && (checkLines.length || checkErr)"
          class="plugin-config-page__check-feedback"
          role="status"
          aria-live="polite"
        >
          <div
            v-if="checkErr"
            class="alert alert--err"
          >
            {{ checkErr }}
          </div>
          <pre
            v-else-if="checkLines.length"
            class="plugin-config-page__check-output"
          >{{ checkLines.join("\n") }}</pre>
        </div>
        <p
          v-if="usesGatewayEditor"
          class="muted"
          style="margin: 0 0 16px; line-height: 1.55; font-size: 13px"
        >
          网关与全链路连通检测亦可前往
          <router-link to="/common-config?section=service_gateways">通用配置 → 服务网关</router-link>；
          本页「配置检测」仅探测画画网关。
        </p>
        <PallasImageGatewaysEditor
          v-if="usesGatewayEditor"
          :field-values="fieldValues"
          @update:field-values="onGatewayFieldValues"
        />
        <div
          v-for="f in visibleFields"
          :key="f.name"
          style="margin-bottom: 22px"
        >
          <div style="font-weight: 700; margin-bottom: 6px">
            {{ f.name }}
            <span class="muted" style="font-weight: 500">（{{ f.kind }}）</span>
          </div>
          <div class="muted" style="font-size: 13px; margin-bottom: 8px">
            {{ f.description }}
          </div>
          <div class="muted" style="font-size: 12px; margin-bottom: 8px">
            配置键: <code>{{ f.env_key }}</code>
            · 默认：{{ JSON.stringify(f.default) }}
          </div>
          <select
            v-if="f.kind === 'bool'"
            v-model="fieldValues[f.name]"
            class="sel"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          <select
            v-else-if="f.kind === 'enum' && f.choices?.length"
            v-model="fieldValues[f.name]"
            class="sel"
          >
            <option
              v-for="opt in f.choices"
              :key="opt"
              :value="opt"
            >
              {{ opt }}
            </option>
          </select>
          <JsonTextareaField
            v-else-if="f.kind === 'json'"
            v-model="fieldValues[f.name]"
            :title="`${data.plugin} · ${f.name}（JSON）`"
            :rows="6"
          />
          <input
            v-else
            v-model="fieldValues[f.name]"
            class="inp"
            style="max-width: 480px; width: 100%"
            type="text"
            :inputmode="f.kind === 'int' ? 'numeric' : f.kind === 'float' ? 'decimal' : undefined"
          >
        </div>
      </div>
    </div>
    </template>

  </div>
</template>

<style scoped>
.plugin-help-menu-label {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  cursor: pointer;
  font-weight: 600;
}
.plugin-help-menu-label--disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.plugin-config-page__save-feedback {
  margin-bottom: 16px;
}

.plugin-config-page__save-feedback .alert {
  margin: 0;
}

.plugin-config-page__check-feedback {
  margin-bottom: 16px;
}

.plugin-config-page__check-output {
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--radius, 8px);
  background: var(--surface-2, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
