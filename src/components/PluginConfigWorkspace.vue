<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
import CmdPermMatrix from "@/components/config/CmdPermMatrix.vue";
import CmdLimitsTable from "@/components/config/CmdLimitsTable.vue";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer.vue";
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
import {
  buildGroupSummary,
  fieldDisplayName,
  fieldTypeLabel,
  summarizeFieldValue,
} from "@/utils/pluginConfigWorkspaceModel";
import { hasPluginSource, pluginSourceDir, pluginSourceLabel } from "@/utils/pluginSourceLabel";

const props = defineProps<{
  pluginName: string;
  iconUrl?: string | null;
  initialPluginRow?: PluginRow | null;
}>();

const err = ref("");
const loading = ref(false);
const saving = ref(false);
const checking = ref(false);
const checkLines = ref<string[]>([]);
const checkResults = ref<PluginConfigCheckResult["results"]>([]);
const checkErr = ref("");
const data = ref<PluginConfigData | null>(null);
const pluginRow = ref<PluginRow | null>(props.initialPluginRow ?? null);
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
const limitDebounceTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({});
const pluginConfigTab = ref<"runtime" | "perm" | "limit" | "config">("runtime");

const pluginName = computed(() => props.pluginName.trim());
const pluginResolvedId = computed(() => (pluginRow.value?.resolved_plugin_id || pluginName.value).trim());

const displayTitle = computed(
  () => pluginRow.value?.metadata?.name || data.value?.plugin || pluginResolvedId.value,
);

const displayDescription = computed(() => {
  const desc = (pluginRow.value?.metadata?.description || "").trim();
  if (desc) return desc;
  return (data.value?.module || pluginRow.value?.module || "").trim();
});

