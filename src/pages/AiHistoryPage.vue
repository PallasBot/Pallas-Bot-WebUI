<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  fetchConversationKernelKnowledgeSources,
  fetchConversationKernelMemory,
  fetchConversationKernelRelationshipNotes,
  fetchConversationKernelStatus,
  fetchConversationKernelTraces,
  fetchInstances,
  fetchLlmBehaviorRuns,
  fetchLlmBehaviorPatterns,
  fetchLlmHistorySession,
  fetchLlmHistorySessions,
  fetchLlmRepeaterFeedback,
  fetchLlmRepeaterFeedbackSummary,
  fetchLlmPromotionCandidates,
  fetchLlmRuntimeReplay,
  fetchLlmRuntimeDebug,
  postConversationKernelMemoryDelete,
  postConversationKernelRelationshipNoteDelete,
  postLlmRuntimeReplayRun,
  postLlmPromotionCandidateResolve,
  postLlmBehaviorPatternDelete,
  postLlmBehaviorPatternUpsert,
  postLlmHistoryBehaviorAnnotate,
  postLlmRepeaterFeedbackManage,
} from "@/api/consoleApi";
import type {
  LlmBehaviorPattern,
  LlmHistoryBehaviorAgentTrace,
  LlmHistoryBehaviorRun,
  LlmHistoryBehaviorAutoFeedbackPayload,
  LlmRuntimeReplayResult,
  LlmRuntimeDebugData,
  LlmPersonaShapingSummary,
  LlmHistorySessionDetailData,
  LlmHistorySessionSummary,
  LlmHistoryTurn,
  LlmRepeaterFeedbackEntry,
  LlmRepeaterFeedbackSummary,
  LlmPromotionCandidate,
  ConversationKernelStatus,
  ConversationKernelKnowledgeSource,
  ConversationKernelMemoryEntry,
  ConversationKernelRelationshipNote,
  ConversationKernelTraceRow,
  BotRow,
  InstancesData,
} from "@/api/pallasTypes";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";
import AiHistoryContextBar from "@/components/ai-history/AiHistoryContextBar.vue";
import AiHistoryLearningStrip from "@/components/ai-history/AiHistoryLearningStrip.vue";
import AiHistoryMaintainBehaviorPanel from "@/components/ai-history/AiHistoryMaintainBehaviorPanel.vue";
import AiHistoryMaintainFeedbackPanel from "@/components/ai-history/AiHistoryMaintainFeedbackPanel.vue";
import AiHistoryMaintainKernelPanel from "@/components/ai-history/AiHistoryMaintainKernelPanel.vue";
import AiHistoryMaintainPersonaPanel from "@/components/ai-history/AiHistoryMaintainPersonaPanel.vue";
import AiHistoryMaintainPromotionPanel from "@/components/ai-history/AiHistoryMaintainPromotionPanel.vue";
import AiHistoryMaintainWorkspace from "@/components/ai-history/AiHistoryMaintainWorkspace.vue";
import AiHistoryMemoryWorkspace from "@/components/ai-history/AiHistoryMemoryWorkspace.vue";
import AiHistoryOrphanBehaviorSection from "@/components/ai-history/AiHistoryOrphanBehaviorSection.vue";
import AiHistoryPatternEditorDialog from "@/components/ai-history/AiHistoryPatternEditorDialog.vue";
import AiHistoryReplayResultDialog from "@/components/ai-history/AiHistoryReplayResultDialog.vue";
import AiHistoryRulesWorkspace from "@/components/ai-history/AiHistoryRulesWorkspace.vue";
import AiHistorySessionDetailPane from "@/components/ai-history/AiHistorySessionDetailPane.vue";
import AiHistorySessionListPane from "@/components/ai-history/AiHistorySessionListPane.vue";
import AiHistorySessionTurnDecisionBlock from "@/components/ai-history/AiHistorySessionTurnDecisionBlock.vue";
import AiHistorySessionTurnMaintainBlock from "@/components/ai-history/AiHistorySessionTurnMaintainBlock.vue";
import AiHistorySessionTurnThread from "@/components/ai-history/AiHistorySessionTurnThread.vue";
import AiHistoryWorkspaceTabs from "@/components/ai-history/AiHistoryWorkspaceTabs.vue";
import PageFill from "@/components/PageFill.vue";
import { useAiObservationRefresh } from "@/composables/useAiObservationRefresh";
import { AI_STATS_LIMITS } from "@/config/aiConstants";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import {
  BEHAVIOR_OUTCOME_OPTIONS,
  BEHAVIOR_SCENE_OPTIONS,
  labelAction,
  labelFeatureLevel,
  labelOutcome,
  labelRepeaterMode,
  labelScene,
} from "@/utils/aiHistoryLabels";
import { copyTextToClipboard } from "@/utils/clipboard";
import { pushConsoleToast } from "@/utils/consoleToast";
import { formatCompactDateTime } from "@/utils/formatDateTime";
import { deriveFeedbackGroupFromSession } from "@/utils/llmRepeaterFeedbackLink";
import { botPickerRowsFromInstances } from "@/utils/botDisplay";
import { memoryScopeSummary } from "@/utils/memoryScope";

const router = useRouter();
const route = useRoute();
const LEARNING_LOOP_DISMISS_KEY = "pallas.aiHistory.learningLoopDismissed";

const sessions = ref<LlmHistorySessionSummary[]>([]);
const selectedSessionKey = ref("");
const sessionDetail = ref<LlmHistorySessionDetailData | null>(null);
const sessionDecisionTraces = ref<ConversationKernelTraceRow[]>([]);
const historyBusy = ref(false);
const historyErr = ref("");
const feedbackBusy = ref(false);
const feedbackManageBusy = ref<Record<string, boolean>>({});
const feedbackCorrectionDraft = ref<Record<string, string>>({});
const feedbackErr = ref("");
const feedbackGroup = ref("");
const feedbackItems = ref<LlmRepeaterFeedbackEntry[]>([]);
const feedbackSummary = ref<LlmRepeaterFeedbackSummary | null>(null);
const feedbackGroupTouched = ref(false);
const promotionCandidates = ref<LlmPromotionCandidate[]>([]);
const promotionCandidatesBusy = ref(false);
const promotionCandidatesErr = ref("");
const promotionIncludeResolved = ref(false);
const promotionResolveBusyId = ref("");
const behaviorRunsBusy = ref(false);
const behaviorRunsErr = ref("");
const behaviorRunsItems = ref<LlmHistoryBehaviorRun[]>([]);
const behaviorRunsGroup = ref("");
const behaviorRunsGroupTouched = ref(false);
const behaviorRunsScene = ref("");
const behaviorRunsOutcome = ref("");
const behaviorRunsIncludeDisabled = ref(false);
const patternBusy = ref(false);
const patternErr = ref("");
const patternsItems = ref<LlmBehaviorPattern[]>([]);
const patternsGroup = ref("");
const patternsGroupTouched = ref(false);
const patternsScene = ref("");
const patternsIncludeDisabled = ref(false);
const patternEditor = ref<LlmBehaviorPattern>({
  pattern_id: "",
  scene: "smalltalk",
  action: "ack_then_short_reply",
  scope_group_id: null,
  success_score: 0,
  manual_score: 0,
  disabled: false,
  persona_affinity: "",
  trigger_features: [],
  reference_examples: [],
});
const patternEditorMode = ref<"create" | "edit">("create");
const patternSaveBusy = ref(false);
const patternEditorOpen = ref(false);
const observeGroup = ref("");
const observeGroupTouched = ref(false);
const observeScene = ref("");
const kernelStatus = ref<ConversationKernelStatus | null>(null);
const kernelStatusBusy = ref(false);
const kernelStatusErr = ref("");
const kernelTraces = ref<ConversationKernelTraceRow[]>([]);
const kernelTracesBusy = ref(false);
const kernelTracesErr = ref("");
const memoryBot = ref("");
const memoryBotTouched = ref(false);
const memoryGroup = ref("");
const memoryGroupTouched = ref(false);
const memoryQuery = ref("");
const memoryBusy = ref(false);
const memoryErr = ref("");
const memoryEntries = ref<ConversationKernelMemoryEntry[]>([]);
const relationshipNotes = ref<ConversationKernelRelationshipNote[]>([]);
const knowledgeSources = ref<ConversationKernelKnowledgeSource[]>([]);
const memoryDeleteBusy = ref("");
const memoryInstances = ref<InstancesData | null>(null);
const expandedKernelTraceKeys = ref<Record<string, boolean>>({});
const expandedBehaviorTraceKeys = ref<Record<string, boolean>>({});
const expandedObserveAnnotateIds = ref<Record<string, boolean>>({});
const sessionDetailPane = ref<{ detailAnchor: HTMLElement | null } | null>(null);
const sessionsWorkspaceAnchor = ref<HTMLElement | null>(null);
const expandedObserveKeys = ref<Record<string, boolean>>({});
type MaintainPanelKey = "persona" | "feedback" | "promotion" | "behavior" | "kernel";
const maintainPanelExpanded = ref<Record<MaintainPanelKey, boolean>>({
  persona: false,
  feedback: true,
  promotion: false,
  behavior: false,
  kernel: false,
});
const patternSortKey = ref<"success_score" | "manual_score" | "pattern_id">("success_score");
const learningLoopDismissed = ref(
  typeof localStorage !== "undefined" && localStorage.getItem(LEARNING_LOOP_DISMISS_KEY) === "1",
);
const showDecisionTraces = ref(false);

type AiHistoryWorkspace = "sessions" | "maintain" | "rules" | "memory";
const WORKSPACE_TABS: Array<{
  label: string;
  value: AiHistoryWorkspace;
  icon: ConsoleNavIconId;
}> = [
  { label: "会话", value: "sessions", icon: "list" },
  { label: "群维护", value: "maintain", icon: "users" },
  { label: "规则", value: "rules", icon: "sliders" },
  { label: "记忆", value: "memory", icon: "database" },
];
const activeWorkspace = ref<AiHistoryWorkspace>("sessions");

// 会话筛选：bot / group / user（空 = 不限）
const filterBot = ref("");
const filterGroup = ref("");
const filterUser = ref("");
const expandedTurnKeys = ref<Record<string, boolean>>({});
const showAllSessions = ref(false);
const behaviorBusy = ref<Record<string, boolean>>({});

const BEHAVIOR_LABEL_OPTIONS = ["像人", "模板感强", "姿态不对", "带偏话题", "作为参考保留"] as const;
const advancedDebugKeys = ref<Record<string, boolean>>({});

function isAdvancedDebugExpanded(key: string): boolean {
  return !!advancedDebugKeys.value[key];
}

function toggleAdvancedDebug(key: string): void {
  advancedDebugKeys.value = {
    ...advancedDebugKeys.value,
    [key]: !advancedDebugKeys.value[key],
  };
}

function parseFilter(raw: string): number | null {
  const n = Number(raw.trim());
  return raw.trim() && Number.isFinite(n) ? n : null;
}

const combinedErr = computed(() => historyErr.value);
const anyBusy = computed(() => historyBusy.value);
const feedbackGroupId = computed(() => parseFilter(feedbackGroup.value));
const observeGroupId = computed(() => parseFilter(observeGroup.value));
const memoryBotId = computed(() => parseFilter(memoryBot.value));
const memoryGroupId = computed(() => parseFilter(memoryGroup.value));
const memoryBots = computed(() => botPickerRowsFromInstances(memoryInstances.value));
const memoryScope = computed(() => memoryScopeSummary(memoryBot.value, memoryGroup.value));
const behaviorRunsGroupId = computed(() => parseFilter(behaviorRunsGroup.value));
const patternsGroupId = computed(() => parseFilter(patternsGroup.value));
const behaviorRunsOverview = computed(() => [
  {
    label: "最近记录",
    value: String(behaviorRunsItems.value.length),
    accent: true,
  },
  {
    label: "筛选群号",
    value: behaviorRunsGroupId.value ? String(behaviorRunsGroupId.value) : "全部",
  },
  {
    label: "筛选结果",
    value: behaviorRunsOutcome.value ? labelOutcome(behaviorRunsOutcome.value) : "全部",
  },
]);
const patternsOverview = computed(() => [
  {
    label: "规则数",
    value: String(patternsItems.value.length),
    accent: true,
  },
  {
    label: "群号筛选",
    value: patternsGroupId.value ? String(patternsGroupId.value) : "全部",
  },
  {
    label: "场景",
    value: patternsScene.value ? labelScene(patternsScene.value) : "全部",
  },
]);

function kernelFlagLabel(active: boolean): string {
  return active ? "已生效" : "未生效";
}

const kernelStatusOverview = computed(() => {
  const status = kernelStatus.value;
  if (!status) return [];
  return [
    { label: "能力档位", value: labelFeatureLevel(status.feature_level), accent: true },
    { label: "大模型闲聊", value: status.llm_chat_enabled ? "开" : "关" },
    { label: "反哺收集", value: kernelFlagLabel(status.feedback_collect_active), accent: status.feedback_collect_active },
    { label: "学习加权", value: kernelFlagLabel(status.feedback_bias_active), accent: status.feedback_bias_active },
    { label: "写回语料", value: kernelFlagLabel(status.writeback_active), accent: status.writeback_active },
    {
      label: "会话摘要",
      value: kernelFlagLabel(Boolean(status.runtime_state_summary_active)),
      accent: Boolean(status.runtime_state_summary_active),
    },
    { label: "最近轨迹", value: String(kernelTraces.value.length), accent: kernelTraces.value.length > 0 },
  ];
});
function memoryBotOptionLabel(bot: BotRow): string {
  const nickname = memoryInstances.value?.bot_profiles?.[bot.self_id]?.nickname?.trim();
  return nickname ? `${nickname}（${bot.self_id}）` : bot.self_id;
}

const memoryBotOptions = computed(() =>
  memoryBots.value.map((bot) => ({
    value: bot.self_id,
    label: memoryBotOptionLabel(bot),
  })),
);

async function loadMemoryBots() {
  try {
    memoryInstances.value = await fetchInstances();
  } catch (e) {
    memoryErr.value = e instanceof Error ? e.message : String(e);
  }
}

