<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import {
  fetchPluginConfig,
  fetchPluginBundledReadme,
  fetchPluginConfigRaw,
  fetchPluginGovernance,
  fetchPluginStoreReadme,
  fetchPlugins,
  fetchPluginsGroupFleetWhitelist,
  postPluginConfigCheck,
  putPluginConfig,
  putPluginConfigRaw,
  putPluginGovernance,
  putPluginsGroupFleetWhitelist,
} from "@/api/consoleApi";
import type {
  GroupFleetWhitelistEntry,
  PluginConfigCheckResult,
  PluginConfigData,
  PluginGovernanceBody,
  PluginGovernanceData,
  PluginGovernanceMenuItem,
  PluginRow,
} from "@/api/pallasTypes";
import PluginConfigFieldDialog from "@/components/config/PluginConfigFieldDialog.vue";
import DynamicConfigPanel from "@/components/config/DynamicConfigPanel.vue";
import AiRuntimeSummaryPanel from "@/components/ai-config/AiRuntimeSummaryPanel.vue";
import PluginGovernancePanel from "@/components/PluginGovernancePanel.vue";
import HelpImagePreview from "@/components/HelpImagePreview.vue";
import ReadmeMarkdown from "@/components/ReadmeMarkdown.vue";
import RuntimeCheckResults from "@/components/config/RuntimeCheckResults.vue";
import PluginIcon from "@/components/PluginIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import PallasImageGatewaysEditor from "@/components/PallasImageGatewaysEditor.vue";
import { PALLAS_IMAGE_GATEWAY_FIELD_NAMES } from "@/utils/pallasImageGateways";
import { axiosErrorDetail, catchAllApiHint, isCatchAllApiError } from "@/api/http";
import { toastApiError, toastProbeLines, toastSaveSuccess } from "@/utils/consoleToastFeedback";
import {
  buildAiRuntimeOverview,
  groupAiRuntimeSnapshot,
  resolveAiRuntimeSnapshot,
} from "@/utils/aiRuntimeResolver";
import {
  collectFieldValues,
  configValuesFingerprint,
  fieldValuesFromConfig,
  savedConfigFingerprint,
} from "@/utils/pluginConfigFieldModel";
import { usePluginConfigFieldPopover } from "@/composables/usePluginConfigFieldPopover";
import {
  resolveInitialPluginConfigTab,
  type PluginConfigTab,
} from "@/utils/pluginConfigWorkspaceModel";
import { hasPluginSource, pluginSourceDir, pluginSourceLabel } from "@/utils/pluginSourceLabel";
import type { PluginReadmeTarget } from "@/utils/pluginReadmeTarget";
import {
  normalizeBundledReadmeMarkdown,
  readmeMarkdownToSafeHtml,
} from "@/utils/pluginReadme";
import {
  AI_ENTRY_PLUGIN_CONFIG_CHECK,
  AI_ENTRY_RUNTIME,
  AI_ENTRY_SITE_GATEWAY_CHECK,
} from "@/config/aiEntrySemantics";
import { extensionActivationDetailHint } from "@/config/extensionActivationSemantics";
import type { ExtensionActivationPolicy } from "@/api/pallasTypes";

const props = withDefaults(
  defineProps<{
    pluginName: string;
    iconUrl?: string | null;
    initialPluginRow?: PluginRow | null;
    presentation?: "page" | "dialog";
    readmeTarget?: PluginReadmeTarget | null;
  }>(),
  {
    presentation: "page",
    readmeTarget: null,
  },
);

const err = ref("");
const loading = ref(false);
const saving = ref(false);
const checking = ref(false);
const checkLines = ref<string[]>([]);
const checkResults = ref<PluginConfigCheckResult["results"]>([]);
const checkErr = ref("");
const data = ref<PluginConfigData | null>(null);
const pluginRow = ref<PluginRow | null>(props.initialPluginRow ?? null);
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
const pluginConfigTab = ref<PluginConfigTab>("governance");
const readmeHtml = ref("");
const readmeLoading = ref(false);
const readmeErr = ref("");

