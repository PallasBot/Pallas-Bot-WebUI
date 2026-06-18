<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import {
  fetchPluginConfig,
  fetchPluginGovernance,
  fetchPlugins,
  fetchPluginsGlobalDisable,
  fetchPluginsGroupFleetWhitelist,
  fetchPluginsHelpMenuVisibility,
  postPluginConfigCheck,
  putPluginConfig,
  putPluginGovernance,
  putPluginsGlobalDisable,
  putPluginsGroupFleetWhitelist,
  putPluginsHelpMenuVisibility,
} from "@/api/consoleApi";
import type {
  GroupFleetWhitelistEntry,
  PluginConfigCheckResult,
  PluginConfigData,
  PluginConfigField,
  PluginConfigFieldGroup,
  PluginGovernanceBody,
  PluginGovernanceData,
  PluginGovernanceMenuItem,
  PluginRow,
} from "@/api/pallasTypes";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer.vue";
import ConfigFieldGroupPanel from "@/components/config/ConfigFieldGroupPanel.vue";
import CmdPermMatrix from "@/components/config/CmdPermMatrix.vue";
import CmdLimitsTable from "@/components/config/CmdLimitsTable.vue";
import AiRuntimeSummaryPanel from "@/components/ai-config/AiRuntimeSummaryPanel.vue";
import PluginRuntimeSwitchRow from "@/components/config/PluginRuntimeSwitchRow.vue";
import RuntimeCheckResults from "@/components/config/RuntimeCheckResults.vue";
import PluginIcon from "@/components/PluginIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import PallasImageGatewaysEditor from "@/components/PallasImageGatewaysEditor.vue";
import { PALLAS_IMAGE_GATEWAY_FIELD_NAMES } from "@/utils/pallasImageGateways";
import { axiosErrorDetail } from "@/api/http";
import { toastApiError, toastProbeLines, toastSaveSuccess } from "@/utils/consoleToastFeedback";
import {
  buildAiRuntimeOverview,
  groupAiRuntimeSnapshot,
  resolveAiRuntimeSnapshot,
} from "@/utils/aiRuntimeResolver";
import {
  collectFieldValues,
  fieldValuesFromConfig,
} from "@/utils/pluginConfigFieldModel";
import { hasPluginSource, pluginSourceDir, pluginSourceLabel } from "@/utils/pluginSourceLabel";

const props = defineProps<{
  pluginName: string;
  iconUrl?: string | null;
}>();

const err = ref("");
const loading = ref(false);
const saving = ref(false);
const checking = ref(false);
const checkLines = ref<string[]>([]);
const checkResults = ref<PluginConfigCheckResult["results"]>([]);
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

// ── Governance (命令与能力) ──────────────────────────────
const governanceData = ref<PluginGovernanceData | null>(null);
const governanceLoading = ref(false);
const governanceSaving = ref(false);
const governanceErr = ref("");
const permSelections = ref<Record<string, string>>({});
const limitSelections = ref<Record<string, string>>({});
const commandsPanelOpen = ref(true);
const limitDebounceTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({});

const pluginName = computed(() => props.pluginName.trim());

const displayTitle = computed(
  () => pluginRow.value?.metadata?.name || data.value?.plugin || pluginName.value,
);

const displayDescription = computed(() => {
  const desc = (pluginRow.value?.metadata?.description || "").trim();
  if (desc) return desc;
  return (data.value?.module || pluginRow.value?.module || "").trim();
});

const metaLine = computed(() => {
  const parts: string[] = [];
  if (pluginName.value && pluginName.value !== displayTitle.value) {
    parts.push(pluginName.value);
  }
  if (data.value?.module && data.value.module !== displayDescription.value) {
    parts.push(data.value.module);
  }
  if (pluginRow.value && hasPluginSource(pluginRow.value)) {
    parts.push(`来源：${pluginSourceLabel(pluginRow.value.plugin_source)}`);
    const dir = pluginSourceDir(pluginRow.value);
    if (dir) parts.push(dir);
  }
  return parts.join(" · ");
});

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
const runtimeSnapshotItems = computed(() =>
  resolveAiRuntimeSnapshot({
    gatewayResults: checkResults.value,
    extensionTest: null,
  }),
);
const runtimeSnapshotGroups = computed(() => groupAiRuntimeSnapshot(runtimeSnapshotItems.value));
const runtimeSnapshotOverview = computed(() => buildAiRuntimeOverview(runtimeSnapshotItems.value));

