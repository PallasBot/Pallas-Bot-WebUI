<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { AI_ENTRY_RUNTIME, AI_ENTRY_SITE_GATEWAY_CHECK } from "@/config/aiEntrySemantics";
import { useRoute, useRouter } from "vue-router";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import {
  fetchCommonConfig,
  fetchCommonConfigSections,
  postServiceGatewaysConnectivityCheck,
  putCommonConfig,
} from "@/api/consoleApi";
import type {
  CommonConfigSectionMeta,
  PluginConfigData,
  PluginConfigCheckResult,
  PluginConfigField,
  PluginConfigFieldGroup,
} from "@/api/pallasTypes";
import { SERVICE_GATEWAYS_SECTION_ID, PALLAS_WEBUI_SECTION_ID, CORPUS_FEDERATION_SECTION_ID, COMMUNITY_STATS_SECTION_ID } from "@/api/pallasTypes";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer.vue";
import PluginConfigFieldDialog from "@/components/config/PluginConfigFieldDialog.vue";
import PluginConfigFieldShell from "@/components/config/PluginConfigFieldShell.vue";
import CmdPermMatrix from "@/components/config/CmdPermMatrix.vue";
import CmdLimitsTable from "@/components/config/CmdLimitsTable.vue";
import PallasImageGatewaysEditor from "@/components/PallasImageGatewaysEditor.vue";
import AiRuntimeSummaryPanel from "@/components/ai-config/AiRuntimeSummaryPanel.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import RuntimeCheckResults from "@/components/config/RuntimeCheckResults.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { usePluginConfigFieldPopover } from "@/composables/usePluginConfigFieldPopover";
import { axiosErrorDetail } from "@/api/http";
import { PALLAS_IMAGE_GATEWAY_FIELD_NAMES } from "@/utils/pallasImageGateways";
import { pluginConfigRouteFromPath } from "@/utils/pluginConfigRoute";
import { toastApiError, toastProbeLines, toastSaveSuccess } from "@/utils/consoleToastFeedback";
import {
  buildAiRuntimeOverview,
  groupAiRuntimeSnapshot,
  resolveAiRuntimeSnapshot,
} from "@/utils/aiRuntimeResolver";
import {
  fieldValuesFromConfig,
  parsePluginConfigField,
} from "@/utils/pluginConfigFieldModel";

const route = useRoute();
const router = useRouter();
const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const sections = ref<CommonConfigSectionMeta[]>([]);
const currentId = ref("");
const data = ref<PluginConfigData | null>(null);
const saving = ref(false);
const checking = ref(false);
const checkLines = ref<string[]>([]);
const checkResults = ref<PluginConfigCheckResult["results"]>([]);
const checkErr = ref("");
const fieldValues = ref<Record<string, string>>({});
const permSelections = ref<Record<string, string>>({});

const CMD_PERM_SECTION_ID = "cmd_perm";
const COMMAND_LIMITS_SECTION_ID = "command_limits";
const CONTROL_PLANE_SECTION_ID = "control_plane";
const LLM_SECTION_ID = "llm";
const ARKNIGHTS_KB_SECTION_ID = "arknights_kb";
const AI_MANAGED_SECTION_IDS = new Set([LLM_SECTION_ID, ARKNIGHTS_KB_SECTION_ID]);
const SHELL_FIELD_SECTION_IDS = new Set([
  SERVICE_GATEWAYS_SECTION_ID,
  CORPUS_FEDERATION_SECTION_ID,
  PALLAS_WEBUI_SECTION_ID,
  COMMUNITY_STATS_SECTION_ID,
]);