const metaLine = computed(() => {
  const parts: string[] = [];
  if (pluginResolvedId.value && pluginResolvedId.value !== displayTitle.value) {
    parts.push(pluginResolvedId.value);
  }
  const resolvedModule = (pluginRow.value?.resolved_module || data.value?.module || "").trim();
  if (resolvedModule && resolvedModule !== displayDescription.value) {
    parts.push(resolvedModule);
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
    for (const id of m.command_permissions ?? []) {
      if (id) menuByPerm.set(id, m);
    }
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
const showRuntimePanel = computed(() => Boolean(pluginResolvedId.value));
const hasPermConfig = computed(() => Boolean(permPlugin.value));
const hasLimitConfig = computed(() => Boolean(limitsPlugin.value));

watch(
  () => props.initialPluginRow,
  (row) => {
    if (row && (row.resolved_plugin_id || row.name) === pluginName.value) {
      pluginRow.value = row;
    }
  },
  { immediate: true },
);

async function loadHelpMenuState() {
  const name = pluginResolvedId.value;
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
    pluginRow.value = rows.find((r) => (r.resolved_plugin_id || r.name) === name) ?? null;
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
  const name = pluginResolvedId.value;
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
  const name = pluginResolvedId.value;
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
  const name = pluginResolvedId.value;
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
    pluginRow.value = rows.find((r) => (r.resolved_plugin_id || r.name) === name) ?? null;
  } catch (e) {
    globalDisableErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    globalDisableBusy.value = false;
  }
}

async function toggleHelpMenuVisible(wantVisible: boolean) {
  const name = pluginResolvedId.value;
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
    pluginRow.value = rows.find((r) => (r.resolved_plugin_id || r.name) === name) ?? null;
  } catch (e) {
    helpMenuErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    helpMenuBusy.value = false;
  }
}

// ── Governance functions ─────────────────────────────────

async function loadGovernance() {
  if (!pluginResolvedId.value) return;
  governanceLoading.value = true;
  governanceErr.value = "";
  try {
    const g = await fetchPluginGovernance(pluginResolvedId.value);
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
    const result = await putPluginGovernance(pluginResolvedId.value, body);
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

const supportsConfigCheck = computed(() => pluginResolvedId.value === "draw");
const usesGatewayEditor = computed(() => pluginResolvedId.value === "draw");

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

interface ConfigGroupViewModel extends ConfigGroupView {
  summary: ReturnType<typeof buildGroupSummary>;
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
const fieldPopoverHost = ref<HTMLElement | null>(null);
const activeFieldPopoverName = ref<string | null>(null);
const activeFieldPopoverMode = ref<"edit" | "help">("edit");
const fieldPopoverStyle = ref<Record<string, string>>({});
const fieldPopoverDraft = ref("");

const activeFieldPopover = computed(() => {
  const name = activeFieldPopoverName.value;
  if (!name) return null;
  for (const group of configGroupViewModels.value) {
    const field = group.fields.find((item) => item.name === name);
    if (field) return field;
  }
  return null;
});

function updateFieldPopoverPosition(anchor: HTMLElement) {
  if (typeof window === "undefined") return;
  const rect = anchor.getBoundingClientRect();
  const maxWidth = Math.min(360, window.innerWidth - 16);
  const left = Math.min(
    Math.max(8, rect.left),
    Math.max(8, window.innerWidth - maxWidth - 8),
  );
  const top = Math.min(rect.bottom + 10, window.innerHeight - 16);
  fieldPopoverStyle.value = {
    position: "fixed",
    top: `${top}px`,
    left: `${left}px`,
    width: `min(${maxWidth}px, calc(100vw - 16px))`,
  };
}

function openFieldPopover(fieldName: string, mode: "edit" | "help", event: MouseEvent) {
  const anchor = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  if (!anchor) return;
  if (activeFieldPopoverName.value === fieldName && activeFieldPopoverMode.value === mode) {
    closeFieldPopover();
    return;
  }
  activeFieldPopoverName.value = fieldName;
  activeFieldPopoverMode.value = mode;
  fieldPopoverDraft.value = fieldValues.value[fieldName] ?? "";
  updateFieldPopoverPosition(anchor);
}

function closeFieldPopover() {
  activeFieldPopoverName.value = null;
}

function saveFieldPopoverValue() {
  const field = activeFieldPopover.value;
  if (!field) return;
  fieldValues.value = { ...fieldValues.value, [field.name]: fieldPopoverDraft.value };
  closeFieldPopover();
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

function toggleConfigGroup(id: string) {
  groupOpen.value = { ...groupOpen.value, [id]: !groupOpen.value[id] };
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeFieldPopover();
  }
}

function onWindowPointerdown(event: MouseEvent) {
  if (!activeFieldPopover.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (fieldPopoverHost.value?.contains(target)) return;
  closeFieldPopover();
}

function onWindowResize() {
  closeFieldPopover();
}

function onGatewayFieldValues(next: Record<string, string>) {
  fieldValues.value = { ...fieldValues.value, ...next };
}

async function load() {
  if (!pluginResolvedId.value) {
    data.value = null;
    return;
  }
  const requestName = pluginResolvedId.value;
  loading.value = true;
  err.value = "";
  checkLines.value = [];
  checkResults.value = [];
  checkErr.value = "";
  data.value = null;
  try {
    const next = await fetchPluginConfig(requestName);
    if (pluginResolvedId.value !== requestName) return;
    data.value = next;
  } catch (e) {
    if (pluginResolvedId.value !== requestName) return;
    err.value = axiosErrorDetail(e);
    data.value = null;
  } finally {
    if (pluginResolvedId.value !== requestName) return;
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
  window.addEventListener("keydown", onWindowKeydown);
  window.addEventListener("mousedown", onWindowPointerdown);
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("scroll", onWindowResize, true);
  void load();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKeydown);
  window.removeEventListener("mousedown", onWindowPointerdown);
  window.removeEventListener("resize", onWindowResize);
  window.removeEventListener("scroll", onWindowResize, true);
  for (const timer of Object.values(limitDebounceTimers.value)) {
    clearTimeout(timer);
  }
});

useSaveHotkey(
  () => Boolean(data.value) && !loading.value && !saving.value && !checking.value,
  () => save(),
);

const fieldValues = ref<Record<string, string>>({});

const configGroupViewModels = computed((): ConfigGroupViewModel[] =>
  configFieldGroups.value.map((group) => ({
    ...group,
    summary: buildGroupSummary(group.fields, fieldValues.value),
  })),
);

watch(
  data,
  (d) => {
    fieldValues.value = d ? fieldValuesFromConfig(d.fields) : {};
    if (activeFieldPopover.value) {
      fieldPopoverDraft.value = d ? fieldValuesFromConfig(d.fields)[activeFieldPopover.value.name] ?? "" : "";
    }
  },
  { immediate: true },
);

watch(activeFieldPopover, (field) => {
  if (!field) return;
  fieldPopoverDraft.value = fieldValues.value[field.name] ?? "";
});

async function runConfigCheck() {
  if (!data.value || !supportsConfigCheck.value) return;
  checking.value = true;
  checkErr.value = "";
  checkLines.value = [];
  checkResults.value = [];
  try {
    const values = collectFieldValues(data.value.fields, fieldValues.value);
    const r = await postPluginConfigCheck(pluginResolvedId.value, values);
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
    data.value = await putPluginConfig(pluginResolvedId.value, values);
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
            :plugin-id="pluginResolvedId"
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
          <div class="plugin-config-page__tabs">
            <button
              type="button"
              class="plugin-config-page__tab"
              :class="{ 'plugin-config-page__tab--active': pluginConfigTab === 'runtime' }"
              @click="pluginConfigTab = 'runtime'"
            >
              运行控制
            </button>
            <button
              v-if="hasPermConfig"
              type="button"
              class="plugin-config-page__tab"
              :class="{ 'plugin-config-page__tab--active': pluginConfigTab === 'perm' }"
              @click="pluginConfigTab = 'perm'"
            >
              权限
            </button>
            <button
              v-if="hasLimitConfig"
              type="button"
              class="plugin-config-page__tab"
              :class="{ 'plugin-config-page__tab--active': pluginConfigTab === 'limit' }"
              @click="pluginConfigTab = 'limit'"
            >
              冷却
            </button>
            <button
              type="button"
              class="plugin-config-page__tab"
              :class="{ 'plugin-config-page__tab--active': pluginConfigTab === 'config' }"
              @click="pluginConfigTab = 'config'"
            >
              插件配置
            </button>
          </div>

          <p
            v-if="pluginConfigTab === 'config' && !data.fields.length"
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
          <section
            v-if="pluginConfigTab === 'runtime' && showRuntimePanel"
            class="plugin-config-page__tab-panel plugin-runtime-panel"
          >
            <header class="plugin-config-page__panel-head">
              <div>
                <h3 class="plugin-config-page__panel-title">运行控制</h3>
                <p class="muted plugin-config-page__panel-desc">
                  控制插件是否参与运行，以及是否出现在帮助菜单中。
                </p>
              </div>
            </header>
            <p
              v-if="helpMenuBusy && !pluginRow"
              class="muted"
            >
              加载帮助菜单状态…
            </p>
            <div
              v-else-if="!pluginRow"
              class="alert alert--err"
            >
              未能加载插件运行控制信息。
            </div>
            <div
              v-else-if="helpMenuErr"
              class="alert alert--err"
            >
              {{ helpMenuErr }}
            </div>
            <div
              v-else
              class="plugin-runtime-panel__list"
            >
              <div
                v-if="globalDisableErr"
                class="alert alert--err"
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
            </div>
          </section>
          <section
            v-if="pluginConfigTab === 'perm' || pluginConfigTab === 'limit'"
            class="plugin-config-page__tab-panel plugin-governance-panel"
          >
            <header class="plugin-config-page__panel-head">
              <div>
                <h3 class="plugin-config-page__panel-title">
                  {{ pluginConfigTab === "perm" ? "命令权限" : "命令冷却" }}
                </h3>
                <p class="muted plugin-config-page__panel-desc">
                  共 <strong style="color: var(--text)">{{ commandsWithMenu.length }}</strong> 个命令；
                  修改后自动保存并热重载。
                </p>
              </div>
              <span
                v-if="governanceData?.reload_policy"
                class="plugin-config-page__panel-badge"
              >
                {{ governanceData.reload_policy }}
              </span>
            </header>
            <p v-if="governanceLoading" class="muted">加载命令配置…</p>
            <div v-else-if="governanceErr" class="alert alert--err">{{ governanceErr }}</div>
            <p
              v-else-if="!governanceData"
              class="muted plugin-config-page__governance-empty"
            >
              该插件暂无命令权限或冷却声明。
            </p>
            <template v-else>
              <CmdPermMatrix
                v-if="pluginConfigTab === 'perm' && permPlugin"
                :levels="permLevels"
                :plugins="[permPlugin]"
                :selections="permSelections"
                :command-menu-map="commandMenuMap"
                :disabled="governanceSaving"
                @change="onPermChange"
              />
              <CmdLimitsTable
                v-if="pluginConfigTab === 'limit' && limitsPlugin"
                :plugins="[limitsPlugin]"
                :selections="limitSelections"
                :disabled="governanceSaving"
                @input="(cmdId, val) => onLimitInput(cmdId, val)"
              />
              <p
                v-if="governanceSaving"
                class="muted plugin-config-page__governance-saving"
              >
                保存中…
              </p>
            </template>
          </section>
          <p
            v-if="pluginConfigTab === 'config' && usesGatewayEditor"
            class="muted"
            style="margin: 0 0 16px; line-height: 1.55; font-size: 13px"
          >
            网关与全链路连通检测亦可前往
            <router-link to="/common-config?section=service_gateways">通用配置 → 服务网关</router-link>；
            本页「配置检测」仅探测画画网关。
          </p>
          <PallasImageGatewaysEditor
            v-if="pluginConfigTab === 'config' && usesGatewayEditor"
            :field-values="fieldValues"
            @update:field-values="onGatewayFieldValues"
          />
          <section v-if="pluginConfigTab === 'config'" class="plugin-config-groups">
            <section
              v-for="group in configGroupViewModels"
              :key="group.id"
              class="plugin-config-group-card"
            >
              <button
                type="button"
                class="plugin-config-group-card__hero"
                :aria-expanded="groupOpen[group.id] ?? true"
                @click="toggleConfigGroup(group.id)"
              >
                  <div class="plugin-config-group-card__hero-main">
                  <div class="plugin-config-group-card__hero-text">
                    <h4 class="plugin-config-group-card__title">{{ group.title }}</h4>
                    <p class="plugin-config-group-card__desc">
                      共 {{ group.summary.total }} 项，已填写 {{ group.summary.filled }} 项
                      <template v-if="group.summary.required">
                        · 必填 {{ group.summary.requiredFilled }}/{{ group.summary.required }}
                      </template>
                    </p>
                  </div>
                </div>
                <div class="plugin-config-group-card__hero-side">
                  <div class="plugin-config-group-card__chips">
                    <span class="plugin-config-group-card__chip">
                      {{ group.summary.filled ? "已配置" : "待配置" }}
                    </span>
                    <span
                      v-if="group.summary.required"
                      class="plugin-config-group-card__chip plugin-config-group-card__chip--soft"
                    >
                      必填 {{ group.summary.requiredFilled }}/{{ group.summary.required }}
                    </span>
                  </div>
                  <span class="plugin-config-group-card__toggle">
                    {{ (groupOpen[group.id] ?? true) ? "收起" : "展开" }}
                  </span>
                </div>
              </button>

              <div v-show="groupOpen[group.id] ?? true" class="plugin-config-field-list">
                <section
                  v-for="f in group.fields"
                  :key="f.name"
                  class="plugin-config-field-card"
                >
                  <div class="plugin-config-field-card__row">
                    <div class="plugin-config-field-card__main">
                      <div class="plugin-config-field-card__head">
                        <div class="plugin-config-field-card__title-wrap">
                          <div class="plugin-config-field-card__name-wrap">
                            <h4 class="plugin-config-field-card__title">
                              {{ fieldDisplayName(f) }}
                            </h4>
                            <span
                              v-if="f.required"
                              class="plugin-config-field-card__required"
                            >必填</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          class="plugin-config-field-card__help-btn"
                          :aria-expanded="activeFieldPopoverName === f.name && activeFieldPopoverMode === 'help'"
                          :aria-label="`查看 ${fieldDisplayName(f)} 说明`"
                          @click.stop="openFieldPopover(f.name, 'help', $event)"
                        >
                          ?
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      class="plugin-config-field-card__editor-button"
                      :aria-expanded="activeFieldPopoverName === f.name && activeFieldPopoverMode === 'edit'"
                      @click.stop="openFieldPopover(f.name, 'edit', $event)"
                    >
                      <span class="plugin-config-field-card__editor-value">
                        {{ summarizeFieldValue(f, fieldValues[f.name] ?? "") }}
                      </span>
                      <span class="plugin-config-field-card__editor-action">编辑</span>
                    </button>
                  </div>
                </section>
              </div>
            </section>
          </section>
          <Teleport to="body">
            <div
              v-if="activeFieldPopover"
              ref="fieldPopoverHost"
              class="plugin-config-field-popover"
              :style="fieldPopoverStyle"
              @click.stop
            >
              <template v-if="activeFieldPopoverMode === 'help'">
                <div class="plugin-config-field-popover__section">
                  <div class="plugin-config-field-popover__eyebrow">配置说明</div>
                  <h4 class="plugin-config-field-popover__title">{{ fieldDisplayName(activeFieldPopover) }}</h4>
                  <p
                    v-if="activeFieldPopover.description"
                    class="plugin-config-field-popover__desc"
                  >
                    {{ activeFieldPopover.description }}
                  </p>
                  <p
                    v-else
                    class="plugin-config-field-popover__desc plugin-config-field-popover__desc--muted"
                  >
                    暂无详细说明。
                  </p>
                </div>
                <dl class="plugin-config-field-popover__meta">
                  <div>
                    <dt>类型</dt>
                    <dd>{{ fieldTypeLabel(activeFieldPopover) }}</dd>
                  </div>
                  <div>
                    <dt>默认值</dt>
                    <dd><code>{{ JSON.stringify(activeFieldPopover.default) }}</code></dd>
                  </div>
                  <div>
                    <dt>环境键</dt>
                    <dd><code>{{ activeFieldPopover.env_key }}</code></dd>
                  </div>
                </dl>
              </template>
              <template v-else>
                <div class="plugin-config-field-popover__section">
                  <div class="plugin-config-field-popover__eyebrow">编辑配置</div>
                  <h4 class="plugin-config-field-popover__title">{{ fieldDisplayName(activeFieldPopover) }}</h4>
                </div>
                <ConfigFieldRenderer
                  :field="activeFieldPopover"
                  :model-value="fieldPopoverDraft"
                  :show-label="false"
                  :show-meta="false"
                  :show-description="false"
                  input-max-width="100%"
                  @update:model-value="fieldPopoverDraft = $event"
                />
                <div class="plugin-config-field-popover__actions">
                  <button
                    type="button"
                    class="btn btn--primary"
                    @click="saveFieldPopoverValue"
                  >
                    确定
                  </button>
                  <button
                    type="button"
                    class="btn"
                    @click="closeFieldPopover"
                  >
                    取消
                  </button>
                </div>
              </template>
            </div>
          </Teleport>
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

  .plugin-config-group-card__hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .plugin-config-group-card__hero-side,
  .plugin-config-group-card__chips {
    width: 100%;
  }

  .plugin-config-field-card {
    padding: 12px;
    border-radius: 16px;
  }

  .plugin-config-field-card__row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .plugin-config-field-card__head {
    align-items: flex-start;
  }

  .plugin-config-field-card__title-wrap,
  .plugin-config-field-card__name-wrap {
    flex-wrap: wrap;
    gap: 6px;
  }

  .plugin-config-group-card__hero-main {
    width: 100%;
  }

  .plugin-config-field-card__summary {
    white-space: normal;
  }

  .plugin-config-page__panel-head {
    flex-direction: column;
  }

  .plugin-config-page__panel-badge {
    align-self: flex-start;
  }
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

.plugin-config-page__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.plugin-config-page__tab-panel {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
  padding: 14px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.1)) 78%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.05)) 70%, transparent), transparent 62%),
    color-mix(in srgb, var(--surface-1, rgba(255, 255, 255, 0.02)) 98%, transparent);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--shadow, rgba(15, 23, 42, 0.08)) 30%, transparent);
}

