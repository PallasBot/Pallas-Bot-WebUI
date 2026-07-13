<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  fetchConversationKernelKnowledgeSources,
  fetchConversationKernelMemory,
  fetchConversationKernelRelationshipNotes,
  fetchConversationKernelStatus,
  fetchConversationKernelTraces,
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
} from "@/api/pallasTypes";
import UiButton from "@/components/ui/UiButton.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";
import UiDialog from "@/components/ui/UiDialog.vue";
import AiHistoryContextBar from "@/components/ai-history/AiHistoryContextBar.vue";
import AiHistoryPanelShell from "@/components/ai-history/AiHistoryPanelShell.vue";
import AiHistorySessionFilterBar from "@/components/ai-history/AiHistorySessionFilterBar.vue";
import PersonaAffectObservePanel from "@/components/PersonaAffectObservePanel.vue";
import { useAiObservationRefresh } from "@/composables/useAiObservationRefresh";
import { AI_ASSISTANT_NAME, AI_STATS_LIMITS } from "@/config/aiConstants";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import {
  BEHAVIOR_ACTION_OPTIONS,
  BEHAVIOR_OUTCOME_OPTIONS,
  BEHAVIOR_SCENE_OPTIONS,
  PATTERN_SORT_OPTIONS,
  labelAction,
  labelActions,
  labelFeatureLevel,
  labelOutcome,
  labelRepeaterMode,
  labelScene,
} from "@/utils/aiHistoryLabels";
import { copyTextToClipboard } from "@/utils/clipboard";
import { pushConsoleToast } from "@/utils/consoleToast";
import { formatCompactDateTime, formatRelativeDayLabel } from "@/utils/formatDateTime";
import { deriveFeedbackGroupFromSession } from "@/utils/llmRepeaterFeedbackLink";

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
const expandedKernelTraceKeys = ref<Record<string, boolean>>({});
const expandedBehaviorTraceKeys = ref<Record<string, boolean>>({});
const expandedObserveAnnotateIds = ref<Record<string, boolean>>({});
const sessionDetailAnchor = ref<HTMLElement | null>(null);
const expandedObserveKeys = ref<Record<string, boolean>>({});
type MaintainPanelKey = "persona" | "feedback" | "promotion" | "behavior" | "kernel";
const maintainPanelExpanded = ref<Record<MaintainPanelKey, boolean>>({
  persona: false,
  feedback: true,
  promotion: false,
  behavior: false,
  kernel: false,
});
const personaPanelRef = ref<InstanceType<typeof PersonaAffectObservePanel> | null>(null);
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