const isCorpusFederationSection = computed(() => currentId.value === CORPUS_FEDERATION_SECTION_ID);
const isCommunityStatsSection = computed(() => currentId.value === COMMUNITY_STATS_SECTION_ID);
const isControlPlaneSection = computed(() => currentId.value === CONTROL_PLANE_SECTION_ID);
const isServiceGateways = computed(() => currentId.value === SERVICE_GATEWAYS_SECTION_ID);
const isPallasWebuiSection = computed(() => currentId.value === PALLAS_WEBUI_SECTION_ID);
const showDevModeHotReloadHint = computed(() => Boolean(data.value?.dev_mode_hot_reload));
const showHotReloadHint = computed(
  () => Boolean(data.value?.dev_mode_hot_reload || data.value?.hot_reload),
);
const showGatewayEditor = computed(() => Boolean(data.value?.gateway_editor));
const supportsConnectivityCheck = computed(() => Boolean(data.value?.supports_connectivity_check));
const showCmdPermMatrix = computed(
  () => currentId.value === CMD_PERM_SECTION_ID && Boolean(data.value?.command_perm_ui),
);
const showCommandLimitsTable = computed(
  () => currentId.value === COMMAND_LIMITS_SECTION_ID && Boolean(data.value?.command_limits_ui),
);
const isCmdPermSection = computed(() => currentId.value === CMD_PERM_SECTION_ID);
const isMessageScrubSection = computed(() => currentId.value === "message_scrub");
const useShellFieldLayout = computed(() => SHELL_FIELD_SECTION_IDS.has(currentId.value));
const gatewayFieldNameSet = computed(() => new Set<string>(PALLAS_IMAGE_GATEWAY_FIELD_NAMES));

const fieldGroups = computed((): PluginConfigFieldGroup[] => data.value?.field_groups ?? []);
const limitSelections = ref<Record<string, string>>({});
const gatewayRuntimeItems = computed(() =>
  resolveAiRuntimeSnapshot({
    gatewayResults: checkResults.value,
    extensionTest: null,
  }),
);
const gatewayRuntimeGroups = computed(() => groupAiRuntimeSnapshot(gatewayRuntimeItems.value));
const gatewayRuntimeOverview = computed(() => buildAiRuntimeOverview(gatewayRuntimeItems.value));

const genericFields = computed(() => {
  if (!data.value || fieldGroups.value.length) return [];
  if (isCmdPermSection.value && data.value.command_perm_ui) return [];
  if (showCommandLimitsTable.value && data.value.command_limits_ui) return [];
  return data.value.fields;
});

function sortSectionsCmdPermFirst(list: CommonConfigSectionMeta[]): CommonConfigSectionMeta[] {
  const i = list.findIndex((s) => s.id === CMD_PERM_SECTION_ID);
  if (i <= 0) return [...list];
  const next = [...list];
  const [picked] = next.splice(i, 1);
  next.unshift(picked);
  return next;
}

function fieldsInGroup(group: PluginConfigFieldGroup): PluginConfigField[] {
  if (!data.value) return [];
  const names = new Set(group.field_names);
  return data.value.fields.filter((f) => names.has(f.name));
}

function isFieldHiddenInGroup(f: PluginConfigField, group: PluginConfigFieldGroup): boolean {
  if (!showConfigField(f)) return true;
  if (group.id === "draw" && showGatewayEditor.value && gatewayFieldNameSet.value.has(f.name)) {
    return true;
  }
  return false;
}

function visibleFieldsInGroup(group: PluginConfigFieldGroup): PluginConfigField[] {
  return fieldsInGroup(group).filter((f) => !isFieldHiddenInGroup(f, group));
}

const visibleGenericFields = computed(() =>
  genericFields.value.filter((f) => showConfigField(f)),
);

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
} = usePluginConfigFieldPopover(() => data.value?.fields ?? []);

function fieldGroupPluginRoute(group: PluginConfigFieldGroup) {
  const sectionPlugin = isPallasWebuiSection.value ? PALLAS_WEBUI_SECTION_ID : undefined;
  return pluginConfigRouteFromPath(group.plugin_config_path, sectionPlugin);
}

function onGatewayFieldValues(next: Record<string, string>) {
  fieldValues.value = { ...fieldValues.value, ...next };
}

function updateFieldValue(name: string, value: string) {
  fieldValues.value = { ...fieldValues.value, [name]: value };
}