.plugin-config-page__panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.plugin-config-page__panel-title {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
  font-weight: 700;
}

.plugin-config-page__panel-desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.55;
}

.plugin-config-page__panel-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  color: color-mix(in srgb, var(--accent, #ec4899) 82%, var(--text, #fff) 10%);
  background: color-mix(in srgb, var(--accent, #ec4899) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent, #ec4899) 18%, transparent);
}

.plugin-config-page__governance-empty,
.plugin-config-page__governance-saving {
  font-size: 13px;
  line-height: 1.55;
}

.plugin-runtime-panel__list {
  display: grid;
  gap: 12px;
}

.plugin-config-page__tab {
  min-height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.1)) 74%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.02)) 70%, transparent), transparent 72%),
    color-mix(in srgb, var(--surface-1, rgba(255, 255, 255, 0.018)) 99%, transparent);
  color: var(--text-muted, rgba(255, 255, 255, 0.74));
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.plugin-config-page__tab--active {
  border-color: color-mix(in srgb, var(--accent, #ec4899) 16%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent, #ec4899) 9%, white 2%), transparent 78%),
    color-mix(in srgb, var(--accent, #ec4899) 7%, transparent);
  color: color-mix(in srgb, var(--accent, #ec4899) 84%, var(--text, #fff) 10%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 14%, transparent),
    0 4px 12px color-mix(in srgb, var(--accent, #ec4899) 8%, transparent);
}

.plugin-config-page__tab:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.1)) 62%, transparent);
}

.plugin-config-field-list {
  display: grid;
  gap: 12px;
}

.plugin-config-groups {
  display: grid;
  gap: 14px;
}

.plugin-config-group-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.04)) 68%, transparent), transparent 64%),
    color-mix(in srgb, var(--surface-1, rgba(255, 255, 255, 0.02)) 98%, transparent);
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.1)) 78%, transparent);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--shadow, rgba(15, 23, 42, 0.08)) 24%, transparent);
}