const isDialogPresentation = computed(() => props.presentation === "dialog");
const configShellComponent = computed(() => (isDialogPresentation.value ? "div" : UiCard));
const configShellClass = computed(() =>
  isDialogPresentation.value
    ? ["plugin-config-workspace__body", { "plugin-config-workspace__body--loading": loading.value }]
    : ["plugin-config-page__card", { "plugin-config-page__card--loading": loading.value }],
);
const configShellBind = computed(() => (isDialogPresentation.value ? {} : { glass: true }));
const showReadmeTab = computed(() => isDialogPresentation.value);

const pluginName = computed(() => props.pluginName.trim());
const isHelpPlugin = computed(() => pluginName.value === "help");
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

const activationPolicyHint = computed(() => {
  const policy = governanceData.value?.activation_policy as ExtensionActivationPolicy | null | undefined;
  if (!policy) return "";
  return extensionActivationDetailHint(policy);
});

const showInHelpMenu = computed(() => {
  const runtime = governanceData.value?.runtime;
  if (runtime?.help_ignored) return false;
  if (runtime) return !runtime.help_hidden;
  if (!pluginRow.value) return false;
  if (pluginRow.value.help_ignored) return false;
  return Boolean(pluginRow.value.help_visible ?? !pluginRow.value.help_hidden);
});