const memoryOverview = computed(() => [
  { label: "群内旧事", value: String(memoryEntries.value.length), accent: true },
  { label: "关系备注", value: String(relationshipNotes.value.length), accent: relationshipNotes.value.length > 0 },
  { label: "知识源", value: String(knowledgeSources.value.length), accent: knowledgeSources.value.length > 0 },
  { label: "Bot", value: memoryBotId.value ? String(memoryBotId.value) : "未选择" },
]);

function kernelMemoryPolicyLine(status: ConversationKernelStatus | null): string {
  if (!status) return "";
  const policy = status.memory_policy || {};
  const readSession = policy.read_session ?? policy.allow_runtime_state;
  const readPersistent = policy.read_persistent_memory ?? policy.allow_persistent_memory;
  const readAffect = policy.read_affect ?? policy.allow_behavioral_learning;
  const writeSession = policy.write_session ?? policy.runtime_state_summary_enabled;
  const flags = [
    `读会话=${readSession ? "是" : "否"}`,
    `读长期记忆=${readPersistent ? "是" : "否"}`,
    `读群风格=${policy.read_group_style ? "是" : "否"}`,
    `读情感=${readAffect ? "是" : "否"}`,
    `写会话=${writeSession ? "是" : "否"}`,
  ];
  return `复读模式 ${labelRepeaterMode(status.llm_repeater_mode)} · 记忆读写：${flags.join(" / ")}`;
}

function kernelTraceKey(row: ConversationKernelTraceRow, index: number): string {
  return `${row.group_id ?? 0}-${row.bot_id ?? 0}-${row.created_at ?? index}-${row.action ?? ""}`;
}

function kernelTraceSummary(row: ConversationKernelTraceRow): string {
  const parts: string[] = [];
  const action = String(row.action || "").trim();
  if (action) parts.push(labelAction(action));
  const scene = String(row.scene || "").trim();
  if (scene) parts.push(labelScene(scene));
  const path = String(row.path || "").trim();
  if (path) parts.push(path.replace(/_/g, " "));
  return parts.join(" · ") || "对话决策轨迹";
}

function kernelTraceHighlights(row: ConversationKernelTraceRow): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = [];
  const mode = String(row.mode || "").trim();
  const reason = String(row.trace_reason || "").trim();
  const confidence = row.confidence;
  const stages = Array.isArray(row.generation_stages)
    ? row.generation_stages.map((item) => String(item)).filter(Boolean)
    : [];
  if (mode) items.push({ label: "模式", value: mode });
  if (reason) items.push({ label: "原因", value: reason });
  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    items.push({ label: "置信", value: `${Math.round(confidence * 100)}%` });
  }
  if (stages.length) items.push({ label: "阶段", value: stages.join(" → ") });
  return items;
}

function kernelTraceOpportunityClass(row: ConversationKernelTraceRow): string {
  if (row.opportunity_accepted === true) return "is-engaged";
  if (row.opportunity_accepted === false) return "is-ignored";
  return "is-pending";
}

function kernelTraceOpportunityLabel(row: ConversationKernelTraceRow): string {
  if (row.opportunity_accepted === true) return "机会通过";
  if (row.opportunity_accepted === false) return "机会未通过";
  return "机会待定";
}

function toggleKernelTraceExpanded(key: string) {
  expandedKernelTraceKeys.value = {
    ...expandedKernelTraceKeys.value,
    [key]: !expandedKernelTraceKeys.value[key],
  };
}

function toggleBehaviorTraceExpanded(key: string) {
  expandedBehaviorTraceKeys.value = {
    ...expandedBehaviorTraceKeys.value,
    [key]: !expandedBehaviorTraceKeys.value[key],
  };
}

const replayCopyBusy = ref<Record<string, boolean>>({});
const replayRunBusy = ref<Record<string, boolean>>({});
const replayRunDialogOpen = ref(false);
const replayRunDialogTitle = ref("");
const replayRunDialogSubtitle = ref("");
const replayRunResult = ref<LlmRuntimeReplayResult | null>(null);
const replayRunError = ref("");
const replayRunRawExpanded = ref(false);
const personaShapingCache = ref<Record<string, LlmPersonaShapingSummary>>({});
const personaShapingBusy = ref<Record<string, boolean>>({});
const personaShapingError = ref<Record<string, string>>({});
const replayPersonaShaping = ref<LlmPersonaShapingSummary | null>(null);

const replayRunTrace = computed(() => replayRunResult.value?.trace ?? null);
const replayRunReply = computed(() => String(replayRunResult.value?.reply || "").trim());
const replayRunAssistantPreview = computed(() => {
  const message = replayRunResult.value?.assistant_message;
  if (!message || typeof message !== "object") return "";
  const content = message.content;
  if (typeof content === "string") return content.trim();
  return "";
});
const replayRunSummary = computed(() => {
  const result = replayRunResult.value;
  if (!result) return [];
  const items = [
    { label: "执行模式", value: result.mode || "mock_tools", accent: true },
    { label: "任务", value: result.task || "llm_chat" },
    { label: "请求快照", value: result.request_snapshot_id || "无" },
    {
      label: "工具调用",
      value: typeof replayRunTrace.value?.tool_call_count === "number" ? String(replayRunTrace.value.tool_call_count) : "0",
    },
  ];
  const shaping = replayPersonaShaping.value;
  if (shaping?.lines?.length) {
    items.push({ label: "牛格塑形", value: shaping.lines.slice(0, 2).join("；") });
  }
  return items;
});

async function copyReplayPayload(requestId: string) {
  const key = requestId.trim();
  if (!key || replayCopyBusy.value[key]) return;
  replayCopyBusy.value = { ...replayCopyBusy.value, [key]: true };
  try {
    const payload = await fetchLlmRuntimeReplay(key);
    const ok = await copyTextToClipboard(JSON.stringify(payload, null, 2));
    pushConsoleToast(ok ? `已复制重放数据：${key}` : "复制重放数据失败", ok ? "ok" : "err");
  } catch {
    pushConsoleToast("复制重放数据失败", "err");
  } finally {
    replayCopyBusy.value = { ...replayCopyBusy.value, [key]: false };
  }
}

function closeReplayRunDialog() {
  replayRunDialogOpen.value = false;
  replayRunRawExpanded.value = false;
  replayPersonaShaping.value = null;
}

async function loadPersonaShaping(requestId: string): Promise<LlmPersonaShapingSummary | null> {
  const key = requestId.trim();
  if (!key) return null;
  if (personaShapingCache.value[key]) return personaShapingCache.value[key];
  if (personaShapingBusy.value[key]) return null;
  personaShapingBusy.value = { ...personaShapingBusy.value, [key]: true };
  personaShapingError.value = { ...personaShapingError.value, [key]: "" };
  try {
    const data: LlmRuntimeDebugData = await fetchLlmRuntimeDebug(key);
    const summary = data.persona_shaping ?? null;
    if (summary) {
      personaShapingCache.value = { ...personaShapingCache.value, [key]: summary };
    }
    return summary;
  } catch (e) {
    personaShapingError.value = {
      ...personaShapingError.value,
      [key]: e instanceof Error ? e.message : String(e),
    };
    return null;
  } finally {
    personaShapingBusy.value = { ...personaShapingBusy.value, [key]: false };
  }
}

function sessionTurnRequestId(row: SessionTurnRow): string {
  return String(row.feedbackEntry?.request_id || row.behaviorRun?.request_id || "").trim();
}

function personaShapingForRequestId(requestId: string): LlmPersonaShapingSummary | null {
  const key = requestId.trim();
  return key ? personaShapingCache.value[key] ?? null : null;
}

async function loadPersonaShapingForTurn(row: SessionTurnRow) {
  const requestId = sessionTurnRequestId(row);
  if (!requestId) return;
  await loadPersonaShaping(requestId);
}

async function copyReplayRunResult() {
  if (!replayRunResult.value) return;
  const ok = await copyTextToClipboard(JSON.stringify(replayRunResult.value, null, 2));
  pushConsoleToast(ok ? "已复制重放结果" : "复制重放结果失败", ok ? "ok" : "err");
}

async function runReplay(requestId: string) {
  const key = requestId.trim();
  if (!key || replayRunBusy.value[key]) return;
  replayRunBusy.value = { ...replayRunBusy.value, [key]: true };
  replayRunDialogTitle.value = `重放结果 · ${key}`;
  replayRunDialogSubtitle.value = "mock_tools";
  replayRunResult.value = null;
  replayRunError.value = "";
  replayRunRawExpanded.value = false;
  try {
    const result = await postLlmRuntimeReplayRun(key);
    replayRunDialogSubtitle.value = `${result.mode === "mock_tools" || !result.mode ? "模拟工具" : result.mode} · ${result.task === "llm_chat" || !result.task ? "@ 闲聊" : result.task}`;
    replayRunResult.value = result;
    replayPersonaShaping.value = result.persona_shaping ?? (await loadPersonaShaping(key));
  } catch (e) {
    replayRunError.value = e instanceof Error ? e.message : String(e);
  } finally {
    replayRunDialogOpen.value = true;
    replayRunBusy.value = { ...replayRunBusy.value, [key]: false };
  }
}

function toggleObserveAnnotateExpanded(requestId: string): void {
  expandedObserveAnnotateIds.value = {
    ...expandedObserveAnnotateIds.value,
    [requestId]: !expandedObserveAnnotateIds.value[requestId],
  };
}