.plugin-config-group-card__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.plugin-config-group-card__hero-main {
  display: flex;
  align-items: flex-start;
  min-width: 0;
}

.plugin-config-group-card__hero-text {
  min-width: 0;
}

.plugin-config-group-card__title {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
  font-weight: 700;
}

.plugin-config-group-card__desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-muted, rgba(255, 255, 255, 0.68));
}

.plugin-config-group-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.plugin-config-group-card__hero-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.plugin-config-group-card__chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: color-mix(in srgb, var(--accent, #ec4899) 82%, var(--text, #fff) 10%);
  background: color-mix(in srgb, var(--accent, #ec4899) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent, #ec4899) 18%, transparent);
}

.plugin-config-group-card__chip--soft {
  color: var(--text-muted, rgba(255, 255, 255, 0.72));
  background: color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.06)) 92%, transparent);
  border-color: color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.1)) 84%, transparent);
}

.plugin-config-group-card__toggle {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, rgba(255, 255, 255, 0.72));
  white-space: nowrap;
}

.plugin-config-field-card {
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 76%, transparent);
  border-radius: 16px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.04)) 72%, transparent), transparent 66%),
    color-mix(in srgb, var(--surface-1, rgba(255, 255, 255, 0.018)) 98%, transparent);
  padding: 14px 16px;
}