watch(
  data,
  (d) => {
    permSelections.value = {};
    limitSelections.value = {};
    if (!d?.fields?.length) {
      fieldValues.value = {};
      return;
    }
    try {
      fieldValues.value = fieldValuesFromConfig(d.fields);
    } catch {
      const next: Record<string, string> = {};
      for (const f of d.fields) {
        next[f.name] = f.kind === "bool" ? "false" : "";
      }
      fieldValues.value = next;
    }
    const ui = d.command_perm_ui;
    if (ui) {
      const permNext: Record<string, string> = {};
      for (const p of ui.plugins) {
        for (const c of p.commands) {
          permNext[c.command_id] = c.effective_level;
        }
      }
      permSelections.value = permNext;
    }
    const limitUi = d.command_limits_ui;
    if (limitUi) {
      const limitNext: Record<string, string> = {};
      for (const p of limitUi.plugins) {
        for (const c of p.commands) {
          limitNext[c.command_id] = String(c.effective_cd_sec);
        }
      }
      limitSelections.value = limitNext;
    }
  },
  { immediate: true },
);

function buildOverridesFromMatrix(): Record<string, string> {
  const ui = data.value?.command_perm_ui;
  if (!ui) return {};
  const out: Record<string, string> = {};
  for (const p of ui.plugins) {
    for (const c of p.commands) {
      const sel = permSelections.value[c.command_id] ?? c.effective_level;
      if (sel !== c.default_level) {
        out[c.command_id] = sel;
      }
    }
  }
  return out;
}

function buildCommandLimitOverridesFromTable(): Record<string, number> {
  const ui = data.value?.command_limits_ui;
  if (!ui) return {};
  const out: Record<string, number> = {};
  for (const p of ui.plugins) {
    for (const c of p.commands) {
      const raw = (limitSelections.value[c.command_id] ?? String(c.effective_cd_sec)).trim();
      const parsed = Number.parseInt(raw === "" ? String(c.default_cd_sec) : raw, 10);
      const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : c.default_cd_sec;
      if (safe !== c.default_cd_sec) out[c.command_id] = safe;
    }
  }
  return out;
}

function onCommandLimitInput(commandId: string, value: string) {
  const trimmed = value.trim();
  if (trimmed === "") {
    limitSelections.value = { ...limitSelections.value, [commandId]: "" };
    return;
  }
  const parsed = Number.parseInt(trimmed, 10);
  limitSelections.value = {
    ...limitSelections.value,
    [commandId]: Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "0",
  };
}


