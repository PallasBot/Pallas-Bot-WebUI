<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import {
  fetchPluginConfig,
  fetchPlugins,
  fetchPluginsGlobalDisable,
  fetchPluginsGroupFleetWhitelist,
  fetchPluginsHelpMenuVisibility,
  postPluginConfigCheck,
  putPluginConfig,
  putPluginsGlobalDisable,
  putPluginsGroupFleetWhitelist,
  putPluginsHelpMenuVisibility,
} from "@/api/consoleApi";
import type {
  GroupFleetWhitelistEntry,
  PluginConfigData,
  PluginConfigField,
  PluginRow,
} from "@/api/pallasTypes";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import PallasImageGatewaysEditor from "@/components/PallasImageGatewaysEditor.vue";
import { PALLAS_IMAGE_GATEWAY_FIELD_NAMES } from "@/utils/pallasImageGateways";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { axiosErrorDetail } from "@/api/http";
import { toastApiError, toastProbeLines, toastSaveSuccess } from "@/utils/consoleToastFeedback";
import { boolChoiceLabel, enumChoiceLabel, fieldDisplayTitle } from "@/utils/configFieldDisplay";
import { hasPluginSource, pluginSourceDir, pluginSourceLabel } from "@/utils/pluginSourceLabel";

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
const globalDisabledList = ref<string[]>([]);
const globalDisableBusy = ref(false);
const globalDisableErr = ref("");
const fleetWhitelistEntries = ref<GroupFleetWhitelistEntry[]>([]);
const fleetWhitelistBusy = ref(false);
const fleetWhitelistErr = ref("");
const addWhitelistGroupInput = ref("");
const whitelistGroupAddHint = ref("");
const saveFeedbackRef = ref<HTMLElement | null>(null);

const showInHelpMenu = computed(() => {
  if (!pluginRow.value) return false;
  if (pluginRow.value.help_ignored) return false;
  return Boolean(pluginRow.value.help_visible ?? !pluginRow.value.help_hidden);
});

const isGloballyDisabled = computed(() => {
  const name = pluginName.value;
  return Boolean(name && globalDisabledList.value.includes(name));
});

const whitelistedGroupIds = computed(() => {
  const name = pluginName.value;
  if (!name) return [];
  return fleetWhitelistEntries.value
    .filter((entry) => entry.plugins.includes(name))
    .map((entry) => entry.group_id)
    .sort((a, b) => a - b);
});

const showFleetWhitelistEditor = computed(
  () => isGloballyDisabled.value || whitelistedGroupIds.value.length > 0,
);

async function loadHelpMenuState() {
  const name = pluginName.value;
  if (!name) return;
  helpMenuBusy.value = true;
  helpMenuErr.value = "";
  try {
    const [rows, vis, globalDisable, fleetWhitelist] = await Promise.all([
      fetchPlugins(),
      fetchPluginsHelpMenuVisibility(),
      fetchPluginsGlobalDisable(),
      fetchPluginsGroupFleetWhitelist(),
    ]);
    pluginRow.value = rows.find((r) => r.name === name) ?? null;
    helpMenuHiddenList.value = [...vis.hidden_plugins];
    helpMenuIgnoredList.value = [...vis.ignored_plugins];
    globalDisabledList.value = [...globalDisable.disabled_plugins];
    fleetWhitelistEntries.value = fleetWhitelist.entries.map((entry) => ({
      group_id: entry.group_id,
      plugins: [...entry.plugins],
    }));
  } catch (e) {
    helpMenuErr.value = e instanceof Error ? e.message : String(e);
    pluginRow.value = null;
  } finally {
    helpMenuBusy.value = false;
  }
}

function cloneFleetWhitelistEntries(): GroupFleetWhitelistEntry[] {
  return fleetWhitelistEntries.value.map((entry) => ({
    group_id: entry.group_id,
    plugins: [...entry.plugins],
  }));
}

async function persistFleetWhitelist(entries: GroupFleetWhitelistEntry[]) {
  fleetWhitelistBusy.value = true;
  fleetWhitelistErr.value = "";
  try {
    const out = await putPluginsGroupFleetWhitelist(entries);
    fleetWhitelistEntries.value = out.entries.map((entry) => ({
      group_id: entry.group_id,
      plugins: [...entry.plugins],
    }));
  } catch (e) {
    fleetWhitelistErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    fleetWhitelistBusy.value = false;
  }
}