.plugin-config-field-card__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 42%);
  gap: 10px;
  align-items: start;
}

.plugin-config-field-card__main { min-width: 0; }

.plugin-config-field-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.plugin-config-field-card__title-wrap {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
}

.plugin-config-field-card__name-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.plugin-config-field-card__title {
  margin: 0;
  font-size: 14px;
  line-height: 1.35;
  font-weight: 700;
}

.plugin-config-field-card__summary {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted, rgba(255, 255, 255, 0.7));
}

.plugin-config-field-card__required {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  line-height: 1;
  color: #7b2717;
  background: rgba(255, 214, 163, 0.9);
}

.plugin-config-field-card__help-btn {
  width: 26px;
  height: 26px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.12)) 82%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.035)) 95%, transparent);
  color: color-mix(in srgb, var(--accent, #ec4899) 72%, var(--text, #fff) 18%);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.plugin-config-field-card__help-btn:hover,
.plugin-config-field-card__help-btn[aria-expanded="true"] {
  border-color: color-mix(in srgb, var(--accent, #ec4899) 20%, transparent);
  background: color-mix(in srgb, var(--accent, #ec4899) 8%, transparent);
}

.plugin-config-field-card__editor-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.1)) 82%, transparent);
  background: color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.03)) 95%, transparent);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.plugin-config-field-card__editor-button:hover,