async function loadSections() {
  try {
    const raw = await fetchCommonConfigSections();
    const q = route.query.section;
    if (typeof q === "string" && q.trim() === LLM_SECTION_ID) {
      await router.replace(aiConfigSectionPath("strategy"));
      return;
    }
    if (typeof q === "string" && q.trim() === ARKNIGHTS_KB_SECTION_ID) {
      await router.replace(aiConfigSectionPath("knowledge"));
      return;
    }
    sections.value = sortSectionsCmdPermFirst(raw.filter((s) => !AI_MANAGED_SECTION_IDS.has(s.id)));
    const metaSection = route.meta.defaultCommonConfigSection;
    if (typeof q === "string" && q.trim()) {
      const sid = q.trim();
      if (!AI_MANAGED_SECTION_IDS.has(sid) && sections.value.some((s) => s.id === sid)) {
        currentId.value = sid;
      }
    } else if (typeof metaSection === "string" && metaSection.trim()) {
      const sid = metaSection.trim();
      if (!AI_MANAGED_SECTION_IDS.has(sid)) currentId.value = sid;
    } else if (!currentId.value || AI_MANAGED_SECTION_IDS.has(currentId.value)) {
      currentId.value =
        sections.value.find((s) => s.id === CMD_PERM_SECTION_ID)?.id ?? sections.value[0]?.id ?? "";
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function loadSection() {
  if (!currentId.value) return;
  err.value = "";
  checkLines.value = [];
  checkErr.value = "";
  try {
    data.value = await fetchCommonConfig(currentId.value);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    data.value = null;
  }
}

watch(currentId, () => {
  closeFieldInteraction();
  void loadSection();
});

watch(
  () => route.query.section,
  (q) => {
    if (typeof q !== "string" || !q.trim()) return;
    const sid = q.trim();
    if (sid === LLM_SECTION_ID) {
      void router.replace(aiConfigSectionPath("strategy"));
      return;
    }
    if (sid === ARKNIGHTS_KB_SECTION_ID) {
      void router.replace(aiConfigSectionPath("knowledge"));
      return;
    }
    if (sid !== currentId.value && sections.value.some((s) => s.id === sid)) {
      currentId.value = sid;
    }
  },
);

onMounted(async () => {
  try {
    await loadSections();
    await loadSection();
  } finally {
    pageReady.value = true;
  }
});

useSaveHotkey(
  () => Boolean(data.value) && !saving.value && !checking.value,
  () => save(),
);

function collectValues(): Record<string, unknown> {
  if (!data.value) return {};
  const values: Record<string, unknown> = {};
  for (const f of data.value.fields) {
    if (showCmdPermMatrix.value && f.name === "command_permission_overrides") {
      values[f.name] = buildOverridesFromMatrix();
      continue;
    }
    if (showCommandLimitsTable.value && f.name === "command_limit_overrides") {
      values[f.name] = buildCommandLimitOverridesFromTable();
      continue;
    }
    const raw = fieldValues.value[f.name] ?? "";
    if (f.kind === "json" && String(raw).trim() === "") {
      values[f.name] = null;
    } else {
      values[f.name] = parsePluginConfigField(f, raw);
    }
  }
  return values;
}

const BACKFILL_ENABLE_CONFIRM =
  "开启后将在后台分批把本机历史语料同步到社区共享池；需已开启「上传本机新回复」并完成语料登记。\n\n与接话无关，队列繁忙时会自动跳过。\n\n确定开启？";

const DEV_MODE_ENABLE_CONFIRM =
  "开启开发模式将跳过控制台 JSON API 与静态页登录鉴权，任何能访问该地址的人均可读写控制台。\n\n仅在受信任的本机/内网联调时使用，生产环境务必保持关闭。\n\n确定开启？";

async function save() {
  if (!data.value) return;
  if (isPallasWebuiSection.value) {
    const values = collectValues();
    const prev = data.value.fields.find((f) => f.name === "pallas_webui_dev_mode")?.current === true;
    const next = values.pallas_webui_dev_mode === true;
    if (!prev && next && !window.confirm(DEV_MODE_ENABLE_CONFIRM)) return;
  }
  if (isCorpusFederationSection.value) {
    const values = collectValues();
    const prev = data.value.fields.find((f) => f.name === "corpus_backfill_enabled")?.current === true;
    const next = values.corpus_backfill_enabled === true;
    if (!prev && next && !window.confirm(BACKFILL_ENABLE_CONFIRM)) return;
  }
  saving.value = true;
  err.value = "";
  try {
    const saved = await putCommonConfig(currentId.value, collectValues());
    if (!saved?.fields?.length) {
      throw new Error("保存响应缺少 fields，请刷新页面后重试");
    }
    data.value = saved;
    toastSaveSuccess("配置已保存");
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "保存失败");
  } finally {
    saving.value = false;
  }
}

async function runConnectivityCheck() {
  if (!supportsConnectivityCheck.value) return;
  checking.value = true;
  checkErr.value = "";
  checkLines.value = [];
  checkResults.value = [];
  try {
    const r = await postServiceGatewaysConnectivityCheck(collectValues());
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

function showConfigField(f: PluginConfigField): boolean {
  if (showCmdPermMatrix.value && f.name === "command_permission_overrides") return false;
  if (showCommandLimitsTable.value && f.name === "command_limit_overrides") return false;
  if (isPallasWebuiSection.value && f.name === "pallas_webui_dev_mode") return false;
  return true;
}

</script>

<template>
  <div>
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>
    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="2"
    />
    <div
      v-else
      class="common-config-page console-hub-page"
    >
      <ConsoleHubMasthead :icon="panelNavIcon">
        <template #title>
          通用配置
        </template>
        <template #lead>
          按分区编辑站点级设置；保存后多数项可热载，无需重启。
        </template>
        <template #actions>
        </template>
      </ConsoleHubMasthead>

      <UiCard
        tag="div"
        glass
        class="common-config-page__card"
      >
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">
            <ConsoleNavIcon class="panel__title-ico" :name="panelNavIcon" />分区
          </h2>
          <div class="row-actions">
            <select
              v-model="currentId"
              class="sel"
            >
              <option
                v-for="s in sections"
                :key="s.id"
                :value="s.id"
              >
                {{ s.title }}
              </option>
            </select>
            <UiButton
              v-if="supportsConnectivityCheck"
              variant="outline"
              :disabled="checking || saving || !data"
              :busy="checking"
              @click="runConnectivityCheck"
            >
              {{ checking ? "检测中…" : "检测连通" }}
            </UiButton>
            <UiButton
              variant="primary"
              :disabled="saving || checking || !data"
              :busy="saving"
              title="Ctrl+S"
              @click="save"
            >
              {{ saving ? "保存中…" : "保存配置" }}
            </UiButton>
          </div>
        </div>
        <div
          v-if="data"
          class="panel__bd"
        >
          <p
            v-if="isCmdPermSection"
            class="muted common-config-page__intro"
          >
            调整各口令<strong>谁可用</strong>（所有人、群管、号主等）。下方矩阵只显示中文命令名；保存后立即生效，一般无需重启。
          </p>
          <p
            v-if="showCommandLimitsTable"
            class="muted common-config-page__intro"
          >
            调整各命令的默认冷却秒数覆盖。仅当所填秒数与插件默认值不同时才会保存覆盖项；填 <code>0</code> 表示关闭该命令冷却。
          </p>
          <p
            v-if="isMessageScrubSection"
            class="muted common-config-page__intro"
          >
            复读<strong>学习</strong>与做梦<strong>采集</strong>前的入站过滤。不配任何项时与未启用时行为一致；保存后热重载。
          </p>
          <p
            v-if="isControlPlaneSection"
            class="muted common-config-page__intro"
          >
            多套牛牛加入同一<strong>多机协同池</strong>时，可共用中心下发的配置，并对同一条群消息<strong>只让一套牛牛回复</strong>，避免重复抢答。
            入池密钥在<strong>统计与语料</strong>页复制；保存后写入 <code>webui.json</code> 并立即尝试向中心拉取最新配置。
          </p>
          <p
            v-if="isCorpusFederationSection"
            class="muted common-config-page__intro"
          >
            管理<strong>接话语料</strong>从哪读、是否接入<strong>社区共享池</strong>。
            共享语料默认关闭，需手动开启。保存后写入 <code>webui.json</code> 并<strong>热重载</strong>，一般无需重启牛牛。
          </p>
          <p
            v-if="isCommunityStatsSection"
            class="muted common-config-page__intro"
          >
            向社区中心<strong>上报在线统计</strong>（默认开启，不含消息内容）。
            下方「社区主站展示」可分别设置是否在主站气泡墙<strong>公开 QQ</strong>（默认关）或<strong>头像昵称</strong>（默认开）。
            也可在<strong>统计与语料</strong>页通过链接进入本页调整。
          </p>
          <p
            v-if="isCorpusFederationSection && showHotReloadHint"
            class="muted common-config-page__intro"
          >
            关闭「使用共享语料」后，下一周期起不再访问共享池；其余项保存后立即生效。
          </p>
          <p
            v-if="isServiceGateways"
            class="muted common-config-page__intro"
          >
            集中配置画画主/备网关、MAA 对外端点与点歌服务地址；保存后写入运行配置并热重载。完整参数仍可在各
            <router-link to="/plugins/draw">插件配置</router-link> 页编辑。
            本页「连通性检测」属于<strong>{{ AI_ENTRY_SITE_GATEWAY_CHECK.label }}</strong>：{{ AI_ENTRY_SITE_GATEWAY_CHECK.shortLead }}
            {{ AI_ENTRY_RUNTIME.label }}见
            <router-link :to="AI_ENTRY_RUNTIME.path">AI 首页</router-link>。
          </p>
          <p
            v-if="showDevModeHotReloadHint"
            class="muted common-config-page__intro"
          >
            <strong>开发模式</strong>可在顶栏快速开关：开启后跳过控制台登录校验，仅适合本机调试；公网务必关闭。
            「允许跨域访问」变更后需重启总机牛牛。
          </p>
          <div
            v-if="supportsConnectivityCheck && (checkLines.length || checkErr)"
            class="plugin-config-page__check-feedback"
            style="margin-bottom: 20px"
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
            v-if="supportsConnectivityCheck && checkResults.length"
            style="margin-bottom: 20px"
          >
            <AiRuntimeSummaryPanel
              v-if="gatewayRuntimeItems.length"
              :overview="gatewayRuntimeOverview"
              :groups="gatewayRuntimeGroups"
              variant="compact"
              show-hub-link
              class="common-config-page__runtime-summary"
            />
            <RuntimeCheckResults :results="checkResults" />
          </div>
          <div
            v-if="showCmdPermMatrix && data.command_perm_ui"
            style="margin-bottom: 28px"
          >
            <p class="muted" style="font-size: 13px; margin-bottom: 14px; line-height: 1.5">
              为各命令选择「谁可用」。仅当所选等级与插件默认不同时才会保存覆盖项。
            </p>
            <CmdPermMatrix
              :levels="data.command_perm_ui.levels"
              :plugins="data.command_perm_ui.plugins"
              :selections="permSelections"
              @change="(cmdId, lv) => (permSelections[cmdId] = lv)"
            />
          </div>
          <div
            v-if="showCommandLimitsTable && data.command_limits_ui"
            style="margin-bottom: 28px"
          >
            <p class="muted" style="font-size: 13px; margin-bottom: 14px; line-height: 1.5">
              按插件分组编辑冷却秒数。表格内填写的是<strong>生效值</strong>；与默认值相同则不会写入覆盖。
            </p>
            <CmdLimitsTable
              :plugins="data.command_limits_ui.plugins"
              :selections="limitSelections"
              @input="onCommandLimitInput"
            />
          </div>
          <template v-if="fieldGroups.length">
            <section
              v-for="group in fieldGroups"
              :key="group.id"
              style="margin-bottom: 32px"
            >
              <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px">
                <h3 style="font-size: 15px; margin: 0; font-weight: 700">
                  {{ group.title }}
                </h3>
                <router-link
                  v-if="isPallasWebuiSection"
                  :to="{ name: 'plugins', params: { name: PALLAS_WEBUI_SECTION_ID } }"
                  class="muted"
                  style="font-size: 13px"
                >
                  插件完整配置 →
                </router-link>
                <router-link
                  v-else-if="group.plugin_config_path"
                  :to="fieldGroupPluginRoute(group)"
                  class="muted"
                  style="font-size: 13px"
                >
                  插件完整配置 →
                </router-link>
              </div>
              <p
                v-if="isPallasWebuiSection && group.id === 'security'"
                class="muted"
                style="font-size: 13px; margin: -6px 0 12px; line-height: 1.5"
              >
                开发模式开关在顶栏右侧，与连接状态、主题切换同一行。
              </p>
              <PallasImageGatewaysEditor
                v-if="group.id === 'draw' && showGatewayEditor"
                :field-values="fieldValues"
                @update:field-values="onGatewayFieldValues"
              />
              <div
                v-if="useShellFieldLayout && visibleFieldsInGroup(group).length"
                class="plugin-config-form-grid"
              >
                <PluginConfigFieldShell
                  v-for="f in visibleFieldsInGroup(group)"
                  :key="f.name"
                  :field="f"
                  :model-value="fieldValues[f.name] ?? ''"
                  :help-expanded="activeFieldPopoverName === f.name"
                  :json-title="`${currentId} · ${f.name}（JSON）`"
                  @update:model-value="(v) => updateFieldValue(f.name, v)"
                  @help-click="onFieldHelpClick(f.name, $event)"
                  @help-hover="onFieldHelpHover(f.name, $event)"
                  @help-hover-leave="onHelpHoverLeave"
                  @edit-click="onFieldEditClick(f.name)"
                />
              </div>
              <template v-else>
                <ConfigFieldRenderer
                  v-for="f in fieldsInGroup(group)"
                  v-show="!isFieldHiddenInGroup(f, group)"
                  :key="f.name"
                  :field="f"
                  :model-value="fieldValues[f.name] ?? ''"
                  :show-meta="false"
                  :json-title="`${currentId} · ${f.name}（JSON）`"
                  @update:model-value="(v) => updateFieldValue(f.name, v)"
                />
              </template>
            </section>
          </template>
          <div
            v-if="useShellFieldLayout && visibleGenericFields.length"
            class="plugin-config-form-grid"
          >
            <PluginConfigFieldShell
              v-for="f in visibleGenericFields"
              :key="f.name"
              :field="f"
              :model-value="fieldValues[f.name] ?? ''"
              :help-expanded="activeFieldPopoverName === f.name"
              :json-title="`${currentId} · ${f.name}（JSON）`"
              @update:model-value="(v) => updateFieldValue(f.name, v)"
              @help-click="onFieldHelpClick(f.name, $event)"
              @help-hover="onFieldHelpHover(f.name, $event)"
              @help-hover-leave="onHelpHoverLeave"
              @edit-click="onFieldEditClick(f.name)"
            />
          </div>
          <template v-else>
            <ConfigFieldRenderer
              v-for="f in genericFields"
              v-show="showConfigField(f)"
              :key="f.name"
              :field="f"
              :model-value="fieldValues[f.name] ?? ''"
              :show-meta="false"
              :json-title="`${currentId} · ${f.name}（JSON）`"
              @update:model-value="(v) => updateFieldValue(f.name, v)"
            />
          </template>
        </div>
      </UiCard>
      <Teleport to="body">
        <div
          v-if="useShellFieldLayout && activeFieldPopover"
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
        v-if="useShellFieldLayout"
        :open="!!activeFieldDialog"
        :field="activeFieldDialog"
        :mode="activeFieldDialogMode"
        :model-value="activeFieldDialog ? (fieldValues[activeFieldDialog.name] ?? '') : ''"
        :json-title="activeFieldDialog ? `${currentId} · ${activeFieldDialog.name}（JSON）` : undefined"
        @close="closeFieldDialog"
        @edit-request="onFieldDialogEditRequest"
        @update:model-value="
          activeFieldDialog && updateFieldValue(activeFieldDialog.name, $event)
        "
      />
    </div>
  </div>
</template>

<style scoped>
.common-config-page__intro {
  font-size: 13px;
  margin: 0 0 16px;
  line-height: 1.6;
}

.common-config-page__intro + .common-config-page__intro {
  margin-top: -8px;
}

.plugin-config-page__check-output {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--panel-hd-bg, rgba(0, 0, 0, 0.2));
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.common-config-page__runtime-summary {
  margin-bottom: 14px;
}

.plugin-config-form-grid {
  display: grid;
  gap: 18px 24px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

@media (max-width: 920px) {
  .plugin-config-form-grid {
    grid-template-columns: 1fr;
  }
}

.plugin-config-field-popover {
  z-index: 1200;
  overflow: auto;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  background: var(--panel-bg, #1a1d24);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.plugin-config-field-popover__section {
  margin-bottom: 12px;
}

.plugin-config-field-popover__eyebrow {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted, #9aa3b2);
  margin-bottom: 4px;
}

.plugin-config-field-popover__title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
}

.plugin-config-field-popover__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
}

.plugin-config-field-popover__desc--muted {
  color: var(--muted, #9aa3b2);
}

.plugin-config-field-popover__meta {
  display: grid;
  gap: 8px;
  margin: 0;
  font-size: 12px;
}

.plugin-config-field-popover__meta div {
  display: grid;
  grid-template-columns: 4.5em 1fr;
  gap: 8px;
  align-items: baseline;
}

.plugin-config-field-popover__meta dt {
  margin: 0;
  color: var(--muted, #9aa3b2);
}

.plugin-config-field-popover__meta dd {
  margin: 0;
  word-break: break-word;
}

.plugin-config-field-popover__meta code {
  font-size: 11px;
}
</style>