const isGloballyDisabled = computed(() => {
  const runtime = governanceData.value?.runtime;
  if (runtime) return runtime.global_disable;
  return Boolean(pluginRow.value?.globally_disabled);
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
const hasGovernanceTab = computed(() => Boolean(showRuntimePanel.value || hasPermConfig.value || hasLimitConfig.value));
const globalDisableProtected = computed(
  () => Boolean(governanceData.value?.runtime?.global_disable_protected ?? pluginRow.value?.global_disable_protected),
);
const helpIgnored = computed(
  () => Boolean(governanceData.value?.runtime?.help_ignored ?? pluginRow.value?.help_ignored),
);

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
const hasConfigFields = computed(() => Boolean(data.value?.fields.length));

watch(
  () => props.initialPluginRow,
  (row) => {
    if (row && (row.resolved_plugin_id || row.name) === pluginName.value) {
      pluginRow.value = row;
    }
  },
  { immediate: true },
);

async function loadRuntimeContext() {
  const name = pluginResolvedId.value;
  if (!name) return;
  try {
    const [rows, fleetWhitelist] = await Promise.all([
      fetchPlugins(),
      fetchPluginsGroupFleetWhitelist(),
    ]);
    pluginRow.value = rows.find((r) => (r.resolved_plugin_id || r.name) === name) ?? null;
    fleetWhitelistEntries.value = fleetWhitelist.entries.map((entry) => ({
      group_id: entry.group_id,
      plugins: [...entry.plugins],
    }));
  } catch (e) {
    governanceErr.value = governanceErr.value || (e instanceof Error ? e.message : String(e));
    pluginRow.value = null;
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

async function toggleGovernanceRuntime(kind: "global_disable" | "help_hidden", nextValue: boolean) {
  if (!governanceData.value) return;
  if (kind === "global_disable" && globalDisableProtected.value) return;
  if (kind === "help_hidden" && helpIgnored.value) return;
  const previous = governanceData.value.runtime[kind];
  governanceData.value = {
    ...governanceData.value,
    runtime: {
      ...governanceData.value.runtime,
      [kind]: nextValue,
    },
  };
  const ok = await persistGovernance();
  if (!ok) {
    governanceData.value = {
      ...governanceData.value,
      runtime: {
        ...governanceData.value.runtime,
        [kind]: previous,
      },
    };
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
    governanceErr.value = isCatchAllApiError(e)
      ? catchAllApiHint()
      : axiosErrorDetail(e);
  } finally {
    governanceLoading.value = false;
  }
}

async function persistGovernance(): Promise<boolean> {
  if (!governanceData.value || governanceSaving.value) return false;
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
      global_disable: Boolean(governanceData.value.runtime.global_disable),
      help_hidden: Boolean(governanceData.value.runtime.help_hidden),
    };
    const result = await putPluginGovernance(pluginResolvedId.value, body);
    governanceData.value = { ...governanceData.value, ...result };
    const rows = await fetchPlugins({ bypassCache: true });
    pluginRow.value = rows.find((r) => (r.resolved_plugin_id || r.name) === pluginResolvedId.value) ?? null;
    return true;
  } catch (e) {
    governanceErr.value = e instanceof Error ? e.message : String(e);
    return false;
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

type ConfigEditMode = "form" | "raw";

const configEditMode = ref<ConfigEditMode>("form");
const rawToml = ref("");
const savedRawToml = ref("");

const configDirty = computed(() => {
  if (!data.value) return false;
  if (configEditMode.value === "raw") {
    return rawToml.value !== savedRawToml.value;
  }
  return (
    configValuesFingerprint(data.value.fields, fieldValues.value) !==
    savedConfigFingerprint(data.value.fields)
  );
});

const {
  fieldPopoverHost,
  activeFieldPopoverName,
  activeFieldPopover,
  activeFieldDialog,
  activeFieldDialogMode,
  fieldPopoverStyle,
  fieldDisplayName,
  fieldHelpDefaultValue,
  fieldTypeLabel,
  onFieldHelpClick,
  onFieldHelpHover,
  onFieldEditClick,
  onHelpHoverLeave,
  onPopoverEnter,
  onFieldDialogEditRequest,
  closeFieldDialog,
  closeFieldInteraction,
} = usePluginConfigFieldPopover(() => visibleFields.value);

async function ensureRawTomlLoaded() {
  if (!pluginResolvedId.value) return;
  const text = await fetchPluginConfigRaw(pluginResolvedId.value);
  rawToml.value = text;
  savedRawToml.value = text;
}

async function switchConfigEditMode(mode: ConfigEditMode) {
  if (mode === configEditMode.value) return;
  if (configDirty.value) {
    const ok = window.confirm("当前有未保存的修改，切换编辑模式将丢弃这些更改。继续？");
    if (!ok) return;
  }
  configEditMode.value = mode;
  if (mode === "raw") {
    await ensureRawTomlLoaded();
    return;
  }
  if (data.value) {
    fieldValues.value = fieldValuesFromConfig(data.value.fields);
  }
}

function onConfigBeforeUnload(ev: BeforeUnloadEvent) {
  if (!configDirty.value) return;
  ev.preventDefault();
  ev.returnValue = "";
}

function onGatewayFieldValues(next: Record<string, string>) {
  fieldValues.value = { ...fieldValues.value, ...next };
}

async function load() {
  if (!pluginResolvedId.value) {
    data.value = null;
    closeFieldInteraction();
    return;
  }
  const requestName = pluginResolvedId.value;
  loading.value = true;
  err.value = "";
  closeFieldInteraction();
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
  void loadRuntimeContext();
  void loadGovernance();
}

async function loadReadme() {
  readmeLoading.value = true;
  readmeErr.value = "";
  readmeHtml.value = "";
  const pluginId = pluginResolvedId.value;
  try {
    try {
      const bundled = await fetchPluginBundledReadme(pluginId);
      if (bundled.markdown.trim()) {
        const normalized = normalizeBundledReadmeMarkdown(bundled.markdown, pluginId);
        readmeHtml.value = readmeMarkdownToSafeHtml(normalized);
        return;
      }
    } catch {
      // fall through to store readme
    }

    const target = props.readmeTarget;
    if (!target) {
      readmeErr.value = "暂无 README 来源";
      return;
    }
    const md = await fetchPluginStoreReadme(target.kind, target.id, {
      repositoryUrl: target.repositoryUrl,
    });
    readmeHtml.value = readmeMarkdownToSafeHtml(md, target.repositoryUrl);
  } catch (e) {
    readmeErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    readmeLoading.value = false;
  }
}

watch(
  () => props.pluginName,
  () => {
    pluginRow.value = null;
    governanceData.value = null;
    readmeHtml.value = "";
    readmeErr.value = "";
    void load();
  },
);

watch(
  () => [pluginConfigTab.value, props.readmeTarget?.kind, props.readmeTarget?.id] as const,
  ([tab]) => {
    if (tab === "readme") void loadReadme();
  },
);

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", onConfigBeforeUnload);
  }
  void load();
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("beforeunload", onConfigBeforeUnload);
  }
  for (const timer of Object.values(limitDebounceTimers.value)) {
    clearTimeout(timer);
  }
});

useSaveHotkey(
  () => Boolean(data.value) && !loading.value && !saving.value && !checking.value,
  () => save(),
);