async function addGroupToFleetWhitelist() {
  const name = pluginName.value;
  if (!name || fleetWhitelistBusy.value) return;
  whitelistGroupAddHint.value = "";
  const raw = addWhitelistGroupInput.value.trim();
  if (!raw) return;
  const groupId = parseInt(raw, 10);
  if (!Number.isFinite(groupId) || groupId < 1) {
    whitelistGroupAddHint.value = "请输入有效的群号。";
    return;
  }
  if (whitelistedGroupIds.value.includes(groupId)) {
    whitelistGroupAddHint.value = "该群已在白名单中。";
    return;
  }
  const entries = cloneFleetWhitelistEntries();
  const idx = entries.findIndex((entry) => entry.group_id === groupId);
  if (idx >= 0) {
    entries[idx] = {
      group_id: groupId,
      plugins: [...entries[idx].plugins, name].sort((a, b) => a.localeCompare(b)),
    };
  } else {
    entries.push({ group_id: groupId, plugins: [name] });
  }
  entries.sort((a, b) => a.group_id - b.group_id);
  addWhitelistGroupInput.value = "";
  await persistFleetWhitelist(entries);
}

async function removeGroupFromFleetWhitelist(groupId: number) {
  const name = pluginName.value;
  if (!name || fleetWhitelistBusy.value) return;
  const entries = cloneFleetWhitelistEntries()
    .map((entry) => {
      if (entry.group_id !== groupId) return entry;
      return {
        group_id: entry.group_id,
        plugins: entry.plugins.filter((plugin) => plugin !== name),
      };
    })
    .filter((entry) => entry.plugins.length > 0);
  await persistFleetWhitelist(entries);
}