function personaShapingTaskLabel(summary: LlmPersonaShapingSummary | null): string {
  const task = String(summary?.source_task || "").trim();
  if (!task) return "未知任务";
  if (task === "llm_chat") return "@ 闲聊";
  if (task.startsWith("repeater")) return "复读 / 语料";
  return task;
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

function isObserveAnnotateExpanded(requestId: string): boolean {
  return !!expandedObserveAnnotateIds.value[requestId];
}

function toggleObserveAnnotateExpanded(requestId: string): void {
  expandedObserveAnnotateIds.value = {
    ...expandedObserveAnnotateIds.value,
    [requestId]: !expandedObserveAnnotateIds.value[requestId],
  };
}

function scrollSessionDetailIntoView(): void {
  if (!window.matchMedia("(max-width: 860px)").matches) return;
  sessionDetailAnchor.value?.scrollIntoView({ behavior: "smooth", block: "start" });
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

function openHistoryVerify(): void {
  void router.push({ path: "/ai/history", query: { workspace: "sessions" } });
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

function sessionIsPrivate(item: LlmHistorySessionSummary): boolean {
  return item.group_id === 0;
}

function relativeDayLabel(tsSeconds: number): string {
  return formatRelativeDayLabel(tsSeconds) ?? "";
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

function isLongTurn(content: string): boolean {
  return content.length > 220 || content.split("\n").length > 6;
}

function isLongObserveText(content: string): boolean {
  return content.length > 120 || content.split("\n").length > 3;
}

function observeTextKey(kind: string, id: string): string {
  return `${kind}-${id}`;
}

function isObserveTextExpanded(key: string): boolean {
  return !!expandedObserveKeys.value[key];
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

function isTurnExpanded(key: string): boolean {
  return !!expandedTurnKeys.value[key];
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

function formatOutcomeLabel(outcome?: string | null): string {
  return labelOutcome(outcome);
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

function feedbackLearningLabel(entry: LlmRepeaterFeedbackEntry | null): string {
  if (!entry) return "未收录反哺";
  return entry.eligible_for_bias ? "参与学习" : "已排除";
}

function feedbackLearningClass(entry: LlmRepeaterFeedbackEntry | null): string {
  if (!entry) return "is-none";
  return entry.eligible_for_bias ? "is-active" : "is-excluded";
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

function buildSessionKey(botId?: number | null, groupId?: number | null, userId?: number | null): string {
  if (!botId || userId == null) return "";
  return `${botId}:${groupId ?? 0}:${userId}`;
}

function parseLineList(raw: string): string[] {
  return raw
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function patternEditorTriggerText(): string {
  return (patternEditor.value.trigger_features ?? []).join("\n");
}

function patternEditorExampleText(): string {
  return (patternEditor.value.reference_examples ?? []).join("\n");
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
    memoryErr.value = "请先输入 Bot QQ";
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

async function changeBehaviorOutcome(run: LlmHistoryBehaviorRun, event: Event) {
  const value = (event.target as HTMLSelectElement | null)?.value ?? "";
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

onMounted(() => {
  const workspaceRaw = String(route.query.workspace ?? "").trim();
  if (
    workspaceRaw === "sessions"
    || workspaceRaw === "maintain"
    || workspaceRaw === "rules"
    || workspaceRaw === "memory"
  ) {
    activeWorkspace.value = workspaceRaw;
  }
  void refreshAll();
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
  <div class="ai-history-page">

    <div v-if="combinedErr" class="alert alert--err">{{ combinedErr }}</div>

    <section
      v-if="(showLearningLoopBanner || learningLoopHint) && (activeWorkspace === 'sessions' || activeWorkspace === 'maintain')"
      class="ai-history-page__learning-strip"
      :class="{ 'is-warn': showLearningLoopBanner }"
    >
      <div class="ai-history-page__learning-strip-main">
        <strong>{{ showLearningLoopBanner ? "学习闭环未接通" : "学习状态" }}</strong>
        <p class="muted ai-history-page__learning-strip-text">{{ learningLoopHint }}</p>
        <ol v-if="showLearningLoopBanner" class="ai-history-page__learning-steps">
          <li>在「会话」里对坏回复点「排除」，或填写「期望回复」做校正写回</li>
          <li>到 <RouterLink :to="aiConfigSectionPath('strategy')">AI 配置 → Bot 对话策略</RouterLink> 开启「让闲聊软反馈参与接话弱打分」</li>
          <li>（可选）开启写回语料，把好样本审进接话库</li>
        </ol>
      </div>
      <div class="row-actions ai-history-page__learning-strip-actions">
        <UiButton v-if="showLearningLoopBanner" size="sm" variant="primary" @click="openLlmCommonConfig(true)">
          去开启加权
        </UiButton>
        <UiButton
          v-if="showLearningLoopBanner"
          size="sm"
          variant="ghost"
          @click="dismissLearningLoopBanner"
        >
          知道了
        </UiButton>
        <UiButton
          v-else-if="learningLoopState?.kind === 'bias_on' || learningLoopState?.kind === 'full'"
          size="sm"
          variant="outline"
          @click="openHistoryVerify"
        >
          已在维护？去验证
        </UiButton>
        <UiButton
          v-else-if="learningLoopState?.kind === 'idle'"
          size="sm"
          variant="outline"
          @click="openLlmCommonConfig(true)"
        >
          开启学习闭环
        </UiButton>
      </div>
    </section>

    <nav class="ai-history-page__workspace-tabs" aria-label="AI 历史工作区">
      <div class="console-view-toggle console-view-toggle--full" role="tablist">
        <button
          v-for="tab in WORKSPACE_TABS"
          :key="tab.value"
          type="button"
          role="tab"
          class="ai-history-page__workspace-tab"
          :class="{ 'is-on': activeWorkspace === tab.value }"
          :aria-selected="activeWorkspace === tab.value"
          @click="activeWorkspace = tab.value"
        >
          <ConsoleNavIcon
            :name="tab.icon"
            :size="16"
          />
          <span>{{ tab.label }}</span>
          <span
            v-if="workspaceTabBadges[tab.value] > 0"
            class="ai-history-page__workspace-badge"
          >
            {{ workspaceTabBadges[tab.value] }}
          </span>
        </button>
      </div>
    </nav>

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

    <div v-show="activeWorkspace === 'sessions'" class="ai-history-page__workspace ai-history-page__workspace--sessions">
    <section class="ai-history-split ai-hub-panel">
      <aside class="ai-history-split__list">
        <div class="ai-history-split__list-top">
          <div class="ai-history-split__list-title">
            <h3>会话列表</h3>
            <span class="muted">{{ visibleSessions.length }}/{{ sessions.length }}</span>
          </div>
          <AiHistorySessionFilterBar
            v-model:filter-bot="filterBot"
            v-model:filter-group="filterGroup"
            v-model:filter-user="filterUser"
            :busy="historyBusy"
            @apply="refreshSessions"
            @reset="refreshSessions"
          />
        </div>
        <div v-if="sessions.length" class="ai-history-page__session-list ai-history-page__session-list--scroll">
          <button
            v-for="item in visibleSessions"
            :key="item.session_key"
            type="button"
            class="ai-history-session"
            :class="{ 'is-on': selectedSessionKey === item.session_key }"
            @click="selectedSessionKey = item.session_key"
          >
            <div class="ai-history-session__head">
              <div class="ai-history-session__tags">
                <span
                  class="ai-history-session__tag"
                  :class="sessionIsPrivate(item) ? 'is-dm' : 'is-group'"
                >
                  {{ sessionIsPrivate(item) ? "私聊" : "群聊" }}
                </span>
                <span
                  v-if="relativeDayLabel(item.last_created_at)"
                  class="ai-history-session__tag is-day"
                >
                  {{ relativeDayLabel(item.last_created_at) }}
                </span>
                <span class="ai-history-session__tag is-count">{{ item.turn_count }} 条</span>
                <span class="ai-history-session__tag is-bot">Bot {{ item.bot_id }}</span>
              </div>
              <time class="ai-history-session__time muted">{{ formatCompactDateTime(item.last_created_at) }}</time>
            </div>
            <div class="ai-history-session__title">
              <strong v-if="sessionIsPrivate(item)">用户 {{ item.user_id }}</strong>
              <template v-else>
                <strong>群 {{ item.group_id }}</strong>
                <span class="ai-history-session__title-sub muted">用户 {{ item.user_id }}</span>
              </template>
            </div>
            <p class="ai-history-session__preview">{{ item.last_content || "（空消息）" }}</p>
          </button>
          <button
            v-if="sessions.length > visibleSessions.length"
            type="button"
            class="ai-history-page__more"
            @click="showAllSessions = true"
          >
            展开其余 {{ sessions.length - visibleSessions.length }} 个会话
          </button>
          <button
            v-else-if="sessions.length > 8"
            type="button"
            class="ai-history-page__more"
            @click="showAllSessions = false"
          >
            收起到前 8 个会话
          </button>
        </div>
        <div v-else class="ai-empty">
          <span>暂无会话记录</span>
          <span class="ai-empty__hint">AI 产生对话后会显示在这里。</span>
        </div>
      </aside>

      <main class="ai-history-split__detail">
      <div ref="sessionDetailAnchor" class="ai-history-page__detail-anchor">
        <div class="ai-history-split__detail-top">
          <div class="ai-history-detail__intro">
            <h3 class="ai-history-split__detail-title">会话明细</h3>
            <div
              v-if="selectedSession"
              class="ai-history-detail__tags"
            >
              <span
                class="ai-history-session__tag"
                :class="sessionIsPrivate(selectedSession) ? 'is-dm' : 'is-group'"
              >
                {{ sessionIsPrivate(selectedSession) ? "私聊" : "群聊" }}
              </span>
              <span
                v-if="relativeDayLabel(selectedSession.last_created_at)"
                class="ai-history-session__tag is-day"
              >
                {{ relativeDayLabel(selectedSession.last_created_at) }}
              </span>
              <span class="ai-history-session__tag is-count">{{ selectedSession.turn_count }} 条</span>
              <span class="ai-history-session__tag is-bot">Bot {{ selectedSession.bot_id }}</span>
            </div>
            <p class="ai-history-split__detail-lede">
              {{ sessionDetail ? workspaceContextLabel || "当前选中会话" : "选择左侧会话查看完整对话" }}
            </p>
          </div>
          <label
            v-if="sessionDetail"
            class="ai-history-page__detail-trace-toggle"
          >
            <input v-model="showDecisionTraces" type="checkbox">
            判定详情
          </label>
        </div>
        <div v-if="sessionDetail" class="ai-history-page__detail">
          <div class="ai-history-page__thread">
            <article
              v-for="row in sessionTurnRows.rows"
              :key="turnKey(row.turn.created_at, row.index)"
              class="ai-history-page__turn"
              :class="row.turn.role === 'assistant' ? 'is-assistant' : 'is-user'"
            >
              <div class="ai-history-page__turn-head">
                <strong>{{ row.turn.role === "assistant" ? AI_ASSISTANT_NAME : `用户 ${row.turn.user_id}` }}</strong>
                <div class="ai-history-page__turn-meta">
                  <span
                    v-if="relativeDayLabel(row.turn.created_at)"
                    class="ai-history-page__turn-day-tag"
                  >
                    {{ relativeDayLabel(row.turn.created_at) }}
                  </span>
                  <time class="ai-history-page__turn-time">{{ formatCompactDateTime(row.turn.created_at) }}</time>
                </div>
              </div>
              <div
                class="ai-history-page__turn-body"
                :class="{ 'is-expanded': isTurnExpanded(turnKey(row.turn.created_at, row.index)) }"
              >
                <p>{{ row.turn.content }}</p>
              </div>
              <button
                v-if="isLongTurn(row.turn.content)"
                type="button"
                class="ai-history-page__turn-toggle"
                @click="toggleTurnExpanded(turnKey(row.turn.created_at, row.index))"
              >
                {{ isTurnExpanded(turnKey(row.turn.created_at, row.index)) ? "收起" : "展开全文" }}
              </button>
              <div v-if="row.decisionTrace && showDecisionTraces" class="ai-history-page__turn-decision">
                <div class="ai-history-page__turn-behavior-bar">
                  <span class="ai-history-page__turn-behavior-tag">判定</span>
                  <strong>{{ kernelTraceSummary(row.decisionTrace) }}</strong>
                  <span
                    class="ai-history-page__outcome-badge"
                    :class="kernelTraceOpportunityClass(row.decisionTrace)"
                  >
                    {{ kernelTraceOpportunityLabel(row.decisionTrace) }}
                  </span>
                  <span v-if="traceTimestamp(row.decisionTrace)" class="muted">
                    {{ formatCompactDateTime(traceTimestamp(row.decisionTrace)) }}
                  </span>
                </div>
                <div v-if="kernelTraceHighlights(row.decisionTrace).length" class="ai-history-page__trace-highlights">
                  <span
                    v-for="item in kernelTraceHighlights(row.decisionTrace)"
                    :key="`${turnKey(row.turn.created_at, row.index)}-${item.label}`"
                  >
                    {{ item.label }}：{{ item.value }}
                  </span>
                </div>
              </div>
              <div v-if="row.turn.role === 'assistant'" class="ai-history-page__turn-maintain">
                <div class="ai-history-page__turn-maintain-bar">
                  <span
                    class="ai-history-page__maintain-pill"
                    :class="feedbackLearningClass(row.feedbackEntry)"
                  >
                    {{ feedbackLearningLabel(row.feedbackEntry) }}
                  </span>
                  <div
                    v-if="row.feedbackEntry && !isSessionMaintainExpanded(turnMaintKey(row))"
                    class="row-actions ai-history-page__turn-quick-actions"
                  >
                    <UiButton
                      v-if="row.feedbackEntry.eligible_for_bias"
                      size="sm"
                      variant="outline"
                      :busy="isFeedbackManageBusy(row.feedbackEntry)"
                      @click="manageFeedbackEntry(row.feedbackEntry, 'invalidate')"
                    >
                      排除
                    </UiButton>
                    <UiButton
                      v-else
                      size="sm"
                      variant="outline"
                      :busy="isFeedbackManageBusy(row.feedbackEntry)"
                      @click="manageFeedbackEntry(row.feedbackEntry, 'restore')"
                    >
                      恢复
                    </UiButton>
                    <UiButton
                      size="sm"
                      variant="ghost"
                      class="ai-history-page__danger-btn"
                      :busy="isFeedbackManageBusy(row.feedbackEntry)"
                      @click="manageFeedbackEntry(row.feedbackEntry, 'delete')"
                    >
                      删除
                    </UiButton>
                  </div>
                  <button
                    type="button"
                    class="ai-history-page__turn-toggle ai-history-page__turn-maintain-toggle"
                    @click="toggleSessionMaintainExpanded(turnMaintKey(row), row)"
                  >
                    {{ isSessionMaintainExpanded(turnMaintKey(row)) ? "收起" : (row.behaviorRun ? "行为标注" : "详情") }}
                  </button>
                </div>
                <div
                  v-if="isSessionMaintainExpanded(turnMaintKey(row))"
                  class="ai-history-page__turn-maintain-body"
                >
                  <section
                    v-if="sessionTurnRequestId(row)"
                    class="ai-history-page__maintain-section ai-history-page__persona-shaping-section"
                  >
                    <h5 class="ai-history-page__maintain-section-title">牛格塑形</h5>
                    <p class="muted ai-history-page__maintain-hint">
                      展示本轮请求注入的塑形摘要；@ 闲聊含完整塑形块，复读链路通常较轻。
                    </p>
                    <div v-if="personaShapingBusy[sessionTurnRequestId(row)]" class="muted ai-history-page__maintain-hint">
                      加载塑形摘要…
                    </div>
                    <p
                      v-else-if="personaShapingError[sessionTurnRequestId(row)]"
                      class="ai-history-page__maintain-empty"
                    >
                      未找到 runtime 快照：{{ personaShapingError[sessionTurnRequestId(row)] }}
                    </p>
                    <template v-else-if="personaShapingForRequestId(sessionTurnRequestId(row))">
                      <div class="ai-history-page__maintain-meta">
                        <span>任务：{{ personaShapingTaskLabel(personaShapingForRequestId(sessionTurnRequestId(row))) }}</span>
                        <span>
                          塑形块：
                          {{
                            personaShapingForRequestId(sessionTurnRequestId(row))?.persona_shaping_active
                              ? "已注入"
                              : "未注入"
                          }}
                        </span>
                      </div>
                      <p
                        v-if="!personaShapingForRequestId(sessionTurnRequestId(row))?.persona_shaping_active"
                        class="muted ai-history-page__maintain-hint"
                      >
                        未注入表示本轮请求未写入【本轮牛格塑形】；常见于复读/语料链路、功能上线前的旧记录，或当时未解析到 persona。
                      </p>
                      <ul
                        v-if="personaShapingForRequestId(sessionTurnRequestId(row))?.lines?.length"
                        class="ai-history-page__persona-shaping-lines"
                      >
                        <li
                          v-for="(line, lineIndex) in personaShapingForRequestId(sessionTurnRequestId(row))?.lines"
                          :key="`${sessionTurnRequestId(row)}-line-${lineIndex}`"
                        >
                          {{ line }}
                        </li>
                      </ul>
                      <p
                        v-if="personaShapingForRequestId(sessionTurnRequestId(row))?.dynamic_expression"
                        class="ai-history-page__persona-shaping-extra"
                      >
                        {{ personaShapingForRequestId(sessionTurnRequestId(row))?.dynamic_expression }}
                      </p>
                      <p
                        v-if="personaShapingForRequestId(sessionTurnRequestId(row))?.variation_hint"
                        class="ai-history-page__persona-shaping-extra muted"
                      >
                        {{ personaShapingForRequestId(sessionTurnRequestId(row))?.variation_hint }}
                      </p>
                      <p class="muted ai-history-page__maintain-hint ai-history-page__persona-shaping-note">
                        {{ personaShapingForRequestId(sessionTurnRequestId(row))?.compare_note }}
                      </p>
                    </template>
                    <p v-else class="ai-history-page__maintain-empty">
                      暂无塑形摘要（可能为旧请求或未落盘 runtime 快照）。
                    </p>
                  </section>
                  <section class="ai-history-page__maintain-section">
                    <h5 class="ai-history-page__maintain-section-title">反哺学习</h5>
                    <p class="muted ai-history-page__maintain-hint">
                      控制这条回复是否参与后续复读偏好；可填写期望回复，供后续 @ 闲聊参考。
                    </p>
                    <template v-if="row.feedbackEntry">
                      <div class="ai-history-page__maintain-meta">
                        <span>路由：{{ row.feedbackEntry.llm_route || "未知" }}</span>
                        <span>场景：{{ labelScene(row.feedbackEntry.behavior_scene) }}</span>
                        <span>状态：{{ row.feedbackEntry.eligible_for_bias ? "参与加权" : "已排除" }}</span>
                      </div>
                      <div class="row-actions ai-history-page__maintain-actions">
                        <UiButton
                          v-if="row.feedbackEntry.eligible_for_bias"
                          size="sm"
                          variant="outline"
                          :busy="isFeedbackManageBusy(row.feedbackEntry)"
                          @click="manageFeedbackEntry(row.feedbackEntry, 'invalidate')"
                        >
                          不适合，不参与学习
                        </UiButton>
                        <UiButton
                          v-else
                          size="sm"
                          variant="outline"
                          :busy="isFeedbackManageBusy(row.feedbackEntry)"
                          @click="manageFeedbackEntry(row.feedbackEntry, 'restore')"
                        >
                          恢复参与学习
                        </UiButton>
                        <UiButton
                          size="sm"
                          variant="ghost"
                          class="ai-history-page__danger-btn"
                          :busy="isFeedbackManageBusy(row.feedbackEntry)"
                          @click="manageFeedbackEntry(row.feedbackEntry, 'delete')"
                        >
                          删除反哺记录
                        </UiButton>
                      </div>
                    </template>
                    <p v-else class="ai-history-page__maintain-empty">
                      此回复未进入反哺池，仍可直接填写期望回复写回。
                    </p>
                    <div class="ai-history-page__correction-editor">
                      <label class="ai-history-page__correction-label">期望回复（校正写回）</label>
                      <textarea
                        class="inp ai-history-page__pattern-textarea ai-history-page__correction-textarea"
                        :value="getCorrectionDraft(row)"
                        placeholder="例如：谢谢，还行吧"
                        rows="3"
                        @input="setCorrectionDraft(row, ($event.target as HTMLTextAreaElement).value)"
                      ></textarea>
                      <div class="row-actions ai-history-page__maintain-actions">
                        <UiButton
                          size="sm"
                          variant="primary"
                          :busy="isCorrectionManageBusy(row.feedbackEntry?.entry_id || row.feedbackEntry?.request_id || correctionDraftKey(row))"
                          @click="saveFeedbackCorrectionForTurn(row)"
                        >
                          保存期望回复
                        </UiButton>
                        <UiButton
                          v-if="row.feedbackEntry?.corrected_reply_text"
                          size="sm"
                          variant="ghost"
                          :busy="isCorrectionManageBusy(row.feedbackEntry.entry_id || row.feedbackEntry.request_id)"
                          @click="clearFeedbackCorrectionForTurn(row)"
                        >
                          清除校正
                        </UiButton>
                      </div>
                    </div>
                  </section>
                  <section v-if="row.behaviorRun" class="ai-history-page__maintain-section">
                    <h5 class="ai-history-page__maintain-section-title">行为风格</h5>
                    <div class="ai-history-page__turn-behavior-bar ai-history-page__maintain-behavior-bar">
                      <strong>{{ labelScene(row.behaviorRun.scene) }}</strong>
                      <span
                        class="ai-history-page__outcome-badge"
                        :class="outcomeClass(row.behaviorRun.final_outcome)"
                      >
                        {{ formatOutcomeLabel(row.behaviorRun.final_outcome) }}
                      </span>
                      <span class="muted ai-history-page__turn-behavior-actions">
                        动作：{{ labelActions(row.behaviorRun.selected_actions) }}
                      </span>
                    </div>
                    <div class="ai-history-page__behavior-meta">
                      <span class="ai-history-page__pattern-links">
                        规则：
                        <template v-if="row.behaviorRun.selected_pattern_ids.length">
                          <button
                            v-for="patternId in row.behaviorRun.selected_pattern_ids"
                            :key="`${row.behaviorRun.request_id}-${patternId}`"
                            type="button"
                            class="ai-history-page__pattern-link"
                            @click="focusPattern(patternId, row.behaviorRun.scene, row.behaviorRun.group_id)"
                          >
                            {{ patternId }}
                          </button>
                        </template>
                        <template v-else>无</template>
                      </span>
                      <span>结果：{{ row.behaviorRun.final_outcome || "未判定" }}</span>
                    </div>
                    <div v-if="row.behaviorRun.auto_feedback_payload" class="ai-history-page__behavior-evidence">
                      <span>依据来源：{{ formatBehaviorSource(row.behaviorRun.auto_feedback_payload) }}</span>
                      <span>命中信号：{{ formatBehaviorSignal(row.behaviorRun.auto_feedback_payload) }}</span>
                      <span>命中词：{{ formatBehaviorTokens(row.behaviorRun.auto_feedback_payload) }}</span>
                      <span>观察消息：{{ row.behaviorRun.auto_feedback_payload.observed_turn_count ?? 0 }} 条</span>
                    </div>
                    <template v-if="behaviorAgentTrace(row.behaviorRun.auto_feedback_payload)">
                      <button
                        type="button"
                        class="ai-history-page__turn-toggle"
                        @click="toggleAdvancedDebug(behaviorAgentTraceKey('session', row.behaviorRun.request_id))"
                      >
                        {{ isAdvancedDebugExpanded(behaviorAgentTraceKey('session', row.behaviorRun.request_id)) ? "收起高级" : "高级：决策轨迹与重放" }}
                      </button>
                      <div
                        v-if="isAdvancedDebugExpanded(behaviorAgentTraceKey('session', row.behaviorRun.request_id))"
                        class="ai-history-page__advanced-debug"
                      >
                      <div class="ai-history-page__trace-highlights">
                        <span
                          v-for="item in behaviorAgentTraceHighlights(behaviorAgentTrace(row.behaviorRun.auto_feedback_payload))"
                          :key="`${row.behaviorRun.request_id}-${item.label}`"
                        >
                          {{ item.label }}：{{ item.value }}
                        </span>
                      </div>
                      <pre
                        v-if="expandedBehaviorTraceKeys[behaviorAgentTraceKey('session', row.behaviorRun.request_id)]"
                        class="ai-history-page__kernel-trace-json"
                      >{{ JSON.stringify(behaviorAgentTrace(row.behaviorRun.auto_feedback_payload), null, 2) }}</pre>
                      <div class="row-actions ai-history-page__trace-actions">
                        <button
                          type="button"
                          class="ai-history-page__turn-toggle"
                          @click="toggleBehaviorTraceExpanded(behaviorAgentTraceKey('session', row.behaviorRun.request_id))"
                        >
                          {{ expandedBehaviorTraceKeys[behaviorAgentTraceKey('session', row.behaviorRun.request_id)] ? "收起决策轨迹" : "查看决策轨迹" }}
                        </button>
                        <button
                          type="button"
                          class="ai-history-page__turn-toggle"
                          :disabled="replayRunBusy[row.behaviorRun.request_id]"
                          @click="runReplay(row.behaviorRun.request_id)"
                        >
                          {{ replayRunBusy[row.behaviorRun.request_id] ? "重放中…" : "执行重放" }}
                        </button>
                        <button
                          type="button"
                          class="ai-history-page__turn-toggle"
                          :disabled="replayCopyBusy[row.behaviorRun.request_id]"
                          @click="copyReplayPayload(row.behaviorRun.request_id)"
                        >
                          复制重放数据
                        </button>
                      </div>
                      </div>
                    </template>
                    <p v-if="row.behaviorRun.behavior_hint_text" class="ai-history-page__behavior-hint">
                      {{ row.behaviorRun.behavior_hint_text }}
                    </p>
                    <p class="muted ai-history-page__maintain-hint">点选标签描述这条回复的问题；可配合下方结果一起标注。</p>
                    <div class="ai-history-page__behavior-labels">
                      <button
                        v-for="label in BEHAVIOR_LABEL_OPTIONS"
                        :key="label"
                        type="button"
                        class="ai-history-page__behavior-chip"
                        :class="{ 'is-on': hasBehaviorLabel(row.behaviorRun, label) }"
                        :disabled="isBehaviorBusy(row.behaviorRun.request_id)"
                        @click="toggleBehaviorLabel(row.behaviorRun, label)"
                      >
                        {{ label }}
                      </button>
                    </div>
                    <div class="ai-history-page__behavior-actions">
                      <label class="ai-history-page__behavior-select">
                        <span>对话结果</span>
                        <select
                          class="inp"
                          :value="row.behaviorRun.final_outcome || ''"
                          :disabled="isBehaviorBusy(row.behaviorRun.request_id)"
                          @change="changeBehaviorOutcome(row.behaviorRun, $event)"
                        >
                          <option v-for="item in BEHAVIOR_OUTCOME_OPTIONS" :key="item.value || 'empty'" :value="item.value">
                            {{ item.label }}
                          </option>
                        </select>
                      </label>
                      <UiButton
                        variant="outline"
                        class="ai-history-page__behavior-action-btn"
                        :busy="isBehaviorBusy(row.behaviorRun.request_id)"
                        @click="toggleBehaviorDisabled(row.behaviorRun)"
                      >
                        {{ row.behaviorRun.disabled ? "恢复样本" : "禁用样本" }}
                      </UiButton>
                    </div>
                  </section>
                </div>
              </div>
            </article>
          </div>
          <section v-if="sessionTurnRows.orphanRuns.length" class="ai-history-page__orphan-behavior">
            <div class="ai-head ai-history-page__orphan-behavior-head">
              <h4 class="ai-head__title">未挂上会话的行为记录</h4>
            </div>
            <article
              v-for="run in sessionTurnRows.orphanRuns"
              :key="run.request_id"
              class="ai-history-page__behavior-card"
            >
              <div class="ai-history-page__behavior-top">
                <strong>{{ labelScene(run.scene) }}</strong>
                <span
                  class="ai-history-page__outcome-badge"
                  :class="outcomeClass(run.final_outcome)"
                >
                  {{ formatOutcomeLabel(run.final_outcome) }}
                </span>
              </div>
              <div class="ai-history-page__behavior-meta">
                <span>动作：{{ labelActions(run.selected_actions) }}</span>
                <span class="ai-history-page__pattern-links">
                  规则：
                  <template v-if="run.selected_pattern_ids.length">
                    <button
                      v-for="patternId in run.selected_pattern_ids"
                      :key="`${run.request_id}-${patternId}`"
                      type="button"
                      class="ai-history-page__pattern-link"
                      @click="focusPattern(patternId, run.scene, run.group_id)"
                    >
                      {{ patternId }}
                    </button>
                  </template>
                  <template v-else>无</template>
                </span>
                <span>结果：{{ run.final_outcome || "未判定" }}</span>
              </div>
              <p v-if="run.reply_text" class="ai-history-page__behavior-hint">回复：{{ run.reply_text }}</p>
              <div v-if="run.auto_feedback_payload" class="ai-history-page__behavior-evidence">
                <span>依据来源：{{ formatBehaviorSource(run.auto_feedback_payload) }}</span>
                <span>命中信号：{{ formatBehaviorSignal(run.auto_feedback_payload) }}</span>
                <span>命中词：{{ formatBehaviorTokens(run.auto_feedback_payload) }}</span>
                <span>观察消息：{{ run.auto_feedback_payload.observed_turn_count ?? 0 }} 条</span>
              </div>
              <template v-if="behaviorAgentTrace(run.auto_feedback_payload)">
                <button
                  type="button"
                  class="ai-history-page__turn-toggle"
                  @click="toggleAdvancedDebug(behaviorAgentTraceKey('orphan', run.request_id))"
                >
                  {{ isAdvancedDebugExpanded(behaviorAgentTraceKey('orphan', run.request_id)) ? "收起高级" : "高级：决策轨迹与重放" }}
                </button>
                <div
                  v-if="isAdvancedDebugExpanded(behaviorAgentTraceKey('orphan', run.request_id))"
                  class="ai-history-page__advanced-debug"
                >
                <div class="ai-history-page__trace-highlights">
                  <span
                    v-for="item in behaviorAgentTraceHighlights(behaviorAgentTrace(run.auto_feedback_payload))"
                    :key="`${run.request_id}-orphan-${item.label}`"
                  >
                    {{ item.label }}：{{ item.value }}
                  </span>
                </div>
                <pre
                  v-if="expandedBehaviorTraceKeys[behaviorAgentTraceKey('orphan', run.request_id)]"
                  class="ai-history-page__kernel-trace-json"
                >{{ JSON.stringify(behaviorAgentTrace(run.auto_feedback_payload), null, 2) }}</pre>
                <div class="row-actions ai-history-page__trace-actions">
                  <button
                    type="button"
                    class="ai-history-page__turn-toggle"
                    @click="toggleBehaviorTraceExpanded(behaviorAgentTraceKey('orphan', run.request_id))"
                  >
                    {{ expandedBehaviorTraceKeys[behaviorAgentTraceKey('orphan', run.request_id)] ? "收起决策轨迹" : "查看决策轨迹" }}
                  </button>
                  <button
                    type="button"
                    class="ai-history-page__turn-toggle"
                    :disabled="replayRunBusy[run.request_id]"
                    @click="runReplay(run.request_id)"
                  >
                    {{ replayRunBusy[run.request_id] ? "重放中…" : "执行重放" }}
                  </button>
                  <button
                    type="button"
                    class="ai-history-page__turn-toggle"
                    :disabled="replayCopyBusy[run.request_id]"
                    @click="copyReplayPayload(run.request_id)"
                  >
                    复制重放数据
                  </button>
                </div>
                </div>
              </template>
              <p v-if="run.behavior_hint_text" class="ai-history-page__behavior-hint">{{ run.behavior_hint_text }}</p>
              <div class="ai-history-page__behavior-labels">
                <button
                  v-for="label in BEHAVIOR_LABEL_OPTIONS"
                  :key="label"
                  type="button"
                  class="ai-history-page__behavior-chip"
                  :class="{ 'is-on': hasBehaviorLabel(run, label) }"
                  :disabled="isBehaviorBusy(run.request_id)"
                  @click="toggleBehaviorLabel(run, label)"
                >
                  {{ label }}
                </button>
              </div>
              <div class="ai-history-page__behavior-actions">
                <label class="ai-history-page__behavior-select">
                  <span>结果</span>
                  <select
                    class="inp"
                    :value="run.final_outcome || ''"
                    :disabled="isBehaviorBusy(run.request_id)"
                    @change="changeBehaviorOutcome(run, $event)"
                  >
                    <option v-for="item in BEHAVIOR_OUTCOME_OPTIONS" :key="item.value || 'empty'" :value="item.value">
                      {{ item.label }}
                    </option>
                  </select>
                </label>
                <UiButton
                  variant="outline"
                  class="ai-history-page__behavior-action-btn"
                  :busy="isBehaviorBusy(run.request_id)"
                  @click="toggleBehaviorDisabled(run)"
                >
                  {{ run.disabled ? "恢复样本" : "禁用样本" }}
                </UiButton>
              </div>
            </article>
          </section>
        </div>
        <div v-else class="ai-empty">
          <span>未选择会话</span>
          <span class="ai-empty__hint">点左侧任意会话查看完整对话。</span>
        </div>
      </div>
      </main>
    </section>
    </div>

    <div v-show="activeWorkspace === 'maintain'" class="ai-history-page__workspace ai-history-page__workspace--maintain plugin-config-page">
    <div class="plugin-config-page__hero ai-history-page__workspace-hero">
      <div class="plugin-config-page__hero-text">
        <h2 class="plugin-config-page__hero-title">群维护</h2>
        <p class="plugin-config-page__hero-desc">按群整理接话学习：样本、晋升写回、行为判定与对话内核状态。</p>
      </div>
    </div>
    <AiHistoryPanelShell
      title="牛格观测"
      purpose="按群查看情感轴、群画像与情感细化"
      :summary="personaPanelSummary"
      :expanded="isMaintainPanelExpanded('persona')"
      panel-class="ai-history-page__persona-wrap"
      @toggle="toggleMaintainPanel('persona')"
    >
      <template #actions>
        <UiButton size="sm" variant="ghost" @click="pickGroupFromSessions">从会话选群</UiButton>
        <UiButton
          size="sm"
          variant="ghost"
          :disabled="!isMaintainPanelExpanded('persona')"
          @click="personaPanelRef?.reload?.()"
        >
          刷新
        </UiButton>
      </template>
      <div class="ai-history-page__observe-panel-body ai-history-page__observe-panel-body--persona">
        <PersonaAffectObservePanel
          ref="personaPanelRef"
          embedded
          headless
          :sync-group-id="observeGroup"
          class="ai-history-page__persona-panel"
        />
      </div>
    </AiHistoryPanelShell>
    <section class="ai-history-page__feedback">
      <AiHistoryPanelShell
        title="反哺样本"
        purpose="挑出适合继续学的接话，排除不合适样本"
        :summary="feedbackPanelSummary"
        :expanded="isMaintainPanelExpanded('feedback')"
        @toggle="toggleMaintainPanel('feedback')"
      >
        <div v-if="feedbackErr" class="alert alert--err">{{ feedbackErr }}</div>
        <div v-if="visibleFeedbackItems.length" class="ai-history-page__feedback-list">
          <article
            v-for="item in visibleFeedbackItems"
            :key="item.entry_id || item.request_id"
            class="ai-history-page__feedback-card"
          >
            <div class="ai-history-page__feedback-top">
              <strong
                class="ai-history-page__feedback-reply"
                :class="{ 'is-clamped': isLongObserveText(item.reply_text || '') && !isObserveTextExpanded(observeTextKey('card', item.entry_id || item.request_id)) }"
              >
                {{ item.reply_text || "（空回复）" }}
              </strong>
              <button
                v-if="item.behavior_scene"
                type="button"
                class="ai-history-page__scene-pill ai-history-page__scene-pill--btn"
                @click="applyObserveScene(item.behavior_scene || '')"
              >
                {{ labelScene(item.behavior_scene) }}
              </button>
              <span v-else class="ai-history-page__scene-pill">未标注</span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>{{ formatCompactDateTime(item.created_at) }}</span>
              <span>路由：{{ item.llm_route || "未知" }}</span>
              <span>{{ item.eligible_for_bias ? "参与学习" : "已排除" }}</span>
              <span v-if="item.corrected_reply_text">已校正</span>
            </div>
            <div v-if="item.corrected_reply_text" class="ai-history-page__correction-preview">
              期望：{{ item.corrected_reply_text }}
            </div>
            <div class="ai-history-page__correction-editor ai-history-page__correction-editor--card">
              <label class="ai-history-page__correction-label">期望回复</label>
              <textarea
                class="inp ai-history-page__pattern-textarea ai-history-page__correction-textarea"
                :value="getFeedbackCardCorrectionDraft(item)"
                placeholder="填写更好的接话示例"
                rows="2"
                @input="setFeedbackCardCorrectionDraft(item, ($event.target as HTMLTextAreaElement).value)"
              ></textarea>
            </div>
            <div class="row-actions ai-history-page__feedback-card-actions">
              <UiButton
                size="sm"
                variant="primary"
                :busy="isFeedbackManageBusy(item)"
                @click="saveFeedbackCardCorrection(item)"
              >
                保存校正
              </UiButton>
              <UiButton
                v-if="item.corrected_reply_text"
                size="sm"
                variant="ghost"
                :busy="isFeedbackManageBusy(item)"
                @click="clearFeedbackCardCorrection(item)"
              >
                清除
              </UiButton>
              <UiButton
                v-if="item.eligible_for_bias"
                size="sm"
                variant="outline"
                :busy="isFeedbackManageBusy(item)"
                @click="manageFeedbackEntry(item, 'invalidate')"
              >
                不适合
              </UiButton>
              <UiButton
                v-else
                size="sm"
                variant="outline"
                :busy="isFeedbackManageBusy(item)"
                @click="manageFeedbackEntry(item, 'restore')"
              >
                恢复
              </UiButton>
              <UiButton
                size="sm"
                variant="ghost"
                class="ai-history-page__danger-btn"
                :busy="isFeedbackManageBusy(item)"
                @click="manageFeedbackEntry(item, 'delete')"
              >
                删除
              </UiButton>
            </div>
            <p
              class="ai-history-page__feedback-user"
              :class="{ 'is-clamped': isLongObserveText(item.user_text || '') && !isObserveTextExpanded(observeTextKey('card', item.entry_id || item.request_id)) }"
            >
              用户：{{ item.user_text || "（空）" }}
            </p>
            <button
              v-if="isLongObserveText(item.reply_text || '') || isLongObserveText(item.user_text || '')"
              type="button"
              class="ai-history-page__turn-toggle"
              @click="toggleObserveText(observeTextKey('card', item.entry_id || item.request_id))"
            >
              {{ isObserveTextExpanded(observeTextKey('card', item.entry_id || item.request_id)) ? "收起" : "展开全文" }}
            </button>
          </article>
        </div>
        <div v-else class="ai-empty">
          <span>{{ feedbackGroupId ? (observeScene ? "当前群当前场景下暂无反馈样本" : "当前群暂无反馈样本") : "输入群号查看反馈" }}</span>
          <span class="ai-empty__hint">可在此排除不适合学习的样本，或彻底删除反哺记录。</span>
        </div>
      </AiHistoryPanelShell>
    </section>

    <section class="ai-history-page__feedback">
      <AiHistoryPanelShell
        title="晋升候选"
        purpose="批准后写入本群接话语料"
        :summary="promotionPanelSummary"
        :expanded="isMaintainPanelExpanded('promotion')"
        @toggle="toggleMaintainPanel('promotion')"
      >
        <div class="ai-history-page__filters-card">
          <div class="ai-history-page__filters-head">
            <strong>候选筛选</strong>
            <span class="muted">与上方反馈共用群号；需在对话策略中开启「写回语料」后才会生成候选</span>
          </div>
          <div class="ai-history-page__filters ai-history-page__filters--aligned">
            <div class="ai-history-page__filter-action ai-history-page__filter-action--check">
              <label class="ai-history-page__behavior-check">
                <input
                  v-model="promotionIncludeResolved"
                  type="checkbox"
                  @change="refreshPromotionCandidates"
                >
                显示已处理
              </label>
            </div>
            <div class="ai-history-page__filter-action">
              <UiButton
                size="sm"
                variant="outline"
                :busy="promotionCandidatesBusy"
                :disabled="!feedbackGroupId"
                @click="refreshPromotionCandidates"
              >
                刷新候选
              </UiButton>
            </div>
          </div>
        </div>
        <div v-if="promotionCandidatesErr" class="alert alert--err">{{ promotionCandidatesErr }}</div>
        <div class="ai-stat-grid ai-history-page__feedback-summary">
          <div class="ai-stat ai-history-page__summary-stat">
            <span class="ai-stat__label">待审批</span>
            <strong class="ai-stat__value ai-stat__value--accent">{{ pendingPromotionCandidates.length }}</strong>
          </div>
          <div class="ai-stat ai-history-page__summary-stat">
            <span class="ai-stat__label">列表条目</span>
            <strong class="ai-stat__value">{{ promotionCandidates.length }}</strong>
          </div>
        </div>
        <div v-if="promotionCandidates.length" class="ai-history-page__feedback-list">
          <article
            v-for="item in promotionCandidates"
            :key="item.candidate_id"
            class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior"
          >
            <div class="ai-history-page__feedback-top">
              <strong
                class="ai-history-page__feedback-reply"
                :class="{ 'is-clamped': isLongObserveText(item.reply_text || '') && !isObserveTextExpanded(observeTextKey('promo', item.candidate_id)) }"
              >
                {{ item.reply_text }}
              </strong>
              <span
                class="ai-history-page__outcome-badge"
                :class="{
                  'is-engaged': item.promoted,
                  'is-bad': Boolean(item.rejected_reason),
                  'is-pending': !item.promoted && !item.rejected_reason,
                }"
              >
                {{ promotionCandidateStatusLabel(item) }}
              </span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>支持 {{ item.support_count }} 次</span>
              <span v-if="item.behavior_scene">{{ item.behavior_scene }}</span>
              <span>{{ formatCompactDateTime(item.last_seen_at) }}</span>
              <span v-if="promotionWritebackHint(item)">{{ promotionWritebackHint(item) }}</span>
            </div>
            <p
              class="ai-history-page__feedback-user"
              :class="{ 'is-clamped': isLongObserveText(item.trigger_text || '') && !isObserveTextExpanded(observeTextKey('promo', item.candidate_id)) }"
            >
              触发：{{ item.trigger_text || "—" }}
            </p>
            <button
              v-if="isLongObserveText(item.reply_text || '') || isLongObserveText(item.trigger_text || '')"
              type="button"
              class="ai-history-page__turn-toggle"
              @click="toggleObserveText(observeTextKey('promo', item.candidate_id))"
            >
              {{ isObserveTextExpanded(observeTextKey('promo', item.candidate_id)) ? "收起" : "展开全文" }}
            </button>
            <div
              v-if="!item.promoted && !item.rejected_reason"
              class="row-actions ai-history-page__promotion-actions"
            >
              <UiButton
                size="sm"
                variant="primary"
                :busy="promotionResolveBusyId === item.candidate_id"
                :disabled="Boolean(promotionResolveBusyId)"
                @click="resolvePromotionCandidate(item, 'promote')"
              >
                批准晋升
              </UiButton>
              <UiButton
                size="sm"
                variant="outline"
                :busy="promotionResolveBusyId === item.candidate_id"
                :disabled="Boolean(promotionResolveBusyId)"
                @click="resolvePromotionCandidate(item, 'reject')"
              >
                拒绝
              </UiButton>
            </div>
          </article>
        </div>
        <p v-else class="muted ai-history-page__empty-hint">
          <span>{{ promotionCandidatesBusy ? "正在读取候选…" : (feedbackGroupId ? "当前群暂无晋升候选" : "请先输入群号并读取反馈") }}</span>
        </p>
      </AiHistoryPanelShell>
    </section>

    <section class="ai-history-page__feedback">
      <AiHistoryPanelShell
        title="行为记录"
        purpose="看自动判定是否稳，快速扫最近结果"
        :summary="behaviorPanelSummary"
        :expanded="isMaintainPanelExpanded('behavior')"
        @toggle="toggleMaintainPanel('behavior')"
      >
        <div class="ai-history-page__filters-card">
          <div class="ai-history-page__filters-head">
            <strong>记录筛选</strong>
            <span class="muted">默认跟随当前选中会话的群号</span>
          </div>
          <div class="ai-history-page__filters ai-history-page__filters--aligned">
            <label class="ai-history-page__filter">
              <span>群号</span>
              <input
                v-model="behaviorRunsGroup"
                class="inp"
                inputmode="numeric"
                placeholder="全部"
                @input="behaviorRunsGroupTouched = true; observeGroup = behaviorRunsGroup; observeGroupTouched = true"
                @keyup.enter="refreshBehaviorRuns"
              >
            </label>
            <label class="ai-history-page__filter">
              <span>场景</span>
              <select v-model="behaviorRunsScene" class="inp">
                <option v-for="item in BEHAVIOR_SCENE_OPTIONS" :key="item.value || 'empty'" :value="item.value">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label class="ai-history-page__filter">
              <span>结果</span>
              <select v-model="behaviorRunsOutcome" class="inp">
                <option v-for="item in BEHAVIOR_OUTCOME_OPTIONS" :key="item.value || 'empty'" :value="item.value">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <div class="ai-history-page__filter-action ai-history-page__filter-action--check">
              <label class="ai-history-page__behavior-check">
                <input v-model="behaviorRunsIncludeDisabled" type="checkbox">
                <span>包含已禁用</span>
              </label>
            </div>
            <div class="ai-history-page__filter-action">
              <UiButton size="sm" variant="outline" :busy="behaviorRunsBusy" @click="refreshBehaviorRuns">
                读取记录
              </UiButton>
            </div>
          </div>
        </div>
        <div v-if="behaviorRunsErr" class="alert alert--err">{{ behaviorRunsErr }}</div>
        <div class="ai-stat-grid ai-history-page__feedback-summary">
          <div
            v-for="item in behaviorRunsOverview"
            :key="item.label"
            class="ai-stat ai-history-page__summary-stat"
          >
            <span class="ai-stat__label">{{ item.label }}</span>
            <strong class="ai-stat__value" :class="{ 'ai-stat__value--accent': item.accent }">{{ item.value }}</strong>
          </div>
        </div>
        <div v-if="behaviorRunsItems.length" class="ai-history-page__feedback-list">
          <article
            v-for="run in behaviorRunsItems"
            :key="run.request_id"
            class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior ai-history-page__observe-run"
          >
            <div class="ai-history-page__feedback-top">
              <button
                type="button"
                class="ai-history-page__scene-pill ai-history-page__scene-pill--btn"
                @click="applyObserveScene(run.scene)"
              >
                {{ labelScene(run.scene) }}
              </button>
              <span
                class="ai-history-page__outcome-badge"
                :class="outcomeClass(run.final_outcome)"
              >
                {{ formatOutcomeLabel(run.final_outcome) }}
              </span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span v-if="run.created_at">{{ formatCompactDateTime(run.created_at) }}</span>
              <span>群：{{ run.group_id || "私聊" }}</span>
              <span>用户：{{ run.user_id || "—" }}</span>
              <span>分值变化：{{ run.score_delta ?? 0 }}</span>
              <span>已禁用：{{ run.disabled ? "是" : "否" }}</span>
            </div>
            <p
              v-if="run.user_text"
              class="ai-history-page__feedback-user"
              :class="{ 'is-clamped': isLongObserveText(run.user_text) && !isObserveTextExpanded(observeTextKey('card', run.request_id)) }"
            >
              用户：{{ run.user_text }}
            </p>
            <p
              v-if="run.reply_text"
              class="ai-history-page__feedback-user"
              :class="{ 'is-clamped': isLongObserveText(run.reply_text) && !isObserveTextExpanded(observeTextKey('card', run.request_id)) }"
            >
              回复：{{ run.reply_text }}
            </p>
            <button
              v-if="isLongObserveText(run.user_text || '') || isLongObserveText(run.reply_text || '')"
              type="button"
              class="ai-history-page__turn-toggle"
              @click="toggleObserveText(observeTextKey('card', run.request_id))"
            >
              {{ isObserveTextExpanded(observeTextKey('card', run.request_id)) ? "收起" : "展开全文" }}
            </button>
            <div
              v-if="run.selected_pattern_ids?.length"
              class="ai-history-page__pattern-links ai-history-page__pattern-links--inline"
            >
              <span>命中规则</span>
              <button
                v-for="patternId in run.selected_pattern_ids"
                :key="`${run.request_id}-observe-${patternId}`"
                type="button"
                class="ai-history-page__pattern-link"
                @click="focusPattern(patternId, run.scene, run.group_id)"
              >
                {{ patternId }}
              </button>
            </div>
            <div class="ai-history-page__behavior-evidence">
              <span>依据来源：{{ formatBehaviorSource(run.auto_feedback_payload) }}</span>
              <span>命中信号：{{ formatBehaviorSignal(run.auto_feedback_payload) }}</span>
              <span>命中词：{{ formatBehaviorTokens(run.auto_feedback_payload) }}</span>
              <span>观察消息：{{ run.auto_feedback_payload?.observed_turn_count ?? 0 }} 条</span>
            </div>
            <template v-if="behaviorAgentTrace(run.auto_feedback_payload)">
              <button
                type="button"
                class="ai-history-page__turn-toggle"
                @click="toggleAdvancedDebug(behaviorAgentTraceKey('observe', run.request_id))"
              >
                {{ isAdvancedDebugExpanded(behaviorAgentTraceKey('observe', run.request_id)) ? "收起高级" : "高级：决策轨迹与重放" }}
              </button>
              <div
                v-if="isAdvancedDebugExpanded(behaviorAgentTraceKey('observe', run.request_id))"
                class="ai-history-page__advanced-debug"
              >
              <div class="ai-history-page__trace-highlights">
                <span
                  v-for="item in behaviorAgentTraceHighlights(behaviorAgentTrace(run.auto_feedback_payload))"
                  :key="`${run.request_id}-observe-${item.label}`"
                >
                  {{ item.label }}：{{ item.value }}
                </span>
              </div>
              <pre
                v-if="expandedBehaviorTraceKeys[behaviorAgentTraceKey('observe', run.request_id)]"
                class="ai-history-page__kernel-trace-json"
              >{{ JSON.stringify(behaviorAgentTrace(run.auto_feedback_payload), null, 2) }}</pre>
              <div class="row-actions ai-history-page__trace-actions">
                <button
                  type="button"
                  class="ai-history-page__turn-toggle"
                  @click="toggleBehaviorTraceExpanded(behaviorAgentTraceKey('observe', run.request_id))"
                >
                  {{ expandedBehaviorTraceKeys[behaviorAgentTraceKey('observe', run.request_id)] ? "收起决策轨迹" : "查看决策轨迹" }}
                </button>
                <button
                  type="button"
                  class="ai-history-page__turn-toggle"
                  :disabled="replayRunBusy[run.request_id]"
                  @click="runReplay(run.request_id)"
                >
                  {{ replayRunBusy[run.request_id] ? "重放中…" : "执行重放" }}
                </button>
                <button
                  type="button"
                  class="ai-history-page__turn-toggle"
                  :disabled="replayCopyBusy[run.request_id]"
                  @click="copyReplayPayload(run.request_id)"
                >
                  复制重放数据
                </button>
              </div>
              </div>
            </template>
            <p v-if="run.behavior_hint_text" class="ai-history-page__feedback-user">提示：{{ run.behavior_hint_text }}</p>
            <button
              type="button"
              class="ai-history-page__turn-toggle"
              @click="toggleObserveAnnotateExpanded(run.request_id)"
            >
              {{ isObserveAnnotateExpanded(run.request_id) ? "收起校正" : "校正这条记录" }}
            </button>
            <div
              v-if="isObserveAnnotateExpanded(run.request_id)"
              class="ai-history-page__observe-annotate"
            >
              <div class="ai-history-page__behavior-labels">
                <button
                  v-for="label in BEHAVIOR_LABEL_OPTIONS"
                  :key="`observe-${run.request_id}-${label}`"
                  type="button"
                  class="ai-history-page__behavior-chip"
                  :class="{ 'is-on': hasBehaviorLabel(run, label) }"
                  :disabled="isBehaviorBusy(run.request_id)"
                  @click="toggleBehaviorLabel(run, label)"
                >
                  {{ label }}
                </button>
              </div>
              <div class="ai-history-page__behavior-actions">
                <label class="ai-history-page__behavior-select">
                  <span>人工结果</span>
                  <select
                    class="inp"
                    :value="run.final_outcome || ''"
                    :disabled="isBehaviorBusy(run.request_id)"
                    @change="changeBehaviorOutcome(run, $event)"
                  >
                    <option v-for="item in BEHAVIOR_OUTCOME_OPTIONS" :key="`observe-outcome-${item.value || 'empty'}`" :value="item.value">
                      {{ item.label }}
                    </option>
                  </select>
                </label>
                <UiButton
                  size="sm"
                  variant="ghost"
                  :busy="isBehaviorBusy(run.request_id)"
                  @click="toggleBehaviorDisabled(run)"
                >
                  {{ run.disabled ? "恢复样本" : "禁用样本" }}
                </UiButton>
              </div>
            </div>
            <div class="row-actions ai-history-page__pattern-actions">
              <UiButton
                v-if="buildSessionKey(run.bot_id, run.group_id, run.user_id)"
                size="sm"
                variant="outline"
                @click="openRunInSession(run)"
              >
                查看会话
              </UiButton>
            </div>
          </article>
        </div>
        <div v-else class="ai-empty">
          <span>{{ behaviorRunsBusy ? "正在读取记录" : "当前筛选下暂无行为记录" }}</span>
          <span class="ai-empty__hint">适合快速观察最近哪些规则在生效、哪些结果被自动判成被无视或带偏。</span>
        </div>
      </AiHistoryPanelShell>
    </section>
    <section class="ai-history-page__feedback ai-history-page__kernel-panel">
      <AiHistoryPanelShell
        title="对话内核"
        purpose="查看学习链路是否打开；排障时再展开"
        summary="学习开关与决策轨迹"
        :expanded="isMaintainPanelExpanded('kernel')"
        panel-class="ai-history-page__panel--compact"
        @toggle="toggleMaintainPanel('kernel')"
      >
          <div v-if="kernelStatusErr" class="alert alert--err">{{ kernelStatusErr }}</div>
          <div v-if="kernelTracesErr" class="alert alert--err">{{ kernelTracesErr }}</div>
          <div class="ai-history-page__kernel-chip-row">
            <span
              v-for="item in kernelStatusOverview"
              :key="item.label"
              class="ai-history-page__kernel-chip"
              :class="{ 'is-on': item.accent }"
            >
              {{ item.label }}：{{ item.value }}
            </span>
          </div>
          <p v-if="kernelStatus && !kernelStatusBusy" class="muted ai-history-page__kernel-policy">
            {{ kernelMemoryPolicyLine(kernelStatus) }}
          </p>
          <div v-if="kernelTraces.length" class="ai-history-page__feedback-list ai-history-page__kernel-trace-list">
            <article
              v-for="(row, index) in kernelTraces"
              :key="kernelTraceKey(row, index)"
              class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior"
            >
              <div class="ai-history-page__feedback-top">
                <strong class="ai-history-page__feedback-reply">{{ kernelTraceSummary(row) }}</strong>
                <span
                  class="ai-history-page__outcome-badge"
                  :class="kernelTraceOpportunityClass(row)"
                >
                  {{ kernelTraceOpportunityLabel(row) }}
                </span>
              </div>
              <div class="ai-history-page__feedback-meta">
                <span v-if="row.group_id">群 {{ row.group_id }}</span>
                <span v-if="row.created_at">{{ formatCompactDateTime(row.created_at) }}</span>
              </div>
              <button
                type="button"
                class="ai-history-page__turn-toggle"
                @click="toggleKernelTraceExpanded(kernelTraceKey(row, index))"
              >
                {{ expandedKernelTraceKeys[kernelTraceKey(row, index)] ? "收起原始数据" : "查看原始数据" }}
              </button>
              <pre
                v-if="expandedKernelTraceKeys[kernelTraceKey(row, index)]"
                class="ai-history-page__kernel-trace-json"
              >{{ JSON.stringify(row, null, 2) }}</pre>
            </article>
          </div>
          <p v-else class="muted ai-history-page__empty-hint">
            {{ kernelTracesBusy ? "正在读取决策轨迹…" : "当前筛选下暂无决策轨迹" }}
          </p>
      </AiHistoryPanelShell>
    </section>
    </div>

    <div v-show="activeWorkspace === 'memory'" class="ai-history-page__workspace plugin-config-page">
    <section class="ai-history-page__feedback">
      <AiHistoryPanelShell
        title="记忆与知识"
        purpose="按 Bot / 群号查看群内旧事、关系备注与知识源"
        :collapsible="false"
      >
        <div class="ai-history-page__filters-card">
          <div class="ai-history-page__filters-head">
            <strong>范围筛选</strong>
            <span class="muted">优先跟随当前会话的 Bot / 群号，也可手动指定</span>
          </div>
          <div class="ai-history-page__filters ai-history-page__filters--aligned">
            <label class="ai-history-page__filter">
              <span>Bot QQ</span>
              <input
                v-model="memoryBot"
                class="inp"
                inputmode="numeric"
                placeholder="必填"
                @input="memoryBotTouched = true"
                @keyup.enter="refreshMemoryWorkspace"
              >
            </label>
            <label class="ai-history-page__filter">
              <span>群号</span>
              <input
                v-model="memoryGroup"
                class="inp"
                inputmode="numeric"
                placeholder="0 / 空 = 全局"
                @input="memoryGroupTouched = true"
                @keyup.enter="refreshMemoryWorkspace"
              >
            </label>
            <label class="ai-history-page__filter">
              <span>搜索</span>
              <input
                v-model="memoryQuery"
                class="inp"
                placeholder="搜内容、关键词或来源"
                @keyup.enter="refreshMemoryWorkspace"
              >
            </label>
            <div class="ai-history-page__filter-action">
              <UiButton size="sm" variant="outline" :busy="memoryBusy" @click="refreshMemoryWorkspace">
                读取记忆
              </UiButton>
            </div>
          </div>
        </div>
        <div v-if="memoryErr" class="alert alert--err">{{ memoryErr }}</div>
        <div class="ai-stat-grid ai-history-page__feedback-summary">
          <div
            v-for="item in memoryOverview"
            :key="item.label"
            class="ai-stat ai-history-page__summary-stat"
          >
            <span class="ai-stat__label">{{ item.label }}</span>
            <strong class="ai-stat__value" :class="{ 'ai-stat__value--accent': item.accent }">{{ item.value }}</strong>
          </div>
        </div>

        <div class="ai-head ai-history-page__kernel-trace-head">
          <h4 class="ai-head__title">群内旧事</h4>
        </div>
        <div v-if="memoryEntries.length" class="ai-history-page__feedback-list">
          <article
            v-for="item in memoryEntries"
            :key="`memory-${item.id}`"
            class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior"
          >
            <div class="ai-history-page__feedback-top">
              <strong class="ai-history-page__feedback-reply">{{ item.content }}</strong>
              <span class="ai-history-page__scene-pill">{{ item.source || "memory" }}</span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>群：{{ item.group_id || "全局" }}</span>
              <span>关键词：{{ item.keywords || "—" }}</span>
              <span v-if="item.updated_at">{{ formatCompactDateTime(item.updated_at) }}</span>
            </div>
            <div class="row-actions ai-history-page__pattern-actions">
              <UiButton
                size="sm"
                variant="destructive"
                :busy="memoryDeleteBusy === `memory:${item.id}`"
                @click="deleteMemoryEntry(item)"
              >
                删除
              </UiButton>
            </div>
          </article>
        </div>
        <p v-else class="muted ai-history-page__empty-hint">
          {{ memoryBusy ? "正在读取群内旧事…" : "当前筛选下暂无群内旧事" }}
        </p>

        <div class="ai-head ai-history-page__kernel-trace-head">
          <h4 class="ai-head__title">关系备注</h4>
        </div>
        <div v-if="relationshipNotes.length" class="ai-history-page__feedback-list">
          <article
            v-for="item in relationshipNotes"
            :key="`relationship-${item.id}`"
            class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior"
          >
            <div class="ai-history-page__feedback-top">
              <strong class="ai-history-page__feedback-reply">{{ item.content }}</strong>
              <span class="ai-history-page__scene-pill">用户 {{ item.user_id }}</span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>群：{{ item.group_id || "全局" }}</span>
              <span>来源：{{ item.source === "teach" || !item.source ? "教导" : item.source }}</span>
              <span>权重：{{ typeof item.weight === "number" ? item.weight.toFixed(2) : "—" }}</span>
              <span v-if="item.updated_at">{{ formatCompactDateTime(item.updated_at) }}</span>
            </div>
            <div class="row-actions ai-history-page__pattern-actions">
              <UiButton
                size="sm"
                variant="destructive"
                :busy="memoryDeleteBusy === `relationship:${item.id}`"
                @click="deleteRelationshipNote(item)"
              >
                删除
              </UiButton>
            </div>
          </article>
        </div>
        <p v-else class="muted ai-history-page__empty-hint">
          {{ memoryBusy ? "正在读取关系备注…" : "当前筛选下暂无关系备注" }}
        </p>

        <div class="ai-head ai-history-page__kernel-trace-head">
          <h4 class="ai-head__title">知识源</h4>
        </div>
        <div v-if="knowledgeSources.length" class="ai-history-page__feedback-list">
          <article
            v-for="item in knowledgeSources"
            :key="item.source_id"
            class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior"
          >
            <div class="ai-history-page__feedback-top">
              <strong class="ai-history-page__feedback-reply">{{ item.title }}</strong>
              <span class="ai-history-page__scene-pill">{{ item.scope === "global" || !item.scope ? "全局" : item.scope }}</span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>{{ item.source_id }}</span>
              <span>来源：{{ item.plugin_title || item.plugin_name || item.origin || "未知" }}</span>
              <span>模式：{{ item.retrieval_mode === "prompt_inject" || !item.retrieval_mode ? "提示注入" : item.retrieval_mode }}</span>
              <span>片段数：{{ item.chunk_count ?? 0 }}</span>
            </div>
            <p v-if="item.description" class="ai-history-page__feedback-user">说明：{{ item.description }}</p>
          </article>
        </div>
        <p v-else class="muted ai-history-page__empty-hint">
          {{ memoryBusy ? "正在读取知识源…" : "当前暂无知识源" }}
        </p>
      </AiHistoryPanelShell>
    </section>
    </div>

    <div v-show="activeWorkspace === 'rules'" class="ai-history-page__workspace plugin-config-page">
    <section class="ai-history-page__feedback">
      <AiHistoryPanelShell
        title="行为规则"
        purpose="维护自动判定用的场景规则与动作偏好"
        :collapsible="false"
      >
        <div class="ai-history-page__filters-card">
          <div class="ai-history-page__filters-head">
            <strong>规则筛选</strong>
            <span class="muted">默认跟随当前选中会话的群号</span>
          </div>
          <div class="ai-history-page__filters ai-history-page__filters--aligned">
            <label class="ai-history-page__filter">
              <span>群号</span>
              <input
                v-model="patternsGroup"
                class="inp"
                inputmode="numeric"
                placeholder="全部"
                @input="patternsGroupTouched = true"
                @keyup.enter="refreshPatterns"
              >
            </label>
            <label class="ai-history-page__filter">
              <span>场景</span>
              <select v-model="patternsScene" class="inp">
                <option v-for="item in BEHAVIOR_SCENE_OPTIONS" :key="`pattern-${item.value || 'empty'}`" :value="item.value">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <div class="ai-history-page__filter-action ai-history-page__filter-action--check">
              <label class="ai-history-page__behavior-check">
                <input v-model="patternsIncludeDisabled" type="checkbox">
                <span>包含已禁用</span>
              </label>
            </div>
            <label class="ai-history-page__filter">
              <span>排序</span>
              <select v-model="patternSortKey" class="inp">
                <option
                  v-for="item in PATTERN_SORT_OPTIONS"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </option>
              </select>
            </label>
            <div class="ai-history-page__filter-action ai-history-page__filter-action--row">
              <UiButton size="sm" variant="outline" :busy="patternBusy" @click="refreshPatterns">
                读取规则
              </UiButton>
              <UiButton size="sm" variant="ghost" @click="openPatternEditorCreate">
                新建规则
              </UiButton>
            </div>
          </div>
        </div>
        <div v-if="patternErr" class="alert alert--err">{{ patternErr }}</div>
        <div class="ai-stat-grid ai-history-page__feedback-summary">
          <div
            v-for="item in patternsOverview"
            :key="item.label"
            class="ai-stat ai-history-page__summary-stat"
          >
            <span class="ai-stat__label">{{ item.label }}</span>
            <strong class="ai-stat__value" :class="{ 'ai-stat__value--accent': item.accent }">{{ item.value }}</strong>
          </div>
        </div>

        <div v-if="sortedPatternsItems.length" class="table-wrap ai-history-page__pattern-table-wrap">
          <table class="ai-history-page__pattern-table">
            <thead>
              <tr>
                <th>规则 ID</th>
                <th>场景 / 动作</th>
                <th>群</th>
                <th>自动分 / 人工分</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in sortedPatternsItems"
                :key="`table-${item.pattern_id}`"
                :class="{ 'is-editing': patternEditorOpen && patternEditor.pattern_id === item.pattern_id }"
              >
                <td class="ai-history-page__pattern-id">{{ item.pattern_id }}</td>
                <td>{{ labelScene(item.scene) }} / {{ labelAction(item.action) }}</td>
                <td>{{ item.scope_group_id || "全局" }}</td>
                <td>{{ item.success_score ?? 0 }} / {{ item.manual_score ?? 0 }}</td>
                <td>{{ item.disabled ? "已禁用" : "生效中" }}</td>
                <td>
                  <div class="row-actions ai-history-page__pattern-actions ai-history-page__pattern-actions--table">
                    <UiButton size="sm" variant="outline" @click="openPatternEditorEdit(item)">
                      编辑
                    </UiButton>
                    <UiButton
                      size="sm"
                      variant="ghost"
                      :busy="patternSaveBusy && patternEditor.pattern_id === item.pattern_id"
                      @click="togglePatternDisabled(item)"
                    >
                      {{ item.disabled ? "启用" : "禁用" }}
                    </UiButton>
                    <UiButton size="sm" variant="destructive" @click="deletePattern(item)">
                      删除
                    </UiButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="sortedPatternsItems.length" class="ai-history-page__pattern-cards ai-history-page__feedback-list">
          <article
            v-for="item in sortedPatternsItems"
            :key="item.pattern_id"
            class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior"
            :class="{ 'is-editing': patternEditorOpen && patternEditor.pattern_id === item.pattern_id }"
          >
            <div class="ai-history-page__feedback-top">
              <strong>{{ labelScene(item.scene) }} · {{ labelAction(item.action) }}</strong>
              <span class="muted ai-history-page__pattern-id" :title="item.pattern_id">{{ item.pattern_id }}</span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>群：{{ item.scope_group_id || "全局" }}</span>
              <span>自动分：{{ item.success_score ?? 0 }}</span>
              <span>人工分：{{ item.manual_score ?? 0 }}</span>
              <span>已禁用：{{ item.disabled ? "是" : "否" }}</span>
            </div>
            <p v-if="item.persona_affinity" class="ai-history-page__feedback-user">人设倾向：{{ item.persona_affinity }}</p>
            <p class="ai-history-page__feedback-user">触发特征：{{ item.trigger_features?.join(" / ") || "无" }}</p>
            <p class="ai-history-page__feedback-user">参考示例：{{ item.reference_examples?.join(" / ") || "无" }}</p>
            <div class="row-actions ai-history-page__pattern-actions">
              <UiButton size="sm" variant="outline" @click="openPatternEditorEdit(item)">
                编辑
              </UiButton>
              <UiButton
                size="sm"
                variant="ghost"
                :busy="patternSaveBusy && patternEditor.pattern_id === item.pattern_id"
                @click="togglePatternDisabled(item)"
              >
                {{ item.disabled ? "启用" : "禁用" }}
              </UiButton>
              <UiButton size="sm" variant="destructive" @click="deletePattern(item)">
                删除
              </UiButton>
            </div>
          </article>
        </div>
        <div v-else class="ai-empty">
          <span>{{ patternBusy ? "正在读取规则" : "当前筛选下暂无规则" }}</span>
          <span class="ai-empty__hint">在此维护基础行为规则；可与会话里的行为记录互相跳转。</span>
        </div>
      </AiHistoryPanelShell>
    </section>
    </div>

    <UiDialog
      :open="patternEditorOpen"
      :title="patternEditorMode === 'edit' ? '编辑规则' : '新建规则'"
      :subtitle="'触发特征与参考示例按行输入'"
      :busy="patternSaveBusy"
      panel-class="ai-history-page__pattern-dialog"
      @close="closePatternEditor"
    >
      <div class="ai-history-page__pattern-form">
        <label class="ai-history-page__filter">
          <span>规则 ID</span>
          <input v-model="patternEditor.pattern_id" class="inp" placeholder="例如 group-threading-001">
        </label>
        <label class="ai-history-page__filter">
          <span>场景</span>
          <select v-model="patternEditor.scene" class="inp">
            <option v-for="item in BEHAVIOR_SCENE_OPTIONS.filter((row) => row.value)" :key="`editor-scene-${item.value}`" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
        <label class="ai-history-page__filter">
          <span>动作</span>
          <select v-model="patternEditor.action" class="inp">
            <option v-for="item in BEHAVIOR_ACTION_OPTIONS" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
        <label class="ai-history-page__filter">
          <span>限定群号</span>
          <input
            :value="patternEditor.scope_group_id ?? ''"
            class="inp"
            inputmode="numeric"
            placeholder="留空表示全局"
            @input="patternEditor.scope_group_id = parseFilter(($event.target as HTMLInputElement).value)"
          >
        </label>
        <label class="ai-history-page__filter">
          <span>自动分</span>
          <input
            :value="patternEditor.success_score ?? 0"
            class="inp"
            inputmode="numeric"
            @input="patternEditor.success_score = Number(($event.target as HTMLInputElement).value || 0)"
          >
        </label>
        <label class="ai-history-page__filter">
          <span>人工分</span>
          <input
            :value="patternEditor.manual_score ?? 0"
            class="inp"
            inputmode="numeric"
            @input="patternEditor.manual_score = Number(($event.target as HTMLInputElement).value || 0)"
          >
        </label>
        <label class="ai-history-page__filter ai-history-page__pattern-form-span">
          <span>人设倾向</span>
          <input v-model="patternEditor.persona_affinity" class="inp" placeholder="可留空">
        </label>
        <label class="ai-history-page__filter ai-history-page__pattern-form-span">
          <span>触发特征</span>
          <textarea
            class="inp ai-history-page__pattern-textarea"
            :value="patternEditorTriggerText()"
            placeholder="每行一个特征"
            @input="patternEditor.trigger_features = parseLineList(($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>
        <label class="ai-history-page__filter ai-history-page__pattern-form-span">
          <span>参考示例</span>
          <textarea
            class="inp ai-history-page__pattern-textarea"
            :value="patternEditorExampleText()"
            placeholder="每行一个示例"
            @input="patternEditor.reference_examples = parseLineList(($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>
        <label class="ai-history-page__behavior-check">
          <input v-model="patternEditor.disabled" type="checkbox">
          <span>保存为已禁用</span>
        </label>
      </div>
      <template #footer>
        <div class="row-actions ai-history-page__pattern-actions">
          <UiButton size="sm" :busy="patternSaveBusy" @click="savePattern">
            {{ patternEditorMode === "edit" ? "保存修改" : "创建规则" }}
          </UiButton>
          <UiButton size="sm" variant="ghost" :disabled="patternSaveBusy" @click="closePatternEditor">
            取消
          </UiButton>
        </div>
      </template>
    </UiDialog>
    <UiDialog
      :open="replayRunDialogOpen"
      :title="replayRunDialogTitle"
      :subtitle="replayRunDialogSubtitle"
      panel-class="ai-history-page__pattern-dialog"
      @close="closeReplayRunDialog"
    >
      <div class="ai-history-page__replay-dialog">
        <p v-if="replayRunError" class="ai-history-page__replay-error">{{ replayRunError }}</p>
        <template v-else-if="replayRunResult">
          <p class="muted ai-history-page__replay-hint">用于快速核对重放回复与 Agent trace，不会改写现有历史样本。</p>
          <div v-if="replayRunSummary.length" class="ai-stat-grid ai-history-page__feedback-summary">
            <div
              v-for="item in replayRunSummary"
              :key="item.label"
              class="ai-stat ai-history-page__summary-stat"
            >
              <span class="ai-stat__label">{{ item.label }}</span>
              <strong class="ai-stat__value" :class="{ 'ai-stat__value--accent': item.accent }">{{ item.value }}</strong>
            </div>
          </div>
          <div v-if="replayPersonaShaping?.lines?.length" class="ai-history-page__replay-block">
            <div class="ai-head ai-history-page__replay-block-head">
              <h4 class="ai-head__title">牛格塑形摘要</h4>
            </div>
            <ul class="ai-history-page__persona-shaping-lines">
              <li v-for="(line, lineIndex) in replayPersonaShaping.lines" :key="`replay-shaping-${lineIndex}`">
                {{ line }}
              </li>
            </ul>
            <p v-if="replayPersonaShaping.dynamic_expression" class="ai-history-page__persona-shaping-extra">
              {{ replayPersonaShaping.dynamic_expression }}
            </p>
            <p class="muted ai-history-page__maintain-hint ai-history-page__persona-shaping-note">
              {{ replayPersonaShaping.compare_note }}
            </p>
          </div>
          <div v-if="replayRunReply || replayRunAssistantPreview" class="ai-history-page__replay-block">
            <div class="ai-head ai-history-page__replay-block-head">
              <h4 class="ai-head__title">重放回复</h4>
            </div>
            <pre class="ai-history-page__kernel-trace-json ai-history-page__kernel-trace-json--compact">{{ replayRunReply || replayRunAssistantPreview }}</pre>
          </div>
          <div v-if="replayRunTrace" class="ai-history-page__replay-block">
            <div class="ai-head ai-history-page__replay-block-head">
              <h4 class="ai-head__title">决策轨迹摘要</h4>
            </div>
            <div v-if="behaviorAgentTraceHighlights(replayRunTrace).length" class="ai-history-page__trace-highlights">
              <span
                v-for="item in behaviorAgentTraceHighlights(replayRunTrace)"
                :key="`replay-${item.label}`"
              >
                {{ item.label }}：{{ item.value }}
              </span>
            </div>
            <p v-else class="muted">本次重放未返回可展示的轨迹摘要。</p>
          </div>
          <button
            type="button"
            class="ai-history-page__turn-toggle"
            @click="replayRunRawExpanded = !replayRunRawExpanded"
          >
            {{ replayRunRawExpanded ? "收起完整结果" : "查看完整结果（高级）" }}
          </button>
          <pre
            v-if="replayRunRawExpanded"
            class="ai-history-page__kernel-trace-json"
          >{{ JSON.stringify(replayRunResult, null, 2) }}</pre>
        </template>
        <p v-else class="muted">暂无重放结果。</p>
      </div>
      <template #footer>
        <div class="row-actions ai-history-page__pattern-actions">
          <UiButton size="sm" variant="outline" :disabled="!replayRunResult" @click="copyReplayRunResult">
            复制完整结果
          </UiButton>
          <UiButton size="sm" variant="ghost" @click="closeReplayRunDialog">
            关闭
          </UiButton>
        </div>
      </template>
    </UiDialog>
  </div>
</template>

<style scoped>
.ai-history-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
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
  gap: 16px;
}

.ai-history-page__panel {
  padding: 16px;
  background: color-mix(in srgb, var(--bg-card) 95%, transparent);
  border: none;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
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
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
}

.ai-history-page__learning-strip.is-warn {
  border-color: color-mix(in srgb, #f59e0b 35%, var(--border));
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

.ai-history-page__observe-panel-toggle:deep(.ui-btn) {
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
  font-weight: 650;
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
  padding: 16px 16px 14px;
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
.ai-history-page__behavior-action-btn:deep(.ui-btn) {
  min-height: var(--ui-ctrl-height);
  height: var(--ui-ctrl-height);
}

.ai-history-page__behavior-action-btn:deep(.ui-btn) {
  padding-inline: 14px;
}

.ai-history-page__filters-card {
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 2.5%, transparent);
}

.ai-history-page__filters-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 0.8125rem;
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

.ai-history-page__filter .inp {
  width: 96px;
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
  font-weight: 650;
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
  font-weight: 650;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 12px;
}

.ai-history-page__pattern-form-span {
  grid-column: 1 / -1;
}

.ai-history-page__pattern-textarea {
  min-height: 96px;
  width: 100%;
  resize: vertical;
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
  font-weight: 650;
  color: color-mix(in srgb, var(--text) 88%, var(--text-muted));
}

.ai-history-page__correction-textarea {
  min-height: 72px;
  color: var(--text);
  background: color-mix(in srgb, var(--bg-card, var(--surface)) 92%, var(--text) 4%);
  border-color: color-mix(in srgb, var(--text) 18%, var(--border));
  border-radius: var(--radius-sm, 8px);
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

  .ai-history-page__observe-panel-hd--persona .ai-history-page__observe-panel-toggle:deep(.ui-btn) {
    grid-column: 1 / -1;
    width: 100%;
  }

  .ai-history-page__observe-panel-toggle:deep(.ui-btn) {
    width: 100%;
  }

  .ai-history-page__filters-head {
    display: grid;
    gap: 4px;
  }

  .ai-history-page__filter .inp {
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

  .ai-history-page__detail-trace-toggle {
    grid-column: 1 / -1;
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

  .ai-history-page__maintain-actions,
  .ai-history-page__feedback-card-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
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
    display: grid;
    grid-template-columns: minmax(0, 1fr);
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
  margin-bottom: 4px;
  padding: 4px 2px 8px;
}

.ai-history-page__workspace-hero .plugin-config-page__hero-title {
  margin: 0;
  font-size: 1.15rem;
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