const fieldValues = ref<Record<string, string>>({});

watch(
  [hasGovernanceTab, hasConfigFields],
  ([nextHasGovernance, nextHasConfig]) => {
    const next = resolveInitialPluginConfigTab({
      hasGovernance: nextHasGovernance,
      hasConfigFields: nextHasConfig,
    });
    const active = pluginConfigTab.value;
    if (active === "governance" && !nextHasGovernance) {
      pluginConfigTab.value = next;
      return;
    }
    if (active === "config" && !nextHasConfig) {
      pluginConfigTab.value = next;
      return;
    }
    if (active === "readme" && !showReadmeTab.value) {
      pluginConfigTab.value = next;
    }
  },
  { immediate: true },
);

watch(
  data,
  (d) => {
    fieldValues.value = d ? fieldValuesFromConfig(d.fields) : {};
    configEditMode.value = "form";
    rawToml.value = "";
    savedRawToml.value = "";
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
    if (configEditMode.value === "raw") {
      data.value = await putPluginConfigRaw(pluginResolvedId.value, rawToml.value);
      savedRawToml.value = rawToml.value;
    } else {
      const values = collectFieldValues(data.value.fields, fieldValues.value);
      data.value = await putPluginConfig(pluginResolvedId.value, values);
    }
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

defineExpose({
  save,
  runConfigCheck,
  saving,
  checking,
  loading,
  data,
  supportsConfigCheck,
  displayTitle,
});
</script>

<template>
  <div
    class="plugin-config-page plugin-config-workspace"
    :class="{ 'plugin-config-workspace--dialog': isDialogPresentation }"
  >
    <component
      :is="configShellComponent"
      v-if="pluginName"
      :class="configShellClass"
      v-bind="configShellBind"
    >
      <div
        v-if="!isDialogPresentation"
        class="plugin-config-page__hero"
      >
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
            <p
              v-if="activationPolicyHint && !loading"
              class="muted plugin-config-page__activation-hint"
            >
              生效方式：{{ activationPolicyHint }}
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
            {{ checking ? "检测中…" : AI_ENTRY_PLUGIN_CONFIG_CHECK.label }}
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
        v-if="!isDialogPresentation"
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
          <div class="plugin-config-page__toolbar">
            <div
              class="console-view-toggle plugin-config-page__tabs"
              role="tablist"
              aria-label="插件工作区"
            >
              <button
                v-if="hasGovernanceTab"
                type="button"
                role="tab"
                :class="{ 'is-on': pluginConfigTab === 'governance' }"
                :aria-selected="pluginConfigTab === 'governance'"
                @click="pluginConfigTab = 'governance'"
              >
                治理
              </button>
              <button
                type="button"
                role="tab"
                :class="{ 'is-on': pluginConfigTab === 'config' }"
                :aria-selected="pluginConfigTab === 'config'"
                @click="pluginConfigTab = 'config'"
              >
                插件配置
              </button>
              <button
                v-if="showReadmeTab"
                type="button"
                role="tab"
                :class="{ 'is-on': pluginConfigTab === 'readme' }"
                :aria-selected="pluginConfigTab === 'readme'"
                @click="pluginConfigTab = 'readme'"
              >
                README
              </button>
            </div>
            <div
              v-if="pluginConfigTab === 'config' && (hasConfigFields || isHelpPlugin)"
              class="plugin-config-page__mode-toggle console-view-toggle"
              role="tablist"
              aria-label="配置编辑模式"
            >
              <button
                type="button"
                role="tab"
                :class="{ 'is-on': configEditMode === 'form' }"
                :aria-selected="configEditMode === 'form'"
                @click="void switchConfigEditMode('form')"
              >
                表单
              </button>
              <button
                type="button"
                role="tab"
                :class="{ 'is-on': configEditMode === 'raw' }"
                :aria-selected="configEditMode === 'raw'"
                @click="void switchConfigEditMode('raw')"
              >
                Raw TOML
              </button>
            </div>
          </div>

          <HelpImagePreview
            v-if="isHelpPlugin && pluginConfigTab === 'config' && configEditMode === 'form'"
            class="plugin-config-page__help-preview"
            :embedded="isDialogPresentation"
          />

          <p
            v-if="pluginConfigTab === 'config' && !data.fields.length && !isHelpPlugin"
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
            v-if="pluginConfigTab === 'governance' && hasGovernanceTab"
            :class="
              isDialogPresentation
                ? 'plugin-config-page__governance-dialog'
                : 'plugin-config-page__tab-panel'
            "
          >
            <PluginGovernancePanel
              :presentation="isDialogPresentation ? 'dialog' : 'page'"
              :governance-data="governanceData"
              :governance-loading="governanceLoading"
              :governance-saving="governanceSaving"
              :governance-err="governanceErr"
              :command-menu-map="commandMenuMap"
              :perm-selections="permSelections"
              :limit-selections="limitSelections"
              :global-disable="isGloballyDisabled"
              :show-in-help-menu="showInHelpMenu"
              :global-disable-protected="globalDisableProtected"
              :help-ignored="helpIgnored"
              @perm-change="onPermChange"
              @limit-input="(cmdId, val) => onLimitInput(cmdId, val)"
              @toggle-global-disable="void toggleGovernanceRuntime('global_disable', $event)"
              @toggle-help-menu-visible="void toggleGovernanceRuntime('help_hidden', !$event)"
            />
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
          </section>
          <section
            v-if="pluginConfigTab === 'readme'"
            class="plugin-config-page__tab-panel plugin-readme-panel"
          >
            <header class="plugin-config-page__panel-head">
              <div>
                <h3 class="plugin-config-page__panel-title">
                  README
                </h3>
                <p class="muted plugin-config-page__panel-desc">
                  来自插件仓库说明；配置与运行项请切换其他分栏。
                </p>
              </div>
            </header>
            <p
              v-if="readmeLoading"
              class="muted plugin-readme-panel__status"
            >
              加载 README…
            </p>
            <p
              v-else-if="readmeErr"
              class="muted plugin-readme-panel__status"
            >
              {{ readmeErr }}
            </p>
            <ReadmeMarkdown
              v-else-if="readmeHtml"
              extra-class="plugin-readme-panel__body"
              :html="readmeHtml"
            />
            <p
              v-else
              class="muted plugin-readme-panel__status"
            >
              暂无 README 内容
            </p>
          </section>
          <p
            v-if="pluginConfigTab === 'config' && usesGatewayEditor"
            class="muted"
            style="margin: 0 0 16px; line-height: 1.55; font-size: 13px"
          >
            <strong>{{ AI_ENTRY_PLUGIN_CONFIG_CHECK.label }}</strong>：{{ AI_ENTRY_PLUGIN_CONFIG_CHECK.shortLead }}
            站点级批量探测见
            <router-link :to="AI_ENTRY_SITE_GATEWAY_CHECK.path">通用配置 → 服务网关</router-link>；
            {{ AI_ENTRY_RUNTIME.label }}见
            <router-link :to="AI_ENTRY_RUNTIME.path">AI 观测</router-link>。
          </p>
          <PallasImageGatewaysEditor
            v-if="pluginConfigTab === 'config' && usesGatewayEditor && configEditMode === 'form'"
            :field-values="fieldValues"
            @update:field-values="onGatewayFieldValues"
          />
          <p
            v-if="pluginConfigTab === 'config' && configDirty"
            class="alert alert--warn plugin-config-page__dirty-hint"
          >
            有未保存的修改
          </p>
          <div
            v-if="pluginConfigTab === 'config' && configEditMode === 'raw'"
            class="plugin-config-page__raw-toml-wrap"
          >
            <textarea
              v-model="rawToml"
              class="inp textarea plugin-config-page__raw-toml"
              spellcheck="false"
              rows="16"
              :disabled="saving || loading"
            />
          </div>
          <DynamicConfigPanel
            v-else-if="pluginConfigTab === 'config' && configEditMode === 'form'"
            :fields="visibleFields"
            :field-groups="data.field_groups"
            :unexpected-keys="data.unexpected_keys"
            :hide-single-group-header="isDialogPresentation"
            v-model="fieldValues"
            :active-field-popover-name="activeFieldPopoverName"
            @help-click="onFieldHelpClick"
            @help-hover="onFieldHelpHover"
            @help-hover-leave="onHelpHoverLeave"
            @edit-click="onFieldEditClick"
          />
          <Teleport to="body">
            <div
              v-if="activeFieldPopover"
              ref="fieldPopoverHost"
              class="plugin-config-field-popover"
              :style="fieldPopoverStyle"
              @click.stop
              @mouseenter="onPopoverEnter"
              @mouseleave="onHelpHoverLeave"
            >
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
                  <dd><code>{{ fieldHelpDefaultValue(activeFieldPopover) }}</code></dd>
                </div>
                <div>
                  <dt>环境键</dt>
                  <dd><code>{{ activeFieldPopover.env_key }}</code></dd>
                </div>
              </dl>
            </div>
          </Teleport>
          <PluginConfigFieldDialog
            :open="!!activeFieldDialog"
            :field="activeFieldDialog"
            :mode="activeFieldDialogMode"
            :model-value="activeFieldDialog ? (fieldValues[activeFieldDialog.name] ?? '') : ''"
            :json-title="activeFieldDialog ? `${pluginResolvedId} · ${activeFieldDialog.name}（JSON）` : undefined"
            @close="closeFieldDialog"
            @edit-request="onFieldDialogEditRequest"
            @update:model-value="
              activeFieldDialog && (fieldValues = { ...fieldValues, [activeFieldDialog.name]: $event })
            "
          />
      </div>
    </component>
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

  .plugin-config-page__panel-head {
    flex-direction: column;
  }

  .plugin-config-page__panel-badge {
    align-self: flex-start;
  }

  .plugin-config-page__tabs {
    display: flex;
    width: 100%;
  }

  .plugin-config-page__toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .plugin-config-page__tabs :deep(button) {
    flex: 1 1 0;
    min-width: 0;
  }

  .plugin-config-page__tab-panel {
    min-width: 0;
    padding: 12px;
  }

  .plugin-config-page__governance-dialog {
    min-width: 0;
  }

  .plugin-config-page__mode-toggle {
    width: 100%;
    margin-inline-start: 0;
  }

  .plugin-config-page__mode-toggle :deep(button) {
    flex: 1 1 0;
    min-width: 0;
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

.plugin-config-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  margin-bottom: 16px;
}

.plugin-config-page__tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 0;
}

.plugin-config-page__mode-toggle {
  margin-bottom: 0;
  margin-inline-start: auto;
  flex-shrink: 0;
}

.plugin-config-page__dirty-hint {
  margin: 0 0 12px;
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

.plugin-config-page__governance-dialog {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
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

.plugin-config-field-popover {
  z-index: 60;
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(120, 120, 140, 0.28)) 90%, transparent);
  background: var(--popover, var(--bg-card, #1b1d27));
  color: var(--popover-foreground, var(--text, inherit));
  box-shadow: 0 16px 40px color-mix(in srgb, var(--shadow, rgba(0, 0, 0, 0.35)) 60%, transparent);
  backdrop-filter: blur(14px);
  overflow: auto;
  min-width: 240px;
}

.plugin-config-field-popover__section {
  display: grid;
  gap: 6px;
}

.plugin-config-field-popover__eyebrow {
  font-size: 10px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-muted, rgba(255, 255, 255, 0.62));
}

.plugin-config-field-popover__title {
  margin: 0;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 700;
}

.plugin-config-field-popover__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.plugin-config-field-popover__desc--muted {
  color: var(--text-muted, rgba(255, 255, 255, 0.66));
}

.plugin-config-field-popover__meta {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-top: 2px;
  border-top: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 86%, transparent);
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
  font-size: 11px;
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
  background: color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.03)) 99%, transparent);
}

.plugin-config-field-popover :deep(.form-field__control::placeholder),
.plugin-config-field-popover :deep(.inp::placeholder),
.plugin-config-field-popover :deep(.textarea::placeholder) {
  color: var(--text-muted, rgba(255, 255, 255, 0.54));
}

@media (max-width: 560px) {
  .plugin-config-field-popover {
    gap: 10px;
    padding: 12px;
    border-radius: 18px;
  }

  .plugin-config-field-popover__meta > div {
    grid-template-columns: 48px 1fr;
    gap: 8px;
  }
}

@media (max-width: 920px) {
  .plugin-config-form-grid {
    grid-template-columns: 1fr;
  }
}

</style>