async function toggleGlobalDisable(wantDisabled: boolean) {
  const name = pluginName.value;
  if (!name || !pluginRow.value?.name) return;
  if (pluginRow.value.global_disable_protected) return;
  globalDisableBusy.value = true;
  globalDisableErr.value = "";
  try {
    const set = new Set(globalDisabledList.value);
    if (wantDisabled) set.add(name);
    else set.delete(name);
    const out = await putPluginsGlobalDisable([...set].sort((a, b) => a.localeCompare(b)));
    globalDisabledList.value = [...out.disabled_plugins];
    const rows = await fetchPlugins({ bypassCache: true });
    pluginRow.value = rows.find((r) => r.name === name) ?? null;
  } catch (e) {
    globalDisableErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    globalDisableBusy.value = false;
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
const supportsConfigCheck = computed(() => pluginName.value === "draw");
const usesGatewayEditor = computed(() => pluginName.value === "draw");

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
    <div
      v-if="pluginName && data?.module"
      class="muted plugin-config-page__module"
    >
      <div>{{ data.module }}</div>
      <template v-if="pluginRow && hasPluginSource(pluginRow)">
        <div class="plugin-config-page__source-kind">
          来源：{{ pluginSourceLabel(pluginRow.plugin_source) }}
        </div>
        <div
          v-if="pluginSourceDir(pluginRow)"
          class="plugin-config-page__source-path"
        >
          {{ pluginSourceDir(pluginRow) }}
        </div>
      </template>
    </div>

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
          <div
            v-if="globalDisableErr"
            class="alert alert--err"
            style="margin-bottom: 10px"
          >
            {{ globalDisableErr }}
          </div>
          <label
            class="plugin-help-menu-label"
            :class="{
              'plugin-help-menu-label--disabled': globalDisableBusy || Boolean(pluginRow.global_disable_protected),
            }"
          >
            <input
              type="checkbox"
              :checked="isGloballyDisabled"
              :disabled="globalDisableBusy || Boolean(pluginRow.global_disable_protected)"
              @click.prevent="void toggleGlobalDisable(!isGloballyDisabled)"
            >
            <span>全实例禁用（所有牛牛、所有群）</span>
          </label>
          <p
            v-if="pluginRow.global_disable_protected"
            class="muted"
            style="margin: 10px 0 0; line-height: 1.55"
          >
            基础设施插件，不可全实例禁用。
          </p>
          <p
            v-else
            class="muted"
            style="margin: 10px 0 0; line-height: 1.55"
          >
            勾选后立即拦截该插件的 matcher，无需重启；与实例/群级「禁用插件」叠加生效。
          </p>
          <div
            v-if="showFleetWhitelistEditor"
            class="plugin-fleet-whitelist"
          >
            <div class="plugin-fleet-whitelist__title">群白名单（豁免全实例禁用）</div>
            <p class="muted plugin-fleet-whitelist__hint">
              输入群号后点击添加；白名单群仍可使用本插件。超管私聊为指定群开启时也会自动写入。
            </p>
            <div
              v-if="fleetWhitelistErr"
              class="alert alert--err"
              style="margin-bottom: 10px"
            >
              {{ fleetWhitelistErr }}
            </div>
            <div class="row-actions plugin-fleet-whitelist__add-row">
              <input
                v-model="addWhitelistGroupInput"
                class="inp"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                placeholder="群号"
                :disabled="fleetWhitelistBusy"
                @keydown.enter.prevent="void addGroupToFleetWhitelist()"
              >
              <button
                type="button"
                class="btn"
                :disabled="fleetWhitelistBusy"
                @click="void addGroupToFleetWhitelist()"
              >
                添加
              </button>
            </div>
            <p
              v-if="whitelistGroupAddHint"
              class="alert alert--err plugin-fleet-whitelist__hint-alert"
            >
              {{ whitelistGroupAddHint }}
            </p>
            <div
              v-if="whitelistedGroupIds.length"
              class="admin-chip-list"
            >
              <div
                v-for="groupId in whitelistedGroupIds"
                :key="`fleet-whitelist-${pluginName}-${groupId}`"
                class="admin-chip"
              >
                <span class="admin-chip__id">{{ groupId }}</span>
                <button
                  type="button"
                  class="admin-chip__rm"
                  :aria-label="`移除群白名单 ${groupId}`"
                  title="移除"
                  :disabled="fleetWhitelistBusy"
                  @click="void removeGroupFromFleetWhitelist(groupId)"
                >
                  ×
                </button>
              </div>
            </div>
            <p
              v-else
              class="muted plugin-fleet-whitelist__empty"
            >
              尚未添加群白名单。
            </p>
          </div>
          <label
            class="plugin-help-menu-label"
            style="margin-top: 14px"
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
            {{ fieldDisplayTitle(f) }}
            <span
              v-if="!f.label"
              class="muted"
              style="font-weight: 500"
            >（{{ f.kind }}）</span>
          </div>
          <div class="muted common-config-field-desc" style="font-size: 13px; margin-bottom: 8px; white-space: pre-line">
            {{ f.description }}
          </div>
          <div class="muted" style="font-size: 12px; margin-bottom: 8px">
            配置键: <code>{{ f.env_key }}</code>
            · 默认：{{ JSON.stringify(f.default) }}
          </div>
          <label
            v-if="f.kind === 'bool'"
            class="console-bool-switch"
            :class="{ 'console-bool-switch--on': fieldValues[f.name] === 'true' }"
          >
            <input
              type="checkbox"
              class="console-bool-switch__input"
              :checked="fieldValues[f.name] === 'true'"
              @change="fieldValues[f.name] = ($event.target as HTMLInputElement).checked ? 'true' : 'false'"
            >
            <span class="console-bool-switch__track" aria-hidden="true">
              <span class="console-bool-switch__thumb" />
            </span>
            <span class="console-bool-switch__label">{{ boolChoiceLabel(fieldValues[f.name]) }}</span>
          </label>
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
              {{ enumChoiceLabel(opt) }}
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

.plugin-fleet-whitelist {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}
.plugin-fleet-whitelist__title {
  font-weight: 700;
  margin-bottom: 6px;
}
.plugin-fleet-whitelist__hint {
  margin: 0 0 10px;
  line-height: 1.55;
  font-size: 13px;
}
.plugin-fleet-whitelist__add-row {
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
}
.plugin-fleet-whitelist__add-row .inp {
  max-width: 200px;
  min-width: 0;
  flex: 1 1 140px;
}
.plugin-fleet-whitelist__hint-alert {
  margin: 0 0 8px;
  padding: 8px 10px;
  font-size: 12px;
}
.plugin-fleet-whitelist__empty {
  margin: 4px 0 0;
  font-size: 12px;
}

@media (max-width: 560px) {
  .plugin-fleet-whitelist__add-row {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
  }

  .plugin-fleet-whitelist__add-row .inp {
    width: auto !important;
    flex: 1 1 0;
    min-width: 0 !important;
    max-width: min(11rem, calc(100% - 5.5rem)) !important;
  }

  .plugin-fleet-whitelist__add-row > .btn {
    width: auto !important;
    flex: 0 0 auto;
    padding: 6px 12px;
    font-size: 12px;
  }
}

.plugin-config-page__module {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
}
.plugin-config-page__source-kind {
  margin-top: 6px;
  font-size: 12px;
  color: var(--accent);
}
.plugin-config-page__source-path {
  margin-top: 2px;
  font-size: 11px;
  font-family: var(--font-mono, ui-monospace, monospace);
  word-break: break-all;
  opacity: 0.88;
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