// ── Governance computed ──────────────────────────────────

const commandsWithMenu = computed(() => {
  if (!governanceData.value) return [];
  const menuByPerm = new Map<string, PluginGovernanceMenuItem>();
  for (const m of governanceData.value.menu_items) {
    if (m.command_permission) menuByPerm.set(m.command_permission, m);
  }
  return governanceData.value.commands.map((cmd) => ({
    ...cmd,
    menu: menuByPerm.get(cmd.command_id) ?? null,
  }));
});

const permLevels = computed(() => governanceData.value?.perm_ui_filtered?.levels ?? []);
const permPlugin = computed(() => governanceData.value?.perm_ui_filtered?.plugins?.[0] ?? null);
const limitsPlugin = computed(() => governanceData.value?.limits_ui_filtered?.plugins?.[0] ?? null);

const commandMenuMap = computed(() => {
  const map = new Map<string, PluginGovernanceMenuItem>();
  for (const cmd of commandsWithMenu.value) {
    if (cmd.menu) map.set(cmd.command_id, cmd.menu);
  }
  return map;
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

// ── Governance functions ─────────────────────────────────

async function loadGovernance() {
  if (!pluginName.value) return;
  governanceLoading.value = true;
  governanceErr.value = "";
  try {
    const g = await fetchPluginGovernance(pluginName.value);
    governanceData.value = g;
    const permNext: Record<string, string> = {};
    const permPlugins = g.perm_ui_filtered?.plugins;
    if (permPlugins) {
      for (const pg of permPlugins) {
        for (const c of pg.commands) permNext[c.command_id] = c.effective_level;
      }
    }
    permSelections.value = permNext;
    const limitNext: Record<string, string> = {};
    const limitPlugins = g.limits_ui_filtered?.plugins;
    if (limitPlugins) {
      for (const pg of limitPlugins) {
        for (const c of pg.commands) limitNext[c.command_id] = String(c.effective_cd_sec);
      }
    }
    limitSelections.value = limitNext;
  } catch (e) {
    governanceErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    governanceLoading.value = false;
  }
}

async function persistGovernance() {
  if (!governanceData.value || governanceSaving.value) return;
  governanceSaving.value = true;
  governanceErr.value = "";
  try {
    const permOverrides: Record<string, string> = {};
    const permPlugins = governanceData.value.perm_ui_filtered?.plugins;
    if (permPlugins) {
      for (const pg of permPlugins) {
        for (const c of pg.commands) {
          const sel = permSelections.value[c.command_id] ?? c.effective_level;
          if (sel !== c.default_level) permOverrides[c.command_id] = sel;
        }
      }
    }
    const limitOverrides: Record<string, number> = {};
    const limitPlugins = governanceData.value.limits_ui_filtered?.plugins;
    if (limitPlugins) {
      for (const pg of limitPlugins) {
        for (const c of pg.commands) {
          const raw = (limitSelections.value[c.command_id] ?? String(c.effective_cd_sec)).trim();
          const parsed = Number.parseInt(raw === "" ? String(c.default_cd_sec) : raw, 10);
          const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : c.default_cd_sec;
          if (safe !== c.default_cd_sec) limitOverrides[c.command_id] = safe;
        }
      }
    }
    const body: PluginGovernanceBody = {
      command_permission_overrides: permOverrides,
      command_limit_overrides: limitOverrides,
      global_disable: isGloballyDisabled.value,
      help_hidden: !showInHelpMenu.value,
    };
    const result = await putPluginGovernance(pluginName.value, body);
    governanceData.value = { ...governanceData.value, ...result };
  } catch (e) {
    governanceErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    governanceSaving.value = false;
  }
}

async function onPermChange(commandId: string, newLevel: string) {
  permSelections.value = { ...permSelections.value, [commandId]: newLevel };
  await persistGovernance();
}

function onLimitInput(commandId: string, raw: string) {
  limitSelections.value = { ...limitSelections.value, [commandId]: raw };
  if (limitDebounceTimers.value[commandId]) clearTimeout(limitDebounceTimers.value[commandId]);
  limitDebounceTimers.value[commandId] = setTimeout(() => {
    void persistGovernance();
  }, 800);
}

const supportsConfigCheck = computed(() => pluginName.value === "draw");
const usesGatewayEditor = computed(() => pluginName.value === "draw");

const visibleFields = computed(() => {
  if (!data.value) return [];
  if (!usesGatewayEditor.value) return data.value.fields;
  const hidden = new Set<string>(PALLAS_IMAGE_GATEWAY_FIELD_NAMES);
  return data.value.fields.filter((f) => !hidden.has(f.name));
});

interface ConfigGroupView {
  id: string;
  title: string;
  fields: PluginConfigField[];
}

function fieldsForGroup(group: PluginConfigFieldGroup, fields: PluginConfigField[]): PluginConfigField[] {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const out: PluginConfigField[] = [];
  for (const name of group.field_names) {
    const field = byName.get(name);
    if (field) out.push(field);
  }
  return out;
}

const configFieldGroups = computed((): ConfigGroupView[] => {
  const fields = visibleFields.value;
  if (!fields.length) return [];
  const groups = data.value?.field_groups;
  if (groups?.length) {
    const mapped = groups
      .map((group) => ({
        id: group.id,
        title: group.title,
        fields: fieldsForGroup(group, fields),
      }))
      .filter((group) => group.fields.length);
    if (mapped.length) return mapped;
  }
  return [{ id: "all", title: "配置项", fields }];
});

const groupOpen = ref<Record<string, boolean>>({});
const runtimePanelOpen = ref(true);

function fieldGridCellClass(field: PluginConfigField): string {
  if (field.kind === "json") return "plugin-config-page__field-cell plugin-config-page__field-cell--wide";
  return "plugin-config-page__field-cell";
}

watch(
  configFieldGroups,
  (groups) => {
    const next = { ...groupOpen.value };
    for (const group of groups) {
      if (next[group.id] === undefined) {
        next[group.id] = true;
      }
    }
    groupOpen.value = next;
  },
  { immediate: true },
);

function toggleRuntimePanel() {
  runtimePanelOpen.value = !runtimePanelOpen.value;
}

function toggleConfigGroup(id: string) {
  groupOpen.value = { ...groupOpen.value, [id]: !groupOpen.value[id] };
}

function onGatewayFieldValues(next: Record<string, string>) {
  fieldValues.value = { ...fieldValues.value, ...next };
}

async function load() {
  if (!pluginName.value) {
    data.value = null;
    return;
  }
  const requestName = pluginName.value;
  loading.value = true;
  err.value = "";
  checkLines.value = [];
  checkResults.value = [];
  checkErr.value = "";
  data.value = null;
  try {
    const next = await fetchPluginConfig(requestName);
    if (pluginName.value !== requestName) return;
    data.value = next;
  } catch (e) {
    if (pluginName.value !== requestName) return;
    err.value = axiosErrorDetail(e);
    data.value = null;
  } finally {
    if (pluginName.value !== requestName) return;
    loading.value = false;
  }
  void loadHelpMenuState();
  void loadGovernance();
}

watch(
  () => props.pluginName,
  () => {
    pluginRow.value = null;
    governanceData.value = null;
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

const fieldValues = ref<Record<string, string>>({});

watch(
  data,
  (d) => {
    fieldValues.value = d ? fieldValuesFromConfig(d.fields) : {};
  },
  { immediate: true },
);

async function runConfigCheck() {
  if (!data.value || !supportsConfigCheck.value) return;
  checking.value = true;
  checkErr.value = "";
  checkLines.value = [];
  checkResults.value = [];
  try {
    const values = collectFieldValues(data.value.fields, fieldValues.value);
    const r = await postPluginConfigCheck(pluginName.value, values);
    checkLines.value = r.lines;
    checkResults.value = r.results;
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
  try {
    const values = collectFieldValues(data.value.fields, fieldValues.value);
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
  <div class="plugin-config-page plugin-config-workspace">
    <UiCard
      v-if="pluginName"
      class="plugin-config-page__card"
      :class="{ 'plugin-config-page__card--loading': loading }"
      glass
    >
      <div class="plugin-config-page__hero">
        <div class="plugin-config-page__hero-main">
          <PluginIcon
            :plugin-id="pluginName"
            :label="displayTitle"
            :icon-url="iconUrl"
            size="lg"
          />
          <div class="plugin-config-page__hero-text">
            <h2 class="plugin-config-page__hero-title">
              {{ displayTitle }}
            </h2>
            <p
              v-if="displayDescription && !loading"
              class="plugin-config-page__hero-desc"
            >
              {{ displayDescription }}
            </p>
            <p
              v-if="metaLine && !loading"
              class="muted plugin-config-page__hero-meta"
            >
              {{ metaLine }}
            </p>
          </div>
        </div>
        <div class="row-actions plugin-config-page__hero-actions">
          <UiButton
            v-if="supportsConfigCheck"
            variant="outline"
            :disabled="loading || checking || saving || !data"
            :busy="checking"
            @click="runConfigCheck"
          >
            {{ checking ? "检测中…" : "配置检测" }}
          </UiButton>
          <UiButton
            variant="primary"
            :disabled="loading || saving || checking || !data"
            :busy="saving"
            title="Ctrl+S"
            @click="save"
          >
            {{ saving ? "保存中…" : "保存" }}
          </UiButton>
        </div>
      </div>

      <div
        class="plugin-config-page__divider"
        aria-hidden="true"
      />

      <div
        v-if="loading"
        class="plugin-config-page__loading"
        aria-busy="true"
        aria-live="polite"
      >
        <span class="plugin-config-page__loading-text">加载配置…</span>
      </div>
      <div
        v-else-if="err && !data"
        class="plugin-config-page__card-bd"
      >
        <div class="alert alert--err">
          {{ err }}
        </div>
      </div>
      <div
        v-else-if="data"
        class="plugin-config-page__card-bd"
      >
          <p
            v-if="data.fields.length"
            class="muted plugin-config-page__fields-lead"
          >
            共 <strong style="color: var(--text)">{{ data.fields.length }}</strong> 个可配置项；保存后立即由服务端校验并落盘。
          </p>
          <p
            v-else
            class="muted plugin-config-page__fields-lead"
          >
            该插件未暴露可调参数或未注册 schema。
          </p>
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
          <div
            v-if="supportsConfigCheck && checkResults.length"
            class="plugin-config-page__check-feedback"
          >
            <AiRuntimeSummaryPanel
              v-if="runtimeSnapshotItems.length"
              :overview="runtimeSnapshotOverview"
              :groups="runtimeSnapshotGroups"
              variant="compact"
              show-hub-link
              class="plugin-config-page__runtime-summary"
            />
            <RuntimeCheckResults :results="checkResults" />
          </div>
          <ConfigFieldGroupPanel
            v-if="pluginRow"
            title="运行控制"
            :open="runtimePanelOpen"
            @toggle="toggleRuntimePanel"
          >
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
            <template v-else>
              <div
                v-if="globalDisableErr"
                class="alert alert--err"
                style="margin-bottom: 10px"
              >
                {{ globalDisableErr }}
              </div>
              <PluginRuntimeSwitchRow
                title="全实例禁用（所有牛牛、所有群）"
                :model-value="isGloballyDisabled"
                :disabled="globalDisableBusy || Boolean(pluginRow.global_disable_protected)"
                @update:model-value="void toggleGlobalDisable($event)"
              >
                <p
                  v-if="pluginRow.global_disable_protected"
                  class="muted"
                  style="margin: 0; line-height: 1.55"
                >
                  基础设施插件，不可全实例禁用。
                </p>
                <p
                  v-else
                  class="muted"
                  style="margin: 0; line-height: 1.55"
                >
                  开启后立即拦截该插件的 matcher，无需重启；与实例/群级「禁用插件」叠加生效。
                </p>
              </PluginRuntimeSwitchRow>
              <div
                v-if="showFleetWhitelistEditor"
                class="plugin-fleet-whitelist"
              >
                <div class="plugin-fleet-whitelist__title">
                  群白名单（豁免全实例禁用）
                </div>
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
                  <UiButton
                    variant="outline"
                    :disabled="fleetWhitelistBusy"
                    @click="void addGroupToFleetWhitelist()"
                  >
                    添加
                  </UiButton>
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
              <PluginRuntimeSwitchRow
                title="在「牛牛帮助」总列表中显示该插件"
                :model-value="showInHelpMenu"
                :disabled="helpMenuBusy || Boolean(pluginRow.help_ignored)"
                @update:model-value="void toggleHelpMenuVisible($event)"
              >
                <p
                  v-if="pluginRow.help_ignored"
                  class="muted"
                  style="margin: 0; line-height: 1.55"
                >
                  该插件在帮助插件的 ignored_plugins 中，无法出现在帮助菜单。
                </p>
                <p
                  v-else
                  class="muted"
                  style="margin: 0; line-height: 1.55"
                >
                  变更立即写入服务端；下一条「牛牛帮助」即按新列表渲染。
                </p>
              </PluginRuntimeSwitchRow>
            </template>
          </ConfigFieldGroupPanel>
          <ConfigFieldGroupPanel
            v-if="governanceData"
            title="命令与能力"
            :open="commandsPanelOpen"
            @toggle="commandsPanelOpen = !commandsPanelOpen"
          >
            <p v-if="governanceLoading" class="muted">加载命令配置…</p>
            <div v-else-if="governanceErr" class="alert alert--err">{{ governanceErr }}</div>
            <template v-else>
              <p class="muted" style="font-size: 13px; margin-bottom: 14px; line-height: 1.55">
                共 <strong style="color: var(--text)">{{ commandsWithMenu.length }}</strong> 个命令 · 热重载策略：<strong style="color: var(--text)">{{ governanceData.reload_policy ?? '无' }}</strong>；修改即自动保存。
              </p>

              <!-- 权限矩阵 -->
              <div v-if="permPlugin" style="margin-bottom: 20px">
                <h4 style="font-size: 14px; margin: 0 0 8px; font-weight: 700">命令权限</h4>
                <CmdPermMatrix
                  :levels="permLevels"
                  :plugins="[permPlugin]"
                  :selections="permSelections"
                  :command-menu-map="commandMenuMap"
                  :disabled="governanceSaving"
                  @change="onPermChange"
                />
              </div>

              <!-- CD 表 -->
              <div v-if="limitsPlugin">
                <h4 style="font-size: 14px; margin: 0 0 8px; font-weight: 700">命令冷却</h4>
                <CmdLimitsTable
                  :plugins="[limitsPlugin]"
                  :selections="limitSelections"
                  :disabled="governanceSaving"
                  @input="(cmdId, val) => onLimitInput(cmdId, val)"
                />
              </div>

              <p
                v-if="governanceSaving"
                class="muted"
                style="margin-top: 10px; font-size: 12px"
              >
                保存中…
              </p>
            </template>
          </ConfigFieldGroupPanel>
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
          <ConfigFieldGroupPanel
            v-for="group in configFieldGroups"
            :key="group.id"
            :title="group.title"
            :open="groupOpen[group.id] ?? true"
            :field-count="group.fields.length"
            grid
            @toggle="toggleConfigGroup(group.id)"
          >
            <div
              v-for="f in group.fields"
              :key="f.name"
              :class="fieldGridCellClass(f)"
            >
              <ConfigFieldRenderer
                :field="f"
                :model-value="fieldValues[f.name] ?? ''"
                :json-title="`${data.plugin} · ${f.name}（JSON）`"
                input-max-width="100%"
                @update:model-value="(v) => (fieldValues[f.name] = v)"
              />
            </div>
          </ConfigFieldGroupPanel>
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
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

.plugin-config-page__runtime-summary {
  margin-bottom: 14px;
}

</style>