function scrollSessionDetailIntoView(): void {
  if (!window.matchMedia("(max-width: 860px)").matches) return;
  sessionDetailPane.value?.detailAnchor?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const workspaceTabBadges = computed(() => ({
  sessions: sessions.value.length,
  maintain: pendingPromotionCandidates.value.length > 0
    ? pendingPromotionCandidates.value.length
    : (feedbackSummary.value?.count ?? 0),
  rules: patternsItems.value.length,
  memory: memoryEntries.value.length + relationshipNotes.value.length,
}));

type LearningLoopKind = "idle" | "need_bias" | "bias_on" | "full";

const learningLoopState = computed((): { kind: LearningLoopKind; writebackOn?: boolean } | null => {
  const status = kernelStatus.value;
  if (!status) return null;
  if (!status.feedback_collect_active) return { kind: "idle" };
  if (!status.feedback_bias_active) {
    return { kind: "need_bias", writebackOn: status.writeback_active };
  }
  if (!status.writeback_active) return { kind: "bias_on" };
  return { kind: "full" };
});

const showLearningLoopBanner = computed(() => {
  if (learningLoopDismissed.value) return false;
  return learningLoopState.value?.kind === "need_bias";
});

const learningLoopHint = computed(() => {
  const state = learningLoopState.value;
  if (!state) return "";
  if (state.kind === "need_bias") {
    return "已在收集反哺样本，但弱打分加权未开启，维护操作暂不会影响复读选词。";
  }
  if (state.kind === "bias_on") {
    return "反哺加权已开启；可在会话里排除坏样本，好样本会逐步影响接话偏好。";
  }
  if (state.kind === "full") {
    return "收集、加权与自动写回均已开启；好样本达标后会写入接话语料，维护操作可加速收敛。";
  }
  return "反哺收集未开启，可在 AI 配置 → Bot 对话策略 中打开。";
});

function dismissLearningLoopBanner(): void {
  learningLoopDismissed.value = true;
  localStorage.setItem(LEARNING_LOOP_DISMISS_KEY, "1");
}

function openLlmCommonConfig(focusLearningLoop = false): void {
  void router.push(
    focusLearningLoop
      ? `${aiConfigSectionPath("strategy")}#learning-loop`
      : aiConfigSectionPath("strategy"),
  );
}

function applyWorkspaceFromQuery(raw: unknown = route.query.workspace): void {
  const workspaceRaw = String(raw ?? "").trim();
  if (
    workspaceRaw === "sessions"
    || workspaceRaw === "maintain"
    || workspaceRaw === "rules"
    || workspaceRaw === "memory"
  ) {
    activeWorkspace.value = workspaceRaw;
  }
}

/** 学习闭环已开时：切到「会话」做排除/期望回复验证（同页 query 不会驱动 tab，需写 ref） */
function openHistoryVerify(): void {
  activeWorkspace.value = "sessions";
  if (String(route.query.workspace ?? "") !== "sessions") {
    void router.replace({
      path: route.path,
      query: { ...route.query, workspace: "sessions" },
    });
  }
  void nextTick(() => {
    if (selectedSessionKey.value) {
      scrollSessionDetailIntoView();
    }
    sessionsWorkspaceAnchor.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
const workspaceContextLabel = computed(() => {
  const session = selectedSession.value;
  if (!session) return "";
  return session.group_id === 0
    ? `私聊 · 用户 ${session.user_id} · Bot ${session.bot_id}`
    : `群 ${session.group_id} · 用户 ${session.user_id} · Bot ${session.bot_id}`;
});
const historyContextTitle = computed(() => {
  const session = selectedSession.value;
  if (session) {
    return session.group_id === 0
      ? `私聊 · 用户 ${session.user_id}`
      : `群 ${session.group_id} · 用户 ${session.user_id}`;
  }
  if (observeGroupId.value) return `群 ${observeGroupId.value}`;
  if (activeWorkspace.value === "maintain") return "群维护";
  if (activeWorkspace.value === "rules") return "行为规则";
  if (activeWorkspace.value === "memory") return "记忆与知识";
  return "未选择上下文";
});
const historyContextMeta = computed(() => {
  const session = selectedSession.value;
  if (session) {
    return `Bot ${session.bot_id} · ${session.turn_count ?? 0} 条对话`;
  }
  if (activeWorkspace.value === "maintain") {
    return feedbackPanelSummary.value || "输入群号后刷新维护面板";
  }
  if (activeWorkspace.value === "sessions") return "在左侧筛选并选择会话";
  if (activeWorkspace.value === "rules") return "按群号维护行为模式与样本";
  if (activeWorkspace.value === "memory") return "按 Bot / 群号检索记忆条目";
  return "";
});
const historyContextGroupId = computed(() => {
  const session = selectedSession.value;
  if (session && session.group_id > 0) return session.group_id;
  return observeGroupId.value;
});
const selectedSession = computed(() =>
  sessions.value.find((item) => item.session_key === selectedSessionKey.value) ?? null,
);

const visibleFeedbackItems = computed(() => {
  const scene = observeScene.value.trim();
  if (!scene) return feedbackItems.value;
  return feedbackItems.value.filter((item) => (item.behavior_scene || "") === scene);
});

const pendingPromotionCandidates = computed(() =>
  promotionCandidates.value.filter((item) => !item.promoted && !String(item.rejected_reason || "").trim()),
);

const feedbackPanelSummary = computed(() => {
  if (!feedbackGroupId.value) return "未填群号";
  if (feedbackBusy.value) return "读取中…";
  const count = visibleFeedbackItems.value.length;
  const pending = feedbackSummary.value?.promotion_candidate_count ?? 0;
  const stats = feedbackSummary.value?.learning_stats;
  const hitRate = stats?.feedback_bias_hit_rate;
  const hitLabel =
    typeof hitRate === "number" && stats?.repeater_reply_count
      ? ` · 7日加权命中 ${Math.round(hitRate * 100)}%`
      : "";
  if (!count) return observeScene.value ? "当前场景下暂无样本" : "当前群暂无样本";
  return `样本 ${count}${pending ? ` · 待晋升 ${pending}` : ""}${hitLabel}`;
});

const promotionPanelSummary = computed(() => {
  if (!feedbackGroupId.value) return "需先填群号";
  if (promotionCandidatesBusy.value) return "读取中…";
  const pending = pendingPromotionCandidates.value.length;
  const total = promotionCandidates.value.length;
  if (!total) return "暂无候选";
  return `待审批 ${pending} / 共 ${total}`;
});

const behaviorPanelSummary = computed(() => {
  if (behaviorRunsBusy.value) return "读取中…";
  const count = behaviorRunsItems.value.length;
  if (!count) return "当前筛选下暂无记录";
  const group = behaviorRunsGroupId.value ? `群 ${behaviorRunsGroupId.value}` : "全部群";
  const scene = behaviorRunsScene.value ? labelScene(behaviorRunsScene.value) : "全部场景";
  const outcome = behaviorRunsOutcome.value;
  const outcomeLabel = outcome
    ? BEHAVIOR_OUTCOME_OPTIONS.find((item) => item.value === outcome)?.label || outcome
    : "";
  return `${count} 条 · ${group} · ${scene}${outcomeLabel ? ` · ${outcomeLabel}` : ""}`;
});

const personaPanelSummary = computed(() => {
  if (!observeGroupId.value) return "未填群号 · 在上方上下文条输入，或从会话选群";
  if (observeScene.value) return `群 ${observeGroupId.value} · 场景 ${observeScene.value} · 点击展开`;
  return `群 ${observeGroupId.value} · 点击展开查看情感轴`;
});

function pickGroupFromSessions(): void {
  activeWorkspace.value = "sessions";
}

function isMaintainPanelExpanded(key: MaintainPanelKey): boolean {
  return maintainPanelExpanded.value[key];
}

function toggleMaintainPanel(key: MaintainPanelKey): void {
  maintainPanelExpanded.value = {
    ...maintainPanelExpanded.value,
    [key]: !maintainPanelExpanded.value[key],
  };
}

function promotionCandidateStatusLabel(item: LlmPromotionCandidate): string {
  if (item.promoted) {
    const wb = String(item.writeback_status || "").trim();
    if (wb === "written") return "已晋升并写回";
    if (wb === "failed") return "已晋升（写回失败）";
    return "已晋升";
  }
  if (String(item.rejected_reason || "").trim()) return "已拒绝";
  return "待审批";
}

function promotionWritebackHint(item: LlmPromotionCandidate): string {
  const wb = String(item.writeback_status || "").trim();
  if (!wb) return "";
  if (wb === "written") return "已写入本机接话语料";
  if (wb === "failed") {
    const msg = String(item.writeback_message || "").trim();
    return msg ? `写回失败：${msg}` : "写回失败";
  }
  return `写回状态：${wb}`;
}

const sortedPatternsItems = computed(() => {
  const rows = [...patternsItems.value];
  if (patternSortKey.value === "pattern_id") {
    return rows.sort((a, b) => a.pattern_id.localeCompare(b.pattern_id));
  }
  if (patternSortKey.value === "manual_score") {
    return rows.sort((a, b) => (b.manual_score ?? 0) - (a.manual_score ?? 0));
  }
  return rows.sort((a, b) => (b.success_score ?? 0) - (a.success_score ?? 0));
});

const visibleSessions = computed(() =>
  showAllSessions.value ? sessions.value : sessions.value.slice(0, 8),
);

function turnKey(createdAt: string | number, index: number): string {
  return `${createdAt}-${index}`;
}

function toggleObserveText(key: string): void {
  expandedObserveKeys.value = {
    ...expandedObserveKeys.value,
    [key]: !expandedObserveKeys.value[key],
  };
}

function applyObserveScene(scene: string) {
  observeScene.value = scene;
  behaviorRunsScene.value = scene;
  void refreshBehaviorRuns();
}

function toggleTurnExpanded(key: string): void {
  expandedTurnKeys.value = {
    ...expandedTurnKeys.value,
    [key]: !expandedTurnKeys.value[key],
  };
}

function hasBehaviorLabel(run: LlmHistoryBehaviorRun, label: string): boolean {
  return Array.isArray(run.manual_labels) && run.manual_labels.includes(label);
}

function isBehaviorBusy(requestId: string): boolean {
  return !!behaviorBusy.value[requestId];
}

function formatBehaviorSource(payload?: LlmHistoryBehaviorAutoFeedbackPayload | null): string {
  const source = payload?.source || "";
  if (source === "ambient") return "群环境";
  if (source === "session") return "同会话";
  if (source === "mixed") return "混合";
  if (source === "timeout") return "超时";
  return "未知";
}

function formatBehaviorSignal(payload?: LlmHistoryBehaviorAutoFeedbackPayload | null): string {
  const signal = payload?.matched_signal || "";
  if (signal === "derailed_token") return "命中跑题信号";
  if (signal === "negative_token") return "命中负反馈信号";
  if (signal === "engaged_token") return "命中接话信号";
  if (signal === "ambient_continued_without_pickup") return "群里继续聊但没接 bot";
  if (signal === "timeout_without_followup") return "窗口内无人承接";
  if (signal === "followup_outside_window") return "有后续但超出观察窗";
  if (signal === "default_neutral") return "默认一般";
  return signal || "未标注";
}

function formatBehaviorTokens(payload?: LlmHistoryBehaviorAutoFeedbackPayload | null): string {
  return payload?.matched_tokens?.length ? payload.matched_tokens.join(" / ") : "无";
}

function behaviorAgentTrace(payload?: LlmHistoryBehaviorAutoFeedbackPayload | null): LlmHistoryBehaviorAgentTrace | null {
  if (!payload?.agent_trace || typeof payload.agent_trace !== "object") return null;
  return payload.agent_trace;
}

function behaviorAgentTraceKey(scope: string, requestId: string): string {
  return `${scope}:${requestId}`;
}

function behaviorAgentTraceHighlights(
  trace?: LlmHistoryBehaviorAgentTrace | null,
): Array<{ label: string; value: string }> {
  if (!trace) return [];
  const items: Array<{ label: string; value: string }> = [];
  if (trace.agent_stage_plan?.length) {
    items.push({ label: "阶段", value: trace.agent_stage_plan.join(" -> ") });
  }
  if (typeof trace.tool_call_count === "number") {
    items.push({ label: "工具调用", value: String(trace.tool_call_count) });
  }
  if (typeof trace.tool_schema_count === "number") {
    items.push({ label: "可用工具", value: String(trace.tool_schema_count) });
  }
  if (trace.prefetched_tool) {
    items.push({ label: "预取", value: trace.prefetched_tool });
  }
  if (trace.final_stage) {
    items.push({ label: "结束阶段", value: trace.final_stage });
  }
  if (trace.request_snapshot_id) {
    items.push({ label: "请求快照", value: trace.request_snapshot_id });
  }
  if (trace.stages?.length) {
    items.push({
      label: "阶段摘要",
      value: trace.stages
        .map((stage) => [stage.stage, stage.status, stage.model].filter(Boolean).join(":"))
        .join(" / "),
    });
  }
  const rounds = Array.isArray(trace.rounds) ? trace.rounds.length : 0;
  if (rounds > 0) {
    items.push({ label: "轮次", value: String(rounds) });
  }
  return items;
}

function outcomeClass(outcome?: string | null): string {
  const value = outcome || "";
  if (value === "engaged") return "is-engaged";
  if (value === "ignored") return "is-ignored";
  if (value === "derailed" || value === "awkward") return "is-bad";
  if (value === "neutral") return "is-neutral";
  return "is-pending";
}

interface SessionTurnRow {
  turn: LlmHistoryTurn;
  index: number;
  behaviorRun: LlmHistoryBehaviorRun | null;
  decisionTrace: ConversationKernelTraceRow | null;
  precedingUserText: string;
  feedbackEntry: LlmRepeaterFeedbackEntry | null;
}

/** 最新轮次在前；每轮内保持用户 → Bot 顺序。 */
function orderSessionTurnRowsForDisplay(rows: SessionTurnRow[]): SessionTurnRow[] {
  if (rows.length <= 1) return rows;
  const groups: SessionTurnRow[][] = [];
  let current: SessionTurnRow[] = [];
  for (const row of rows) {
    if (
      row.turn.role === "user"
      && current.length > 0
      && current[current.length - 1]?.turn.role === "assistant"
    ) {
      groups.push(current);
      current = [row];
      continue;
    }
    current.push(row);
  }
  if (current.length) groups.push(current);
  return groups.reverse().flat();
}

const DECISION_TRACE_MATCH_WINDOW_SEC = 120;

function traceTimestamp(row: ConversationKernelTraceRow): number {
  const createdAt = Number(row.created_at || 0);
  if (createdAt > 0) return createdAt;
  const ts = Number(row.ts || 0);
  return ts > 0 ? ts : 0;
}

function decisionTraceStableKey(row: ConversationKernelTraceRow): string {
  return `${row.group_id ?? 0}-${row.bot_id ?? 0}-${traceTimestamp(row)}-${row.action ?? ""}-${row.trace_reason ?? ""}`;
}

function matchDecisionTraceForAssistantTurn(
  turn: LlmHistoryTurn,
  traces: ConversationKernelTraceRow[],
  consumed: Set<string>,
): ConversationKernelTraceRow | null {
  const turnAt = Number(turn.created_at || 0);
  if (turnAt <= 0) return null;
  let best: ConversationKernelTraceRow | null = null;
  let bestScore = Infinity;
  for (const row of traces) {
    const key = decisionTraceStableKey(row);
    if (consumed.has(key)) continue;
    const ts = traceTimestamp(row);
    if (ts <= 0) continue;
    const delta = turnAt - ts;
    if (Math.abs(delta) > DECISION_TRACE_MATCH_WINDOW_SEC) continue;
    const score = delta >= 0 ? delta : Math.abs(delta) + 1000;
    if (score < bestScore) {
      best = row;
      bestScore = score;
    }
  }
  if (best) {
    consumed.add(decisionTraceStableKey(best));
    return best;
  }
  return null;
}

function matchBehaviorRunForAssistantTurn(
  turn: LlmHistoryTurn,
  precedingUserText: string,
  runs: LlmHistoryBehaviorRun[],
  consumed: Set<string>,
): LlmHistoryBehaviorRun | null {
  const contentKey = String(turn.content || "").trim();
  const createdAt = Number(turn.created_at || 0);
  for (const run of runs) {
    if (consumed.has(run.request_id)) continue;
    const replyKey = String(run.reply_text || "").trim();
    if (replyKey && replyKey === contentKey) {
      consumed.add(run.request_id);
      return run;
    }
  }
  for (const run of runs) {
    if (consumed.has(run.request_id)) continue;
    if (createdAt > 0 && Number(run.created_at || 0) === createdAt) {
      consumed.add(run.request_id);
      return run;
    }
  }
  for (const run of runs) {
    if (consumed.has(run.request_id)) continue;
    const replyKey = String(run.reply_text || "").trim();
    const userKey = String(run.user_text || "").trim();
    if (replyKey === contentKey && (!userKey || userKey === precedingUserText)) {
      consumed.add(run.request_id);
      return run;
    }
  }
  return null;
}

function turnMaintKey(row: SessionTurnRow): string {
  return turnKey(row.turn.created_at, row.index);
}

function matchFeedbackForAssistantTurn(
  turn: LlmHistoryTurn,
  precedingUserText: string,
  entries: LlmRepeaterFeedbackEntry[],
  behaviorRun: LlmHistoryBehaviorRun | null,
  consumed: Set<string>,
): LlmRepeaterFeedbackEntry | null {
  if (behaviorRun?.request_id) {
    for (const item of entries) {
      const entryKey = item.entry_id || item.request_id;
      if (!entryKey || consumed.has(entryKey)) continue;
      if (item.request_id === behaviorRun.request_id || item.entry_id === behaviorRun.request_id) {
        consumed.add(entryKey);
        return item;
      }
    }
  }
  const contentKey = String(turn.content || "").trim();
  for (const item of entries) {
    const entryKey = item.entry_id || item.request_id;
    if (!entryKey || consumed.has(entryKey)) continue;
    if (String(item.reply_text || "").trim() !== contentKey) continue;
    const userKey = String(item.user_text || "").trim();
    if (userKey && userKey !== precedingUserText) continue;
    consumed.add(entryKey);
    return item;
  }
  return null;
}

function isFeedbackManageBusy(entry: LlmRepeaterFeedbackEntry): boolean {
  const key = entry.entry_id || entry.request_id;
  return !!feedbackManageBusy.value[key];
}

function correctionDraftKey(row: SessionTurnRow): string {
  return turnMaintKey(row);
}

function feedbackCorrectionRequestId(row: SessionTurnRow): string {
  return row.feedbackEntry?.request_id
    || row.feedbackEntry?.entry_id
    || row.behaviorRun?.request_id
    || `session-correct-${row.turn.created_at}`;
}

function getCorrectionDraft(row: SessionTurnRow): string {
  const key = correctionDraftKey(row);
  if (Object.prototype.hasOwnProperty.call(feedbackCorrectionDraft.value, key)) {
    return feedbackCorrectionDraft.value[key];
  }
  return row.feedbackEntry?.corrected_reply_text ?? "";
}

function setCorrectionDraft(row: SessionTurnRow, value: string) {
  feedbackCorrectionDraft.value = {
    ...feedbackCorrectionDraft.value,
    [correctionDraftKey(row)]: value,
  };
}

function feedbackCardCorrectionDraftKey(item: LlmRepeaterFeedbackEntry): string {
  return item.entry_id || item.request_id || "";
}

function getFeedbackCardCorrectionDraft(item: LlmRepeaterFeedbackEntry): string {
  const key = feedbackCardCorrectionDraftKey(item);
  if (key && Object.prototype.hasOwnProperty.call(feedbackCorrectionDraft.value, key)) {
    return feedbackCorrectionDraft.value[key];
  }
  return item.corrected_reply_text ?? "";
}

function setFeedbackCardCorrectionDraft(item: LlmRepeaterFeedbackEntry, value: string) {
  const key = feedbackCardCorrectionDraftKey(item);
  if (!key) return;
  feedbackCorrectionDraft.value = {
    ...feedbackCorrectionDraft.value,
    [key]: value,
  };
}

function isCorrectionManageBusy(key: string): boolean {
  return !!feedbackManageBusy.value[key];
}

const sessionTurnRows = computed(() => {
  const detail = sessionDetail.value;
  if (!detail) {
    return { rows: [] as SessionTurnRow[], orphanRuns: [] as LlmHistoryBehaviorRun[] };
  }
  const runs = [...(detail.behavior_runs || [])];
  const feedbackEntries = [...(detail.feedback_entries || [])];
  const runConsumed = new Set<string>();
  const feedbackConsumed = new Set<string>();
  const traceConsumed = new Set<string>();
  const traces = [...sessionDecisionTraces.value];
  let lastUserText = "";
  const rows: SessionTurnRow[] = [];
  for (let index = 0; index < detail.turns.length; index += 1) {
    const turn = detail.turns[index];
    if (turn.role === "user") {
      lastUserText = turn.content;
      rows.push({
        turn,
        index,
        behaviorRun: null,
        decisionTrace: null,
        precedingUserText: "",
        feedbackEntry: null,
      });
      continue;
    }
    const behaviorRun = matchBehaviorRunForAssistantTurn(turn, lastUserText, runs, runConsumed);
    const feedbackEntry = matchFeedbackForAssistantTurn(
      turn,
      lastUserText,
      feedbackEntries,
      behaviorRun,
      feedbackConsumed,
    );
    const decisionTrace = matchDecisionTraceForAssistantTurn(turn, traces, traceConsumed);
    rows.push({
      turn,
      index,
      behaviorRun,
      decisionTrace,
      precedingUserText: lastUserText,
      feedbackEntry,
    });
  }
  const orphanRuns = runs.filter((run) => !runConsumed.has(run.request_id));
  return { rows: orderSessionTurnRowsForDisplay(rows), orphanRuns };
});

const expandedSessionMaintainIds = ref<Record<string, boolean>>({});

function isSessionMaintainExpanded(key: string): boolean {
  return !!expandedSessionMaintainIds.value[key];
}

function toggleSessionMaintainExpanded(key: string, row?: SessionTurnRow): void {
  const next = !expandedSessionMaintainIds.value[key];
  expandedSessionMaintainIds.value = {
    ...expandedSessionMaintainIds.value,
    [key]: next,
  };
  if (next && row) {
    void loadPersonaShapingForTurn(row);
  }
}

function sessionKeyForBehaviorRun(run: LlmHistoryBehaviorRun): string {
  return buildSessionKey(run.bot_id, run.group_id, run.user_id);
}

function onBehaviorRunsGroupTouched(value: string): void {
  behaviorRunsGroupTouched.value = true;
  observeGroup.value = value;
  observeGroupTouched.value = true;
}

function buildSessionKey(botId?: number | null, groupId?: number | null, userId?: number | null): string {
  if (!botId || userId == null) return "";
  return `${botId}:${groupId ?? 0}:${userId}`;
}

function resetPatternEditor(): void {
  patternEditorMode.value = "create";
  patternEditor.value = {
    pattern_id: "",
    scene: "smalltalk",
    action: "ack_then_short_reply",
    scope_group_id: patternsGroupId.value,
    success_score: 0,
    manual_score: 0,
    disabled: false,
    persona_affinity: "",
    trigger_features: [],
    reference_examples: [],
  };
}

function openPatternEditorCreate(): void {
  resetPatternEditor();
  patternEditorOpen.value = true;
}

function openPatternEditorEdit(item: LlmBehaviorPattern): void {
  editPattern(item);
  patternEditorOpen.value = true;
}

function closePatternEditor(): void {
  if (patternSaveBusy.value) return;
  patternEditorOpen.value = false;
}

function editPattern(item: LlmBehaviorPattern): void {
  patternEditorMode.value = "edit";
  patternEditor.value = {
    pattern_id: item.pattern_id,
    scene: item.scene,
    action: item.action,
    scope_group_id: item.scope_group_id ?? null,
    success_score: item.success_score ?? 0,
    manual_score: item.manual_score ?? 0,
    disabled: !!item.disabled,
    persona_affinity: item.persona_affinity ?? "",
    trigger_features: [...(item.trigger_features ?? [])],
    reference_examples: [...(item.reference_examples ?? [])],
  };
}

async function focusPattern(patternId: string, scene?: string, groupId?: number | null) {
  activeWorkspace.value = "rules";
  if (groupId != null && groupId > 0) {
    patternsGroup.value = String(groupId);
    patternsGroupTouched.value = true;
  }
  if (scene) {
    patternsScene.value = scene;
  }
  await refreshPatterns();
  const found = patternsItems.value.find((item) => item.pattern_id === patternId);
  if (found) {
    openPatternEditorEdit(found);
    return;
  }
  patternEditorMode.value = "create";
  patternEditor.value = {
    pattern_id: patternId,
    scene: scene || "smalltalk",
    action: "ack_then_short_reply",
    scope_group_id: groupId ?? patternsGroupId.value,
    success_score: 0,
    manual_score: 0,
    disabled: false,
    persona_affinity: "",
    trigger_features: [],
    reference_examples: [],
  };
  patternEditorOpen.value = true;
}

function openMaintainWorkspace(groupId?: number | null) {
  activeWorkspace.value = "maintain";
  if (groupId != null && groupId > 0) {
    const next = String(groupId);
    observeGroup.value = next;
    feedbackGroup.value = next;
    behaviorRunsGroup.value = next;
    patternsGroup.value = next;
    observeGroupTouched.value = true;
    feedbackGroupTouched.value = true;
    behaviorRunsGroupTouched.value = true;
    patternsGroupTouched.value = true;
    void refreshFeedback();
    void refreshBehaviorRuns();
    void refreshPatterns();
  }
}

function onContextGroupChange(value: string) {
  observeGroup.value = value;
  observeGroupTouched.value = true;
  feedbackGroup.value = value;
  behaviorRunsGroup.value = value;
  feedbackGroupTouched.value = true;
  behaviorRunsGroupTouched.value = true;
}

function onContextSceneChange(value: string) {
  observeScene.value = value;
  behaviorRunsScene.value = value;
  void refreshBehaviorRuns();
}

async function openRunInSession(run: LlmHistoryBehaviorRun) {
  const key = buildSessionKey(run.bot_id, run.group_id, run.user_id);
  if (!key) return;
  activeWorkspace.value = "sessions";
  if (!sessions.value.some((item) => item.session_key === key)) {
    await refreshSessions();
  }
  if (sessions.value.some((item) => item.session_key === key)) {
    selectedSessionKey.value = key;
    await nextTick();
    scrollSessionDetailIntoView();
  }
}

async function refreshObservePanels() {
  const tasks = [
    refreshKernelStatus(),
    refreshKernelTraces(),
    refreshFeedback(),
    refreshBehaviorRuns(),
  ];
  if (feedbackGroupId.value != null && feedbackGroupId.value > 0) {
    tasks.push(refreshPromotionCandidates());
  }
  await Promise.all(tasks);
}

async function refreshKernelStatus() {
  kernelStatusBusy.value = true;
  kernelStatusErr.value = "";
  try {
    kernelStatus.value = await fetchConversationKernelStatus();
  } catch (e) {
    kernelStatus.value = null;
    kernelStatusErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    kernelStatusBusy.value = false;
  }
}

async function refreshKernelTraces() {
  kernelTracesBusy.value = true;
  kernelTracesErr.value = "";
  try {
    const data = await fetchConversationKernelTraces({
      groupId: observeGroupId.value,
      limit: 30,
    });
    kernelTraces.value = data.items;
  } catch (e) {
    kernelTraces.value = [];
    kernelTracesErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    kernelTracesBusy.value = false;
  }
}

async function refreshMemoryWorkspace() {
  if (!memoryBotId.value) {
    memoryEntries.value = [];
    relationshipNotes.value = [];
    knowledgeSources.value = [];
    memoryErr.value = "请先选择 Bot QQ";
    return;
  }
  memoryBusy.value = true;
  memoryErr.value = "";
  try {
    const [memoryData, relationshipData, knowledgeData] = await Promise.all([
      fetchConversationKernelMemory({
        botId: memoryBotId.value,
        groupId: memoryGroupId.value,
        query: memoryQuery.value,
        limit: 50,
      }),
      fetchConversationKernelRelationshipNotes({
        botId: memoryBotId.value,
        groupId: memoryGroupId.value,
        query: memoryQuery.value,
        limit: 50,
      }),
      fetchConversationKernelKnowledgeSources(),
    ]);
    memoryEntries.value = memoryData.items;
    relationshipNotes.value = relationshipData.items;
    knowledgeSources.value = knowledgeData.items;
  } catch (e) {
    memoryEntries.value = [];
    relationshipNotes.value = [];
    knowledgeSources.value = [];
    memoryErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    memoryBusy.value = false;
  }
}

async function deleteMemoryEntry(item: ConversationKernelMemoryEntry) {
  if (memoryDeleteBusy.value) return;
  memoryDeleteBusy.value = `memory:${item.id}`;
  try {
    await postConversationKernelMemoryDelete({ id: item.id, botId: item.bot_id });
    pushConsoleToast("已删除记忆条目", "ok");
    await refreshMemoryWorkspace();
  } catch (e) {
    pushConsoleToast(e instanceof Error ? e.message : "删除记忆条目失败", "err");
  } finally {
    memoryDeleteBusy.value = "";
  }
}

async function deleteRelationshipNote(item: ConversationKernelRelationshipNote) {
  if (memoryDeleteBusy.value) return;
  memoryDeleteBusy.value = `relationship:${item.id}`;
  try {
    await postConversationKernelRelationshipNoteDelete({ id: item.id, botId: item.bot_id });
    pushConsoleToast("已删除关系备注", "ok");
    await refreshMemoryWorkspace();
  } catch (e) {
    pushConsoleToast(e instanceof Error ? e.message : "删除关系备注失败", "err");
  } finally {
    memoryDeleteBusy.value = "";
  }
}

async function saveBehaviorRun(
  run: LlmHistoryBehaviorRun,
  patch: {
    labels?: string[];
    finalOutcome?: string | null;
    disabled?: boolean;
  },
) {
  behaviorBusy.value = {
    ...behaviorBusy.value,
    [run.request_id]: true,
  };
  historyErr.value = "";
  try {
    const updated = await postLlmHistoryBehaviorAnnotate({
      requestId: run.request_id,
      labels: patch.labels ?? run.manual_labels ?? [],
      finalOutcome: patch.finalOutcome ?? run.final_outcome ?? "",
      disabled: typeof patch.disabled === "boolean" ? patch.disabled : !!run.disabled,
    });
    behaviorRunsItems.value = behaviorRunsItems.value.map((item) => (
      item.request_id === updated.request_id ? updated : item
    ));
    if (sessionDetail.value) {
      sessionDetail.value = {
        ...sessionDetail.value,
        behavior_runs: sessionDetail.value.behavior_runs.map((item) => (
          item.request_id === updated.request_id ? updated : item
        )),
      };
    }
  } catch (e) {
    historyErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    behaviorBusy.value = {
      ...behaviorBusy.value,
      [run.request_id]: false,
    };
  }
}

async function toggleBehaviorLabel(run: LlmHistoryBehaviorRun, label: string) {
  const nextLabels = hasBehaviorLabel(run, label)
    ? run.manual_labels.filter((item) => item !== label)
    : [...(run.manual_labels ?? []), label];
  await saveBehaviorRun(run, { labels: nextLabels });
}

async function changeBehaviorOutcome(run: LlmHistoryBehaviorRun, value: string) {
  await saveBehaviorRun(run, { finalOutcome: value || null });
}

async function toggleBehaviorDisabled(run: LlmHistoryBehaviorRun) {
  await saveBehaviorRun(run, { disabled: !run.disabled });
}

async function manageFeedbackEntry(
  entry: LlmRepeaterFeedbackEntry,
  action: "invalidate" | "restore" | "delete",
) {
  const busyKey = entry.entry_id || entry.request_id;
  if (!busyKey || feedbackManageBusy.value[busyKey]) return;
  feedbackManageBusy.value = { ...feedbackManageBusy.value, [busyKey]: true };
  try {
    await postLlmRepeaterFeedbackManage({
      entryId: entry.entry_id,
      requestId: entry.request_id,
      action,
    });
    const toastMap = {
      invalidate: "已标记为不适合学习",
      restore: "已恢复参与学习",
      delete: "已删除反哺记录",
    };
    pushConsoleToast(toastMap[action], "ok");
    await refreshSessionDetail();
    if (feedbackGroupId.value) {
      await refreshFeedback();
    }
  } catch (e) {
    pushConsoleToast(e instanceof Error ? e.message : "反哺维护失败", "err");
  } finally {
    feedbackManageBusy.value = { ...feedbackManageBusy.value, [busyKey]: false };
  }
}

async function saveFeedbackCorrectionForTurn(row: SessionTurnRow) {
  const session = sessionDetail.value?.session;
  if (!session) return;
  const draft = getCorrectionDraft(row).trim();
  if (!draft) {
    pushConsoleToast("请填写期望回复", "err");
    return;
  }
  const busyKey = row.feedbackEntry?.entry_id
    || row.feedbackEntry?.request_id
    || correctionDraftKey(row);
  if (feedbackManageBusy.value[busyKey]) return;
  feedbackManageBusy.value = { ...feedbackManageBusy.value, [busyKey]: true };
  try {
    await postLlmRepeaterFeedbackManage({
      entryId: row.feedbackEntry?.entry_id,
      requestId: feedbackCorrectionRequestId(row),
      action: "correct",
      correctedReplyText: draft,
      botId: session.bot_id,
      groupId: session.group_id,
      userId: session.user_id,
      userText: row.precedingUserText,
      replyText: row.turn.content,
      llmRoute: row.feedbackEntry?.llm_route,
      behaviorScene: row.feedbackEntry?.behavior_scene || row.behaviorRun?.scene,
    });
    pushConsoleToast("已保存期望回复，后续 @ 闲聊会参考", "ok");
    feedbackCorrectionDraft.value = { ...feedbackCorrectionDraft.value, [correctionDraftKey(row)]: draft };
    await refreshSessionDetail();
    if (feedbackGroupId.value) {
      await refreshFeedback();
    }
  } catch (e) {
    pushConsoleToast(e instanceof Error ? e.message : "保存期望回复失败", "err");
  } finally {
    feedbackManageBusy.value = { ...feedbackManageBusy.value, [busyKey]: false };
  }
}

async function clearFeedbackCorrectionForTurn(row: SessionTurnRow) {
  const requestId = row.feedbackEntry?.request_id || row.feedbackEntry?.entry_id;
  if (!requestId) {
    pushConsoleToast("尚无已保存的校正", "err");
    return;
  }
  const busyKey = requestId;
  if (feedbackManageBusy.value[busyKey]) return;
  feedbackManageBusy.value = { ...feedbackManageBusy.value, [busyKey]: true };
  try {
    await postLlmRepeaterFeedbackManage({
      entryId: row.feedbackEntry?.entry_id,
      requestId: row.feedbackEntry?.request_id,
      action: "clear_correction",
    });
    pushConsoleToast("已清除期望回复", "ok");
    feedbackCorrectionDraft.value = { ...feedbackCorrectionDraft.value, [correctionDraftKey(row)]: "" };
    await refreshSessionDetail();
    if (feedbackGroupId.value) {
      await refreshFeedback();
    }
  } catch (e) {
    pushConsoleToast(e instanceof Error ? e.message : "清除期望回复失败", "err");
  } finally {
    feedbackManageBusy.value = { ...feedbackManageBusy.value, [busyKey]: false };
  }
}

async function saveFeedbackCardCorrection(item: LlmRepeaterFeedbackEntry) {
  const draft = getFeedbackCardCorrectionDraft(item).trim();
  if (!draft) {
    pushConsoleToast("请填写期望回复", "err");
    return;
  }
  const busyKey = item.entry_id || item.request_id;
  if (!busyKey || feedbackManageBusy.value[busyKey]) return;
  feedbackManageBusy.value = { ...feedbackManageBusy.value, [busyKey]: true };
  try {
    await postLlmRepeaterFeedbackManage({
      entryId: item.entry_id,
      requestId: item.request_id,
      action: "correct",
      correctedReplyText: draft,
      botId: item.bot_id,
      groupId: item.group_id,
      userId: item.user_id,
      userText: item.user_text,
      replyText: item.reply_text,
      llmRoute: item.llm_route,
      behaviorScene: item.behavior_scene,
    });
    pushConsoleToast("已保存期望回复", "ok");
    feedbackCorrectionDraft.value = { ...feedbackCorrectionDraft.value, [busyKey]: draft };
    await refreshSessionDetail();
    if (feedbackGroupId.value) {
      await refreshFeedback();
    }
  } catch (e) {
    pushConsoleToast(e instanceof Error ? e.message : "保存期望回复失败", "err");
  } finally {
    feedbackManageBusy.value = { ...feedbackManageBusy.value, [busyKey]: false };
  }
}

async function clearFeedbackCardCorrection(item: LlmRepeaterFeedbackEntry) {
  const busyKey = item.entry_id || item.request_id;
  if (!busyKey || feedbackManageBusy.value[busyKey]) return;
  feedbackManageBusy.value = { ...feedbackManageBusy.value, [busyKey]: true };
  try {
    await postLlmRepeaterFeedbackManage({
      entryId: item.entry_id,
      requestId: item.request_id,
      action: "clear_correction",
    });
    pushConsoleToast("已清除期望回复", "ok");
    feedbackCorrectionDraft.value = { ...feedbackCorrectionDraft.value, [busyKey]: "" };
    if (feedbackGroupId.value) {
      await refreshFeedback();
    }
  } catch (e) {
    pushConsoleToast(e instanceof Error ? e.message : "清除期望回复失败", "err");
  } finally {
    feedbackManageBusy.value = { ...feedbackManageBusy.value, [busyKey]: false };
  }
}

async function refreshSessions() {
  historyBusy.value = true;
  historyErr.value = "";
  try {
    const data = await fetchLlmHistorySessions({
      botId: parseFilter(filterBot.value),
      groupId: parseFilter(filterGroup.value),
      userId: parseFilter(filterUser.value),
      limit: AI_STATS_LIMITS.historySessions,
    });
    sessions.value = data.items;
    showAllSessions.value = false;
    if (!selectedSessionKey.value || !sessions.value.some((item) => item.session_key === selectedSessionKey.value)) {
      selectedSessionKey.value = sessions.value[0]?.session_key ?? "";
    }
  } catch (e) {
    sessions.value = [];
    selectedSessionKey.value = "";
    historyErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    historyBusy.value = false;
  }
}

async function refreshSessionDetail() {
  const summary = selectedSession.value;
  if (!summary) {
    sessionDetail.value = null;
    sessionDecisionTraces.value = [];
    return;
  }
  historyBusy.value = true;
  historyErr.value = "";
  try {
    const [detail, tracesData] = await Promise.all([
      fetchLlmHistorySession({
        botId: summary.bot_id,
        groupId: summary.group_id,
        userId: summary.user_id,
        limit: AI_STATS_LIMITS.historyTurns,
      }),
      fetchConversationKernelTraces({
        groupId: summary.group_id > 0 ? summary.group_id : undefined,
        botId: summary.bot_id,
        kind: "decision",
        limit: AI_STATS_LIMITS.historyTurns,
      }),
    ]);
    sessionDetail.value = detail;
    sessionDecisionTraces.value = tracesData.items;
  } catch (e) {
    sessionDetail.value = null;
    sessionDecisionTraces.value = [];
    historyErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    historyBusy.value = false;
  }
}

async function refreshAll() {
  await refreshSessions();
}

useAiObservationRefresh(refreshAll, { isBusy: () => anyBusy.value });

async function refreshFeedback() {
  if (feedbackGroupId.value == null || feedbackGroupId.value <= 0) {
    feedbackItems.value = [];
    feedbackSummary.value = null;
    promotionCandidates.value = [];
    feedbackErr.value = feedbackGroup.value.trim() ? "群号须为正整数" : "";
    return;
  }
  feedbackBusy.value = true;
  feedbackErr.value = "";
  try {
    const [itemsData, summaryData] = await Promise.all([
      fetchLlmRepeaterFeedback({ groupId: feedbackGroupId.value, limit: 20 }),
      fetchLlmRepeaterFeedbackSummary({ groupId: feedbackGroupId.value, limit: 40 }),
    ]);
    feedbackItems.value = itemsData.items;
    feedbackSummary.value = summaryData;
    await refreshPromotionCandidates();
  } catch (e) {
    feedbackItems.value = [];
    feedbackSummary.value = null;
    promotionCandidates.value = [];
    feedbackErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    feedbackBusy.value = false;
  }
}

async function refreshPromotionCandidates() {
  if (feedbackGroupId.value == null || feedbackGroupId.value <= 0) {
    promotionCandidates.value = [];
    promotionCandidatesErr.value = "";
    return;
  }
  promotionCandidatesBusy.value = true;
  promotionCandidatesErr.value = "";
  try {
    const data = await fetchLlmPromotionCandidates({
      groupId: feedbackGroupId.value,
      limit: 20,
      includeResolved: promotionIncludeResolved.value,
    });
    promotionCandidates.value = data.items;
  } catch (e) {
    promotionCandidates.value = [];
    promotionCandidatesErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    promotionCandidatesBusy.value = false;
  }
}

async function resolvePromotionCandidate(
  candidate: LlmPromotionCandidate,
  action: "promote" | "reject",
) {
  if (promotionResolveBusyId.value) return;
  const prompt = action === "promote"
    ? `批准将「${candidate.reply_text}」写入本群接话语料？`
    : `拒绝候选「${candidate.reply_text}」？`;
  if (!confirm(prompt)) return;
  promotionResolveBusyId.value = candidate.candidate_id;
  promotionCandidatesErr.value = "";
  try {
    const updated = await postLlmPromotionCandidateResolve({
      candidateId: candidate.candidate_id,
      action,
      reason: action === "reject" ? "webui_reject" : "",
    });
    if (action === "promote") {
      const wb = String(updated.writeback_status || "").trim();
      if (wb === "written") {
        pushConsoleToast("已批准并写入接话语料", "ok");
      } else if (wb === "failed") {
        const msg = String(updated.writeback_message || "").trim();
        pushConsoleToast(msg ? `已批准，但写回失败：${msg}` : "已批准，但写回失败", "err");
      } else {
        pushConsoleToast("已批准晋升", "ok");
      }
    } else {
      pushConsoleToast("已拒绝该候选", "ok");
    }
    await Promise.all([refreshPromotionCandidates(), refreshFeedback()]);
  } catch (e) {
    promotionCandidatesErr.value = e instanceof Error ? e.message : String(e);
    pushConsoleToast(promotionCandidatesErr.value, "err");
  } finally {
    promotionResolveBusyId.value = "";
  }
}

async function refreshBehaviorRuns() {
  behaviorRunsBusy.value = true;
  behaviorRunsErr.value = "";
  try {
    const data = await fetchLlmBehaviorRuns({
      groupId: behaviorRunsGroupId.value,
      scene: behaviorRunsScene.value || null,
      finalOutcome: behaviorRunsOutcome.value || null,
      includeDisabled: behaviorRunsIncludeDisabled.value,
      limit: 20,
    });
    behaviorRunsItems.value = data.items;
  } catch (e) {
    behaviorRunsItems.value = [];
    behaviorRunsErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    behaviorRunsBusy.value = false;
  }
}

async function refreshPatterns() {
  patternBusy.value = true;
  patternErr.value = "";
  try {
    const data = await fetchLlmBehaviorPatterns({
      groupId: patternsGroupId.value,
      scene: patternsScene.value || null,
      includeDisabled: patternsIncludeDisabled.value,
    });
    patternsItems.value = data.items;
  } catch (e) {
    patternsItems.value = [];
    patternErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    patternBusy.value = false;
  }
}

async function savePattern() {
  if (!patternEditor.value.pattern_id.trim()) {
    patternErr.value = "规则 ID 不能为空";
    return;
  }
  patternSaveBusy.value = true;
  patternErr.value = "";
  try {
    const updated = await postLlmBehaviorPatternUpsert({
      ...patternEditor.value,
      pattern_id: patternEditor.value.pattern_id.trim(),
      scene: patternEditor.value.scene || "smalltalk",
      action: patternEditor.value.action || "ack_then_short_reply",
      trigger_features: [...(patternEditor.value.trigger_features ?? [])],
      reference_examples: [...(patternEditor.value.reference_examples ?? [])],
    });
    const exists = patternsItems.value.some((item) => item.pattern_id === updated.pattern_id);
    patternsItems.value = exists
      ? patternsItems.value.map((item) => (item.pattern_id === updated.pattern_id ? updated : item))
      : [updated, ...patternsItems.value];
    resetPatternEditor();
    patternEditorOpen.value = false;
    await refreshPatterns();
  } catch (e) {
    patternErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    patternSaveBusy.value = false;
  }
}

async function deletePattern(item: LlmBehaviorPattern) {
  const ok = window.confirm(`确定删除规则「${item.pattern_id}」？此操作不可恢复。`);
  if (!ok) return;
  patternErr.value = "";
  try {
    await postLlmBehaviorPatternDelete(item.pattern_id);
    patternsItems.value = patternsItems.value.filter((row) => row.pattern_id !== item.pattern_id);
    if (patternEditor.value.pattern_id === item.pattern_id) {
      resetPatternEditor();
    }
  } catch (e) {
    patternErr.value = e instanceof Error ? e.message : String(e);
  }
}

async function togglePatternDisabled(item: LlmBehaviorPattern) {
  patternEditorMode.value = "edit";
  patternEditor.value = {
    ...item,
    disabled: !item.disabled,
    trigger_features: [...(item.trigger_features ?? [])],
    reference_examples: [...(item.reference_examples ?? [])],
  };
  await savePattern();
}

watch(pendingPromotionCandidates, (items) => {
  if (items.length > 0) {
    maintainPanelExpanded.value = { ...maintainPanelExpanded.value, promotion: true };
  }
});

watch(selectedSessionKey, () => {
  expandedTurnKeys.value = {};
  expandedSessionMaintainIds.value = {};
  void refreshSessionDetail().then(() => {
    void nextTick(() => scrollSessionDetailIntoView());
  });
});

watch(selectedSession, (session) => {
  const next = deriveFeedbackGroupFromSession({
    sessionGroupId: session?.group_id,
    currentFeedbackGroup: feedbackGroup.value,
    userTouched: feedbackGroupTouched.value,
  });
  if (next !== feedbackGroup.value) {
    feedbackGroup.value = next;
  }
  if (!feedbackGroupTouched.value && next.trim()) {
    void refreshFeedback();
  }
  if (!behaviorRunsGroupTouched.value && next.trim()) {
    behaviorRunsGroup.value = next;
    void refreshBehaviorRuns();
  }
  if (!patternsGroupTouched.value && next.trim()) {
    patternsGroup.value = next;
    void refreshPatterns();
  }
  if (!observeGroupTouched.value && next.trim()) {
    observeGroup.value = next;
  }
  if (!memoryGroupTouched.value && next.trim()) {
    memoryGroup.value = next;
  }
  if (!memoryBotTouched.value && session?.bot_id) {
    memoryBot.value = String(session.bot_id);
  }
});

watch(behaviorRunsScene, (next) => {
  if (observeScene.value !== next) {
    observeScene.value = next;
  }
});

watch(
  () => route.query.workspace,
  (raw) => applyWorkspaceFromQuery(raw),
);

onMounted(() => {
  applyWorkspaceFromQuery();
  void refreshAll();
  void loadMemoryBots();
  feedbackGroup.value = filterGroup.value;
  behaviorRunsGroup.value = filterGroup.value;
  patternsGroup.value = filterGroup.value;
  observeGroup.value = filterGroup.value;
  memoryGroup.value = filterGroup.value;
  observeScene.value = behaviorRunsScene.value;
  void refreshKernelStatus();
  void refreshBehaviorRuns();
  void refreshPatterns();
  resetPatternEditor();
});
</script>

<template>
  <div class="ai-history-page ai-history-page--chrome">

    <div v-if="combinedErr" class="alert alert--err">{{ combinedErr }}</div>

    <AiHistoryLearningStrip
      v-if="(showLearningLoopBanner || learningLoopHint) && (activeWorkspace === 'sessions' || activeWorkspace === 'maintain')"
      :show-banner="showLearningLoopBanner"
      :hint="learningLoopHint"
      :strategy-path="aiConfigSectionPath('strategy')"
      :show-verify="learningLoopState?.kind === 'bias_on' || learningLoopState?.kind === 'full'"
      :show-open-config="learningLoopState?.kind === 'idle'"
      @open-config="openLlmCommonConfig(true)"
      @dismiss="dismissLearningLoopBanner"
      @verify="openHistoryVerify"
    />

    <AiHistoryWorkspaceTabs
      v-model="activeWorkspace"
      :tabs="WORKSPACE_TABS"
      :badges="workspaceTabBadges"
    />

    <AiHistoryContextBar
      v-show="activeWorkspace !== 'sessions' || selectedSession"
      :title="historyContextTitle"
      :meta="historyContextMeta"
      :active-workspace="activeWorkspace"
      :group-id="historyContextGroupId"
      :compact="activeWorkspace === 'sessions'"
      :show-group-field="activeWorkspace === 'maintain'"
      :group-value="observeGroup"
      :scene-value="observeScene"
      :scene-options="BEHAVIOR_SCENE_OPTIONS"
      :busy="kernelStatusBusy || kernelTracesBusy || feedbackBusy || promotionCandidatesBusy || behaviorRunsBusy"
      @maintain-group="openMaintainWorkspace(historyContextGroupId)"
      @refresh-group="refreshObservePanels"
      @update:group-value="onContextGroupChange"
      @update:scene-value="onContextSceneChange"
    />

    <div
      v-show="activeWorkspace === 'sessions'"
      ref="sessionsWorkspaceAnchor"
      class="ai-history-page__workspace ai-history-page__workspace--sessions ai-history-page__workspace--fill"
    >
    <PageFill class="ai-history-page__sessions-fill">
    <section class="ai-history-split ai-hub-panel">
      <AiHistorySessionListPane
        v-model:filter-bot="filterBot"
        v-model:filter-group="filterGroup"
        v-model:filter-user="filterUser"
        v-model:selected-session-key="selectedSessionKey"
        v-model:show-all-sessions="showAllSessions"
        :sessions="sessions"
        :visible-sessions="visibleSessions"
        :busy="historyBusy"
        @apply="refreshSessions"
        @reset="refreshSessions"
      />

      <AiHistorySessionDetailPane
        ref="sessionDetailPane"
        v-model:show-decision-traces="showDecisionTraces"
        :selected-session="selectedSession"
        :context-label="workspaceContextLabel"
        :has-detail="Boolean(sessionDetail)"
      >
          <AiHistorySessionTurnThread
            :rows="sessionTurnRows.rows"
            :expanded-keys="expandedTurnKeys"
            @toggle-expand="toggleTurnExpanded"
          >
            <template #default="{ row }">
              <AiHistorySessionTurnDecisionBlock
                v-if="row.decisionTrace && showDecisionTraces"
                :summary="kernelTraceSummary(row.decisionTrace)"
                :opportunity-class="kernelTraceOpportunityClass(row.decisionTrace)"
                :opportunity-label="kernelTraceOpportunityLabel(row.decisionTrace)"
                :timestamp-label="traceTimestamp(row.decisionTrace) ? formatCompactDateTime(traceTimestamp(row.decisionTrace)) : ''"
                :highlights="kernelTraceHighlights(row.decisionTrace)"
              />
              <AiHistorySessionTurnMaintainBlock
                v-if="row.turn.role === 'assistant'"
                :feedback-entry="row.feedbackEntry"
                :behavior-run="row.behaviorRun"
                :expanded="isSessionMaintainExpanded(turnMaintKey(row))"
                :feedback-busy="row.feedbackEntry ? isFeedbackManageBusy(row.feedbackEntry) : false"
                :correction-draft="getCorrectionDraft(row)"
                :correction-busy="isCorrectionManageBusy(row.feedbackEntry?.entry_id || row.feedbackEntry?.request_id || correctionDraftKey(row))"
                :request-id="sessionTurnRequestId(row)"
                :persona-shaping-busy="!!personaShapingBusy[sessionTurnRequestId(row)]"
                :persona-shaping-error="personaShapingError[sessionTurnRequestId(row)] || ''"
                :persona-shaping="personaShapingForRequestId(sessionTurnRequestId(row))"
                :label-options="BEHAVIOR_LABEL_OPTIONS"
                :behavior-busy="row.behaviorRun ? isBehaviorBusy(row.behaviorRun.request_id) : false"
                :advanced-debug-expanded="row.behaviorRun ? isAdvancedDebugExpanded(behaviorAgentTraceKey('session', row.behaviorRun.request_id)) : false"
                :trace-expanded="row.behaviorRun ? !!expandedBehaviorTraceKeys[behaviorAgentTraceKey('session', row.behaviorRun.request_id)] : false"
                :agent-trace="row.behaviorRun ? behaviorAgentTrace(row.behaviorRun.auto_feedback_payload) : null"
                :agent-highlights="row.behaviorRun ? behaviorAgentTraceHighlights(behaviorAgentTrace(row.behaviorRun.auto_feedback_payload)) : []"
                :replay-busy="row.behaviorRun ? !!replayRunBusy[row.behaviorRun.request_id] : false"
                :copy-busy="row.behaviorRun ? !!replayCopyBusy[row.behaviorRun.request_id] : false"
                @toggle="toggleSessionMaintainExpanded(turnMaintKey(row), row)"
                @manage="row.feedbackEntry && manageFeedbackEntry(row.feedbackEntry, $event)"
                @update:correction="setCorrectionDraft(row, $event)"
                @save-correction="saveFeedbackCorrectionForTurn(row)"
                @clear-correction="clearFeedbackCorrectionForTurn(row)"
                @focus-pattern="focusPattern"
                @toggle-advanced="row.behaviorRun && toggleAdvancedDebug(behaviorAgentTraceKey('session', row.behaviorRun.request_id))"
                @toggle-trace="row.behaviorRun && toggleBehaviorTraceExpanded(behaviorAgentTraceKey('session', row.behaviorRun.request_id))"
                @run-replay="row.behaviorRun && runReplay(row.behaviorRun.request_id)"
                @copy-replay="row.behaviorRun && copyReplayPayload(row.behaviorRun.request_id)"
                @toggle-label="row.behaviorRun && toggleBehaviorLabel(row.behaviorRun, $event)"
                @update:outcome="row.behaviorRun && changeBehaviorOutcome(row.behaviorRun, $event)"
                @toggle-disabled="row.behaviorRun && toggleBehaviorDisabled(row.behaviorRun)"
              />
            </template>
          </AiHistorySessionTurnThread>
          <AiHistoryOrphanBehaviorSection
            :runs="sessionTurnRows.orphanRuns"
            :label-options="BEHAVIOR_LABEL_OPTIONS"
            :format-source="formatBehaviorSource"
            :format-signal="formatBehaviorSignal"
            :format-tokens="formatBehaviorTokens"
            :outcome-class="outcomeClass"
            :agent-trace="behaviorAgentTrace"
            :agent-highlights="behaviorAgentTraceHighlights"
            :is-advanced-expanded="(requestId) => isAdvancedDebugExpanded(behaviorAgentTraceKey('orphan', requestId))"
            :is-trace-expanded="(requestId) => !!expandedBehaviorTraceKeys[behaviorAgentTraceKey('orphan', requestId)]"
            :is-busy="isBehaviorBusy"
            :is-replay-busy="(requestId) => !!replayRunBusy[requestId]"
            :is-copy-busy="(requestId) => !!replayCopyBusy[requestId]"
            @focus-pattern="focusPattern"
            @toggle-advanced="(requestId) => toggleAdvancedDebug(behaviorAgentTraceKey('orphan', requestId))"
            @toggle-trace="(requestId) => toggleBehaviorTraceExpanded(behaviorAgentTraceKey('orphan', requestId))"
            @run-replay="runReplay"
            @copy-replay="copyReplayPayload"
            @toggle-label="toggleBehaviorLabel"
            @update:outcome="changeBehaviorOutcome"
            @toggle-disabled="toggleBehaviorDisabled"
          />
      </AiHistorySessionDetailPane>
    </section>
    </PageFill>
    </div>

    <AiHistoryMaintainWorkspace v-show="activeWorkspace === 'maintain'">
    <AiHistoryMaintainPersonaPanel
      :expanded="isMaintainPanelExpanded('persona')"
      :summary="personaPanelSummary"
      :sync-group-id="observeGroup"
      @toggle="toggleMaintainPanel('persona')"
      @pick-group="pickGroupFromSessions"
    />
    <AiHistoryMaintainFeedbackPanel
      :expanded="isMaintainPanelExpanded('feedback')"
      :summary="feedbackPanelSummary"
      :err="feedbackErr"
      :items="visibleFeedbackItems"
      :feedback-group-id="feedbackGroupId"
      :observe-scene="observeScene"
      :correction-drafts="feedbackCorrectionDraft"
      :manage-busy="feedbackManageBusy"
      :expanded-text-keys="expandedObserveKeys"
      @toggle="toggleMaintainPanel('feedback')"
      @apply-scene="applyObserveScene"
      @update-correction="setFeedbackCardCorrectionDraft"
      @save-correction="saveFeedbackCardCorrection"
      @clear-correction="clearFeedbackCardCorrection"
      @manage="manageFeedbackEntry"
      @toggle-text="toggleObserveText"
    />
    <AiHistoryMaintainPromotionPanel
      v-model:include-resolved="promotionIncludeResolved"
      :expanded="isMaintainPanelExpanded('promotion')"
      :summary="promotionPanelSummary"
      :err="promotionCandidatesErr"
      :busy="promotionCandidatesBusy"
      :feedback-group-id="feedbackGroupId"
      :candidates="promotionCandidates"
      :pending-count="pendingPromotionCandidates.length"
      :resolve-busy-id="promotionResolveBusyId"
      :expanded-text-keys="expandedObserveKeys"
      :status-label="promotionCandidateStatusLabel"
      :writeback-hint="promotionWritebackHint"
      @toggle="toggleMaintainPanel('promotion')"
      @refresh="refreshPromotionCandidates"
      @include-resolved-change="refreshPromotionCandidates"
      @resolve="resolvePromotionCandidate"
      @toggle-text="toggleObserveText"
    />
    <AiHistoryMaintainBehaviorPanel
      v-model:runs-group="behaviorRunsGroup"
      v-model:runs-scene="behaviorRunsScene"
      v-model:runs-outcome="behaviorRunsOutcome"
      v-model:include-disabled="behaviorRunsIncludeDisabled"
      :expanded="isMaintainPanelExpanded('behavior')"
      :summary="behaviorPanelSummary"
      :err="behaviorRunsErr"
      :busy="behaviorRunsBusy"
      :overview="behaviorRunsOverview"
      :items="behaviorRunsItems"
      :label-options="BEHAVIOR_LABEL_OPTIONS"
      :expanded-text-keys="expandedObserveKeys"
      :advanced-debug-keys="advancedDebugKeys"
      :expanded-trace-keys="expandedBehaviorTraceKeys"
      :annotate-expanded-ids="expandedObserveAnnotateIds"
      :behavior-busy="behaviorBusy"
      :replay-busy="replayRunBusy"
      :replay-copy-busy="replayCopyBusy"
      :agent-trace="behaviorAgentTrace"
      :agent-trace-highlights="behaviorAgentTraceHighlights"
      :session-key-for-run="sessionKeyForBehaviorRun"
      @toggle="toggleMaintainPanel('behavior')"
      @refresh="refreshBehaviorRuns"
      @group-touched="onBehaviorRunsGroupTouched"
      @apply-scene="applyObserveScene"
      @toggle-text="toggleObserveText"
      @focus-pattern="focusPattern"
      @toggle-advanced="toggleAdvancedDebug"
      @toggle-trace="toggleBehaviorTraceExpanded"
      @run-replay="runReplay"
      @copy-replay="copyReplayPayload"
      @toggle-annotate="toggleObserveAnnotateExpanded"
      @toggle-label="toggleBehaviorLabel"
      @update-outcome="changeBehaviorOutcome"
      @toggle-disabled="toggleBehaviorDisabled"
      @open-session="openRunInSession"
    />
    <AiHistoryMaintainKernelPanel
      :expanded="isMaintainPanelExpanded('kernel')"
      :status-err="kernelStatusErr"
      :traces-err="kernelTracesErr"
      :status-overview="kernelStatusOverview"
      :status="kernelStatus"
      :status-busy="kernelStatusBusy"
      :memory-policy-line="kernelMemoryPolicyLine(kernelStatus)"
      :traces="kernelTraces"
      :traces-busy="kernelTracesBusy"
      :expanded-trace-keys="expandedKernelTraceKeys"
      :trace-key="kernelTraceKey"
      :trace-summary="kernelTraceSummary"
      :opportunity-class="kernelTraceOpportunityClass"
      :opportunity-label="kernelTraceOpportunityLabel"
      @toggle="toggleMaintainPanel('kernel')"
      @toggle-trace="toggleKernelTraceExpanded"
    />
    </AiHistoryMaintainWorkspace>

    <AiHistoryMemoryWorkspace
      v-show="activeWorkspace === 'memory'"
      v-model:memory-bot="memoryBot"
      v-model:memory-group="memoryGroup"
      v-model:memory-query="memoryQuery"
      :bot-options="memoryBotOptions"
      :memory-scope="memoryScope"
      :memory-err="memoryErr"
      :memory-busy="memoryBusy"
      :memory-overview="memoryOverview"
      :memory-entries="memoryEntries"
      :relationship-notes="relationshipNotes"
      :knowledge-sources="knowledgeSources"
      :memory-delete-busy="memoryDeleteBusy"
      @bot-touched="memoryBotTouched = true"
      @group-touched="memoryGroupTouched = true"
      @refresh="refreshMemoryWorkspace"
      @delete-memory="deleteMemoryEntry"
      @delete-relationship="deleteRelationshipNote"
    />

    <AiHistoryRulesWorkspace
      v-show="activeWorkspace === 'rules'"
      v-model:patterns-group="patternsGroup"
      v-model:patterns-scene="patternsScene"
      v-model:patterns-include-disabled="patternsIncludeDisabled"
      v-model:pattern-sort-key="patternSortKey"
      :pattern-busy="patternBusy"
      :pattern-err="patternErr"
      :patterns-overview="patternsOverview"
      :sorted-patterns-items="sortedPatternsItems"
      :pattern-editor-open="patternEditorOpen"
      :editing-pattern-id="patternEditor.pattern_id"
      :pattern-save-busy="patternSaveBusy"
      @group-touched="patternsGroupTouched = true"
      @refresh="refreshPatterns"
      @create="openPatternEditorCreate"
      @edit="openPatternEditorEdit"
      @toggle-disabled="togglePatternDisabled"
      @delete="deletePattern"
    />

    <AiHistoryPatternEditorDialog
      v-model:open="patternEditorOpen"
      v-model:pattern="patternEditor"
      :mode="patternEditorMode"
      :busy="patternSaveBusy"
      @close="closePatternEditor"
      @save="savePattern"
    />
    <AiHistoryReplayResultDialog
      v-model:open="replayRunDialogOpen"
      v-model:raw-expanded="replayRunRawExpanded"
      :title="replayRunDialogTitle"
      :subtitle="replayRunDialogSubtitle"
      :error="replayRunError"
      :result="replayRunResult"
      :summary="replayRunSummary"
      :persona-shaping="replayPersonaShaping"
      :reply-text="replayRunReply"
      :assistant-preview="replayRunAssistantPreview"
      :trace="replayRunTrace"
      :trace-highlights="behaviorAgentTraceHighlights(replayRunTrace)"
      @close="closeReplayRunDialog"
      @copy="copyReplayRunResult"
    />
  </div>
</template>

<style>
/* Unscoped on purpose: extracted ai-history/* components reuse these class names. */
.ai-history-page {
  display: flex;
  flex-direction: column;
  gap: var(--hub-page-gap, 18px);
}

.ai-history-page--chrome {
  gap: var(--hub-page-gap, 16px);
  flex: 1 1 auto;
  min-height: 0;
}

.ai-history-page__sessions-fill {
  flex: 1 1 auto;
  min-height: 0;
}

.ai-history-page__workspace--fill {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ai-history-page__workspace--fill .ai-history-page__sessions-fill,
.ai-history-page__workspace--fill .ai-history-split {
  flex: 1 1 auto;
  min-height: 0;
}

.ai-history-page__toolbar {
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.ai-history-page__date-filters,
.ai-history-page__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.ai-date-field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: color-mix(in srgb, var(--text) 3%, transparent);
  padding: 4px 8px;
  border-radius: 8px;
}

.ai-date-field__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-muted);
}

.ai-date-field .ui-input-wrap {
  width: auto;
  min-width: 0;
}

.ai-date-field .inp {
  border: none;
  background: transparent;
  padding: 2px 4px;
  min-height: 28px;
  font-size: 0.875rem;
  color: var(--text);
}

.ai-date-field .inp:focus {
  outline: none;
  box-shadow: none;
}

.ai-history-page__workspace-tabs {
  display: block;
  width: 100%;
  margin-bottom: 10px;
}

.ai-tab-btn {
  padding: 8px 16px;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ai-tab-btn:hover {
  color: var(--text);
}

.ai-tab-btn.is-active {
  color: var(--brand);
  border-bottom-color: var(--brand);
}

.ai-history-page__workspace {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-history-page__panel {
  padding: 14px 16px;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.ai-history-page__panel--compact {
  padding: 12px 16px;
}

.ai-history-page__learning-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 0;
  padding: 12px 14px;
  border-radius: var(--radius-control, 8px);
  border: none;
  background: color-mix(in srgb, var(--bg-muted) 50%, transparent);
}

.ai-history-page__learning-strip.is-warn {
  border: none;
  border-left: 3px solid color-mix(in srgb, #f59e0b 70%, transparent);
  background: color-mix(in srgb, #f59e0b 8%, var(--bg-card));
}

.ai-history-page__learning-strip-main {
  flex: 1 1 240px;
  min-width: 0;
}

.ai-history-page__learning-strip-text {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.ai-history-page__learning-steps {
  margin: 8px 0 0;
  padding-left: 1.1rem;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.ai-history-page__learning-strip-actions {
  flex: 0 0 auto;
  align-items: center;
}

.ai-history-page__detail-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 12px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.ai-history-page__detail-toolbar-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.ai-history-page__detail-toolbar-actions {
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.ai-history-page__detail-trace-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: var(--text-muted);
  white-space: nowrap;
}

.ai-history-page__maintain-inline-summary {
  margin: 10px 0 0;
  font-size: 0.8125rem;
}

.ai-history-page__kernel-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.ai-history-page__kernel-chip {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-muted);
}

.ai-history-page__kernel-chip.is-on {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
  color: var(--accent);
}

.ai-history-page__turn-quick-actions {
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}

.ai-history-page__workspace--maintain .ai-history-page__maintain-toolbar {
  margin-bottom: 0;
}

.ai-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.ai-head__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
}

.ai-head__hint {
  display: none;
}

.ai-head__actions {
  display: flex;
  gap: 8px;
}

.ai-history-page__promotion-actions {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-history-page__replay-dialog {
  display: grid;
  gap: 10px;
}

.ai-history-page__replay-hint {
  margin: 0;
}

.ai-history-page__replay-block {
  display: grid;
  gap: 8px;
}

.ai-history-page__replay-block-head {
  margin-bottom: 0;
}

.ai-history-page__replay-error {
  margin: 0;
  color: var(--danger-700, #b42318);
  white-space: pre-wrap;
}

.ai-history-page__trace-actions {
  flex-wrap: wrap;
  gap: 8px;
}

.ai-history-page__observe-panel-hd {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.ai-history-page__observe-panel-hd-text {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.ai-history-page__observe-panel-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
}

.ai-history-page__observe-panel-sub {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--text-muted);
}

.ai-history-page__observe-panel-hd-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.ai-history-page__observe-panel-body--persona {
  margin-top: 0;
}

.ai-history-page__persona-wrap {
  margin-bottom: 0;
}

.ai-history-page__observe-panel-toggle .ui-btn {
  flex-shrink: 0;
}

.ai-history-page__observe-panel-body {
  display: grid;
  gap: 0;
}

@media (max-width: 560px) {
  .ai-history-page__workspace--stats,
  .ai-history-page__workspace--sessions {
    grid-template-columns: 1fr;
  }

  .ai-history-page__panel {
    padding: 16px;
  }
}

.ai-history-page__kernel-policy {
  margin: 0 0 4px;
  font-size: 13px;
}

.ai-history-page__kernel-trace-json {
  margin: 8px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--bg-muted);
  border: 1px solid var(--border);
  font-size: 12px;
  line-height: 1.45;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-history-page__kernel-trace-json--compact {
  margin-top: 0;
}

.ai-history-page__trace-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.ai-history-page__detail-anchor {
  scroll-margin-top: 12px;
  min-width: 0;
}

.ai-history-page__empty-hint {
  margin: 0;
  font-size: 13px;
}

.ai-history-page__hint {
  margin-top: 8px;
  font-size: 0.75rem;
}

.ai-history-page__workspace-tabs {
  margin-bottom: 4px;
}

.ai-history-page__workspace-tabs .console-view-toggle {
  max-width: 100%;
}

.ai-history-page__workspace-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ai-history-page__workspace-badge {
  min-width: 1.25rem;
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
  font-size: 0.68rem;
  line-height: 1.45;
}

.ai-history-page__list-hd {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.ai-history-page__list-title {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 600;
}

.ai-history-page__list-count {
  font-size: 0.76rem;
}

.ai-history-page__panel--list {
  display: grid;
  align-content: start;
}

.ai-history-page__detail-hd {
  align-items: flex-start;
  gap: 12px;
}

.ai-history-page__detail-lede {
  margin: 4px 0 0;
  font-size: 0.78rem;
  line-height: 1.45;
}

.ai-history-page__persona-panel {
  margin-bottom: 0;
}

.ai-history-page__context-strip {
  display: none;
}

.ai-history-page__context-actions {
  margin-left: auto;
  gap: 8px;
}

.ai-history-page__workspace {
  display: grid;
  gap: 16px;
}

.ai-history-page__workspace--observe {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ai-history-page__workspace--observe .ai-history-page__observe-toolbar {
  grid-column: 1 / -1;
}

.ai-history-page__workspace--observe .ai-history-page__kernel-panel {
  grid-column: 1 / -1;
}

.ai-history-page__kernel-trace-block {
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.ai-history-page__kernel-trace-head {
  margin-top: 2px;
}

.ai-history-page__detail-panel {
  min-height: min(68vh, 720px);
}

.ai-history-page__thread {
  display: grid;
  gap: 8px;
  max-height: min(58vh, 620px);
  overflow: auto;
  margin-inline: -4px;
  padding-inline: 4px;
}

.ai-history-page__outcome-badge {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-muted);
  white-space: nowrap;
}

.ai-history-page__outcome-badge.is-engaged {
  border-color: color-mix(in srgb, #22c55e 40%, var(--border));
  color: #22c55e;
  background: color-mix(in srgb, #22c55e 10%, transparent);
}

.ai-history-page__outcome-badge.is-ignored,
.ai-history-page__outcome-badge.is-pending {
  border-color: color-mix(in srgb, var(--text-muted) 30%, var(--border));
}

.ai-history-page__outcome-badge.is-bad {
  border-color: color-mix(in srgb, #fb7185 40%, var(--border));
  color: #fb7185;
  background: color-mix(in srgb, #fb7185 10%, transparent);
}

.ai-history-page__outcome-badge.is-neutral {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
  color: var(--accent);
}

.ai-history-page__feedback-card.is-editing {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

.ai-history-page__scene-pill {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  white-space: nowrap;
}

.ai-history-page__scene-pill--btn {
  cursor: pointer;
}

.ai-history-page__feedback-reply.is-clamped,
.ai-history-page__feedback-user.is-clamped {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ai-history-page__feedback-reply {
  min-width: 0;
  word-break: break-word;
}

.ai-history-page__observe-run {
  gap: 10px;
}

.ai-history-page__observe-annotate {
  display: grid;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px dashed color-mix(in srgb, var(--border) 88%, transparent);
}

.ai-history-page__pattern-table-wrap {
  margin-bottom: 12px;
}

.ai-history-page__pattern-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.ai-history-page__pattern-table th,
.ai-history-page__pattern-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.ai-history-page__pattern-table th {
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.75rem;
}

.ai-history-page__pattern-table tr.is-editing td {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.ai-history-page__pattern-id {
  word-break: break-word;
}

.ai-history-page__pattern-cards {
  display: none;
}

.ai-history-page__pattern-actions--table {
  flex-wrap: wrap;
}

.ai-history-page__pattern-dialog {
  width: min(720px, calc(100vw - 32px));
}

.ai-history-page__behavior-jump {
  gap: 8px;
}

.ai-history-page__pattern-links {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.ai-history-page__pattern-links--inline {
  display: flex;
  gap: 8px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.ai-history-page__pattern-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ai-history-page__summary {
  display: block;
}

.ai-history-page__summary-card {
  height: 100%;
}

.ai-history-page__summary-stats {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.ai-history-page__summary-stat {
  min-width: 0;
  padding: 10px 12px;
  border: none;
  box-shadow: none;
  background: color-mix(in srgb, var(--bg-muted) 45%, transparent);
}

.ai-history-page__overview {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 16px;
}

.ai-history-page__route-list {
  margin-top: 16px;
}

.ai-history-page__route-key {
  min-width: 0;
  word-break: break-word;
}

.ai-history-page__failure-panel {
  margin-top: 16px;
}

.ai-dist-list {
  display: grid;
  gap: 12px;
}

.ai-dist-row {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.ai-dist-row__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ai-dist-row__label {
  min-width: 0;
  font-size: 0.9rem;
}

.ai-dist-row__value {
  flex-shrink: 0;
  font-size: 0.84rem;
  color: var(--text);
}

.ai-dist-row__track {
  display: flex;
  align-items: center;
  overflow: hidden;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 7%, transparent);
}

.ai-dist-row__fill {
  height: 100%;
  min-width: 10px;
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 78%, #ffffff), var(--accent));
}

.ai-dist-row__fill--danger {
  background: linear-gradient(90deg, color-mix(in srgb, #fb7185 78%, #ffffff), #fb7185);
}

.ai-history-page__turn-decision {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px dashed color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}

.ai-history-page__sessions {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 16px;
}

.ai-history-page__feedback {
  display: block;
}

.ai-history-page__panel {
  height: 100%;
  min-width: 0;
}

.ai-history-page__session-list,
.ai-history-page__detail {
  display: grid;
  gap: 4px;
}

.ai-history-page__session-list--scroll {
  max-height: min(68vh, 720px);
  overflow: auto;
  margin-inline: -16px;
  padding-inline: 16px;
}

.ai-history-page__behavior {
  display: grid;
  gap: 10px;
  padding: 2px 0 6px;
}

.ai-history-page__behavior-head {
  margin-top: 4px;
}

.ai-history-page__behavior-card {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border));
  border-radius: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 6%, transparent), transparent 55%),
    color-mix(in srgb, var(--text) 2.5%, transparent);
}

.ai-history-page__behavior-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ai-history-page__behavior-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.ai-history-page__behavior-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.ai-history-page__behavior-hint {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-history-page__behavior-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-history-page__behavior-chip {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 3%, transparent);
  color: var(--text);
  font-size: 0.76rem;
  cursor: pointer;
}

.ai-history-page__behavior-chip.is-on {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
}

.ai-history-page__behavior-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 12px;
}

.ai-history-page__behavior-select {
  display: grid;
  gap: 4px;
  min-width: 180px;
  font-size: 0.74rem;
  color: var(--text-muted);
}

.ai-history-page__behavior-select .inp,
.ai-history-page__behavior-select .ui-select,
.ai-history-page__behavior-action-btn .ui-btn {
  min-height: var(--ui-ctrl-height);
  height: var(--ui-ctrl-height);
}

.ai-history-page__behavior-action-btn .ui-btn {
  padding-inline: 14px;
}

.ai-history-page__filters-card {
  margin-bottom: 12px;
  padding: 0 0 12px;
  border: none;
  border-radius: 0;
  background: transparent;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}

.ai-history-page__filters-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin-bottom: 10px;
  font-size: 0.8125rem;
}

.ai-history-page__filters-head strong {
  font-weight: 600;
  color: var(--text);
}

.ai-history-page__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 12px;
  margin-bottom: 12px;
}

.ai-history-page__filters--aligned {
  align-items: end;
}

.ai-history-page__filter-action {
  display: flex;
  align-items: center;
  min-height: var(--ui-ctrl-height);
}

.ai-history-page__filter-action--check {
  padding-bottom: 0;
}

.ai-history-page__filter-action--row {
  gap: 8px;
  flex-wrap: wrap;
}

.ai-history-page__filter {
  display: grid;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.ai-history-page__filter .inp,
.ai-history-page__filter .ui-input-wrap,
.ai-history-page__filter .ui-select {
  width: 96px;
}

.ai-history-page__filter--memory-bot .inp,
.ai-history-page__filter--memory-bot .ui-select {
  width: 172px;
}

.ai-history-page__memory-scope-card {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 5%, transparent);
  font-size: 0.78rem;
}

.ai-history-page__memory-scope-card strong {
  color: var(--text);
}

.ai-history-page__behavior-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: var(--ui-ctrl-height);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.ai-history-page__behavior-check input {
  margin: 0;
}

.ai-history-page__more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border: 1px dashed color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent) 4%, transparent);
  color: var(--accent);
  font-size: 0.82rem;
  cursor: pointer;
}

.ai-history-page__route-key {
  min-width: 0;
  word-break: break-word;
}

.ai-history-page__detail-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  font-size: 0.75rem;
  color: var(--text-muted);
  padding-bottom: 4px;
}

.ai-history-page__detail-actions {
  margin-left: auto;
  gap: 8px;
}

.ai-history-page__turn {
  padding: 10px 0 12px;
  border: 0;
  border-radius: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  background: transparent;
}

.ai-history-page__turn:last-child {
  border-bottom: none;
}

.ai-history-page__turn.is-assistant {
  padding: 12px 10px 12px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 4%, transparent);
  border-left: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
}

.ai-history-page__turn.is-user {
  padding: 10px 0;
}

.ai-history-page__turn-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.8125rem;
}

.ai-history-page__turn-meta {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.ai-history-page__turn-day-tag {
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, #f59e0b 32%, var(--border));
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  color: color-mix(in srgb, #b45309 78%, var(--text));
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.35;
}

.ai-history-page__turn-time {
  color: var(--text-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.ai-history-page__turn p {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-history-page__turn-body {
  margin-top: 8px;
  max-height: 11.2em;
  overflow: auto;
  padding-right: 4px;
}

.ai-history-page__turn-body.is-expanded {
  max-height: none;
  overflow: visible;
  padding-right: 0;
}

.ai-history-page__turn-toggle {
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 0.78rem;
  cursor: pointer;
}

.ai-history-page__turn-behavior {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed color-mix(in srgb, var(--accent) 24%, var(--border));
}

.ai-history-page__turn-behavior-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  font-size: 0.75rem;
}

.ai-history-page__turn-behavior-tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.ai-history-page__turn-behavior-actions {
  flex: 1 1 120px;
  min-width: 0;
}

.ai-history-page__turn-behavior-toggle {
  margin-top: 0;
  margin-left: auto;
}

.ai-history-page__turn-behavior-body {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.ai-history-page__turn-maintain {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed color-mix(in srgb, var(--accent) 24%, var(--border));
}

.ai-history-page__turn-maintain-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  font-size: 0.75rem;
}

.ai-history-page__turn-maintain-tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, #22c55e 14%, transparent);
  color: #15803d;
  font-size: 0.6875rem;
  font-weight: 600;
}

.ai-history-page__maintain-pill {
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid transparent;
}

.ai-history-page__maintain-pill.is-active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
  color: var(--accent);
}

.ai-history-page__maintain-pill.is-excluded {
  background: color-mix(in srgb, #f97316 14%, transparent);
  border-color: color-mix(in srgb, #f97316 30%, var(--border));
  color: #c2410c;
}

.ai-history-page__maintain-pill.is-none {
  background: color-mix(in srgb, var(--text) 8%, transparent);
  border-color: color-mix(in srgb, var(--text) 22%, var(--border));
  color: color-mix(in srgb, var(--text) 82%, var(--text-muted));
}

.ai-history-page__turn-maintain-toggle {
  margin-left: auto;
}

.ai-history-page__turn-maintain-body {
  display: grid;
  gap: 14px;
  margin-top: 10px;
}

.ai-history-page__maintain-section {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--panel) 92%, transparent);
}

.ai-history-page__maintain-section-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
}

.ai-history-page__maintain-hint {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.45;
}

.ai-history-page__maintain-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 0.75rem;
}

.ai-history-page__maintain-actions,
.ai-history-page__feedback-card-actions {
  flex-wrap: wrap;
  gap: 8px;
}

.ai-history-page__maintain-empty {
  margin: 0;
  padding: 9px 11px;
  border-radius: 8px;
  border: 1px dashed color-mix(in srgb, var(--text) 18%, var(--border));
  background: color-mix(in srgb, var(--text) 5%, transparent);
  color: color-mix(in srgb, var(--text) 84%, var(--text-muted));
  font-size: 0.8125rem;
  line-height: 1.5;
}

.ai-history-page__maintain-behavior-bar {
  margin-bottom: 4px;
}

.ai-history-page__danger-btn {
  color: #dc2626;
}

.ai-history-page__orphan-behavior {
  display: grid;
  gap: 10px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.ai-history-page__orphan-behavior-head {
  margin-top: 2px;
}

.ai-history-page__daily-list {
  display: grid;
  gap: 12px;
}

.ai-history-page__daily-section {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

.ai-history-page__daily-subhead {
  margin-top: 2px;
}

.ai-history-page__daily-card {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 5%, transparent), transparent 48%),
    color-mix(in srgb, var(--text) 2.5%, transparent);
}

.ai-history-page__daily-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ai-history-page__daily-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.ai-history-page__daily-stat {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 4.5%, transparent);
}

.ai-history-page__daily-label {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.ai-history-page__daily-foot {
  display: grid;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.ai-history-page__daily-routes {
  word-break: break-word;
}

.ai-history-page__feedback-summary {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  margin-bottom: 12px;
}

.ai-history-page__pattern-editor {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--text) 2.5%, transparent);
}

.ai-history-page__pattern-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
  align-items: start;
}

.ai-history-page__pattern-form > .ai-history-page__filter {
  min-width: 0;
}

/* 勿继承筛选栏 .ai-history-page__filter .inp { width: 96px } */
.ai-history-page__pattern-form .ai-history-page__filter .inp,
.ai-history-page__pattern-form .ai-history-page__filter .ui-input-wrap,
.ai-history-page__pattern-form .ai-history-page__filter .ui-select,
.ai-history-page__pattern-form .ai-history-page__filter select.inp,
.ai-history-page__pattern-form .ai-history-page__filter textarea.inp {
  width: 100%;
  max-width: none;
  min-width: 0;
  box-sizing: border-box;
}

.ai-history-page__pattern-form-span {
  grid-column: 1 / -1;
}

.ai-history-page__pattern-form > .ai-history-page__behavior-check {
  grid-column: 1 / -1;
  margin-top: 2px;
}

.ai-history-page__pattern-textarea {
  min-height: 110px;
  width: 100%;
  resize: vertical;
  font-family: inherit;
  line-height: 1.45;
}

.ai-history-page__correction-editor {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.ai-history-page__correction-editor--card {
  margin-top: 8px;
}

.ai-history-page__correction-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--text) 88%, var(--text-muted));
}

.ai-history-page__correction-textarea {
  min-height: 72px;
  color: var(--text);
  background: color-mix(in srgb, var(--bg-card, var(--surface)) 92%, var(--text) 4%);
  border-color: color-mix(in srgb, var(--text) 18%, var(--border));
  border-radius: var(--radius-textarea);
}

.ai-history-page__correction-textarea::placeholder {
  color: color-mix(in srgb, var(--text-muted) 88%, var(--text) 12%);
}

.ai-history-page__correction-preview {
  margin-top: 6px;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: color-mix(in srgb, var(--text) 82%, var(--text-muted));
  word-break: break-word;
}

.ai-history-page__pattern-actions {
  gap: 8px;
}

.ai-history-page__feedback-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
}

.ai-history-page__feedback-card {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 5%, transparent), transparent 52%),
    color-mix(in srgb, var(--text) 2.5%, transparent);
}

.ai-history-page__feedback-card--behavior {
  border-color: color-mix(in srgb, var(--accent) 18%, var(--border));
}

.ai-history-page__feedback-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ai-history-page__feedback-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.ai-history-page__feedback-user {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.55;
  color: var(--text-muted);
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-history-page__persona-shaping-lines {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 6px;
  font-size: 0.84rem;
  line-height: 1.55;
  word-break: break-word;
}

.ai-history-page__persona-shaping-extra {
  margin: 8px 0 0;
  font-size: 0.82rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-history-page__persona-shaping-note {
  margin-top: 8px;
}

@media (max-width: 860px) {
  .ai-history-split,
  .ai-history-page__workspace--observe {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-history-page__daily-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ai-history-page__pattern-form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .ai-history-page__workspace-tabs .console-view-toggle {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .ai-history-page__workspace-tabs .console-view-toggle button {
    flex: 0 0 auto;
  }

  .ai-history-page__filters--aligned {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    align-items: stretch;
  }

  .ai-history-page__filter-action,
  .ai-history-page__filter-action--check {
    width: 100%;
    min-height: auto;
  }

  .ai-dist-row__head {
    display: grid;
    gap: 4px;
  }

  .ai-history-session__head,
  .ai-history-page__turn-head,
  .ai-history-page__behavior-top,
  .ai-history-page__feedback-top {
    display: grid;
    gap: 4px;
  }

  .ai-history-session__head {
    display: grid;
    gap: 6px;
  }

  .ai-history-session__time {
    justify-self: start;
  }

  .ai-history-page__trace-highlights {
    display: grid;
    gap: 4px;
  }

  .ai-history-page__context-strip {
    display: grid;
    gap: 8px;
  }

  .ai-history-page__context-actions {
    margin-left: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ai-history-page__observe-panel-hd {
    display: grid;
    gap: 8px;
  }

  .ai-history-page__observe-panel-hd--persona .ai-history-page__observe-panel-hd-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ai-history-page__observe-panel-hd--persona .ai-history-page__observe-panel-toggle .ui-btn {
    grid-column: 1 / -1;
    width: 100%;
  }

  .ai-history-page__observe-panel-toggle .ui-btn {
    width: 100%;
  }

  .ai-history-page__filters-head {
    display: grid;
    gap: 4px;
  }

  .ai-history-page__filter .inp,
  .ai-history-page__filter .ui-input-wrap,
  .ai-history-page__filter .ui-select {
    width: 100%;
  }

  .ai-history-page__daily-head {
    display: grid;
    gap: 4px;
  }

  .ai-history-page__daily-stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-history-page__detail-actions {
    margin-left: 0;
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ai-history-page__detail-toolbar-actions {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ai-history-split__detail-top {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .ai-history-page__detail-trace-toggle {
    justify-self: start;
  }

  .ai-history-page__learning-strip {
    display: grid;
    gap: 10px;
  }

  .ai-history-page__learning-strip-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-history-page__turn-quick-actions {
    width: 100%;
    margin-left: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ai-history-page__turn-quick-actions > .ui-btn {
    width: 100%;
  }

  .ai-history-page__turn-behavior-bar {
    display: grid;
    gap: 6px;
  }

  .ai-history-page__turn-behavior-toggle,
  .ai-history-page__turn-maintain-bar {
    display: grid;
    gap: 6px;
  }

  .ai-history-page__turn-maintain-toggle {
    margin-left: 0;
    justify-self: start;
  }

  .ai-history-page__persona-wrap .ai-history-panel-shell__actions {
    width: 100%;
  }

  .ai-history-page__persona-wrap .ai-history-panel-shell__actions > .ui-btn {
    flex: 1 1 calc(50% - 4px);
  }

  .ai-history-page__maintain-actions,
  .ai-history-page__feedback-card-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-history-page__maintain-actions > .ui-btn {
    width: 100%;
  }

  .ai-history-page__turn-behavior-toggle {
    margin-left: 0;
    justify-self: start;
  }

  .ai-history-page__filter-action--row {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ai-history-page__feedback-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-history-page__behavior-actions,
  .ai-history-page__behavior-labels,
  .ai-history-page__behavior-evidence,
  .ai-history-page__observe-annotate {
    display: grid;
  }

  .ai-history-page__behavior-select {
    min-width: 0;
  }

  .ai-history-page__behavior-check {
    min-height: auto;
  }

  .ai-history-page__pattern-form {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-history-page__pattern-table-wrap {
    display: none;
  }

  .ai-history-page__pattern-cards {
    display: grid;
  }

  .ai-history-page__pattern-actions {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ai-history-page__pattern-actions >  .ui-btn {
    width: auto;
    flex: 0 0 auto;
  }

  .ai-history-page__date-filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .ai-date-field {
    width: 100%;
    justify-content: space-between;
  }
}

.ai-history-page__workspace.plugin-config-page {
  gap: 16px;
}

.ai-history-page__workspace-hero {
  margin-bottom: 0;
  padding: 2px 2px 4px;
}

.ai-history-page__workspace-hero .plugin-config-page__hero-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.ai-history-page__workspace-hero .plugin-config-page__hero-desc {
  margin: 6px 0 0;
  max-width: 42rem;
}

.ai-history-page__advanced-debug {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-2, #f3f4f6) 88%, transparent);
}

.ai-history-page__feedback-meta {
  gap: 8px 12px;
  font-size: 0.8rem;
}

.ai-history-page__workspace--maintain,
.ai-history-page__workspace.plugin-config-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