.plugin-config-field-card__editor-button[aria-expanded="true"] {
  border-color: color-mix(in srgb, var(--accent, #ec4899) 22%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent, #ec4899) 5%, transparent), transparent 76%),
    color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.03)) 95%, transparent);
}

.plugin-config-field-card__editor-value {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text, #fff);
}

.plugin-config-field-card__editor-action {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  color: color-mix(in srgb, var(--accent, #ec4899) 76%, var(--text, #fff) 16%);
}

.plugin-config-field-popover {
  z-index: 60;
  display: grid;
  gap: 14px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.12)) 78%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent, #ec4899) 4%, transparent), transparent 82%),
    color-mix(in srgb, var(--surface, rgba(20, 22, 32, 0.96)) 98%, rgba(10, 12, 18, 0.9));
  color: var(--text, #fff);
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.32),
    0 2px 10px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(18px);
}

.plugin-config-field-popover__section {
  display: grid;
  gap: 6px;
}

.plugin-config-field-popover__eyebrow {
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--accent, #ec4899) 74%, var(--text, #fff) 14%);
}

.plugin-config-field-popover__title {
  margin: 0;
  font-size: 14px;
  line-height: 1.35;
  font-weight: 700;
}

.plugin-config-field-popover__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.plugin-config-field-popover__desc--muted {
  color: var(--text-muted, rgba(255, 255, 255, 0.66));
}

.plugin-config-field-popover__meta {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-top: 2px;
  border-top: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.1)) 60%, transparent);
}

.plugin-config-field-popover__meta > div {
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 10px;
}

.plugin-config-field-popover__meta dt {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted, rgba(255, 255, 255, 0.64));
}

.plugin-config-field-popover__meta dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  word-break: break-word;
}

.plugin-config-field-popover__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}

.plugin-config-field-popover :deep(.form-field__control),
.plugin-config-field-popover :deep(.inp),
.plugin-config-field-popover :deep(.sel),
.plugin-config-field-popover :deep(.textarea),
.plugin-config-field-popover :deep(.json-textarea-field__peek) {
  color: var(--text, #fff);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.05)) 75%, transparent), transparent 78%),
    color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.04)) 98%, transparent);
}

.plugin-config-field-popover :deep(.form-field__control::placeholder),
.plugin-config-field-popover :deep(.inp::placeholder),
.plugin-config-field-popover :deep(.textarea::placeholder) {
  color: var(--text-muted, rgba(255, 255, 255, 0.54));
}

@media (max-width: 560px) {
  .plugin-config-field-popover {
    gap: 12px;
    padding: 12px;
    border-radius: 16px;
  }

  .plugin-config-field-popover__meta > div {
    grid-template-columns: 48px 1fr;
    gap: 8px;
  }
}

</style>
