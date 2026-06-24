<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
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
  postConversationKernelMemoryDelete,
  postConversationKernelRelationshipNoteDelete,
  postLlmRuntimeReplayRun,
  postLlmPromotionCandidateResolve,
  postLlmBehaviorPatternDelete,
  postLlmBehaviorPatternUpsert,
  postLlmHistoryBehaviorAnnotate,
} from "@/api/consoleApi";
import type {
  LlmBehaviorPattern,
  LlmHistoryBehaviorAgentTrace,
  LlmHistoryBehaviorRun,
  LlmHistoryBehaviorAutoFeedbackPayload,
  LlmRuntimeReplayResult,
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
import AiDailyTrendChart from "@/components/ai-config/stats/AiDailyTrendChart.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import { AI_ASSISTANT_NAME, AI_STATS_LIMITS } from "@/config/aiConstants";
import { useAiTaskStatsPage } from "@/composables/useAiTaskStatsPage";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { copyTextToClipboard } from "@/utils/clipboard";
import { pushConsoleToast } from "@/utils/consoleToast";
import { formatCompactDateTime } from "@/utils/formatDateTime";
import { deriveFeedbackGroupFromSession } from "@/utils/llmRepeaterFeedbackLink";

const panelNavIcon = usePanelNavIcon();
const {
  loading,
  err,
  month,
  start,
  end,
  historyDailyRows,
  routeRowsTop,
  historyRouteHeatPoints,
  persistenceHint,
  refresh,
  resetMonthRange,
} = useAiTaskStatsPage();

const sessions = ref<LlmHistorySessionSummary[]>([]);
const selectedSessionKey = ref("");
const sessionDetail = ref<LlmHistorySessionDetailData | null>(null);
const historyBusy = ref(false);
const historyErr = ref("");
const feedbackBusy = ref(false);
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
type ObservePanelKey = "feedback" | "promotion" | "behavior";
const observePanelExpanded = ref<Record<ObservePanelKey, boolean>>({
  feedback: true,
  promotion: false,
  behavior: false,
});
const patternSortKey = ref<"success_score" | "manual_score" | "pattern_id">("success_score");

type AiHistoryWorkspace = "sessions" | "observe" | "rules" | "memory" | "stats";
const WORKSPACE_TABS = [
  { label: "会话", value: "sessions" as const },
  { label: "观测", value: "observe" as const },
  { label: "规则", value: "rules" as const },
  { label: "记忆", value: "memory" as const },
  { label: "统计", value: "stats" as const },
];
const activeWorkspace = ref<AiHistoryWorkspace>("sessions");

// 会话筛选：bot / group / user（空 = 不限）
const filterBot = ref("");
const filterGroup = ref("");
const filterUser = ref("");
const expandedTurnKeys = ref<Record<string, boolean>>({});
const showAllDailyRows = ref(false);
const showAllSessions = ref(false);
const behaviorBusy = ref<Record<string, boolean>>({});

const BEHAVIOR_LABEL_OPTIONS = ["像人", "模板感强", "姿态不对", "带偏话题", "作为参考保留"] as const;
const BEHAVIOR_SCENE_OPTIONS = [
  { label: "全部场景", value: "" },
  { label: "provocation", value: "provocation" },
  { label: "banter", value: "banter" },
  { label: "smalltalk", value: "smalltalk" },
  { label: "venting", value: "venting" },
  { label: "group_threading", value: "group_threading" },
  { label: "light_help", value: "light_help" },
] as const;
const BEHAVIOR_ACTION_OPTIONS = [
  { label: "light_tease_and_close", value: "light_tease_and_close" },
  { label: "ack_then_short_reply", value: "ack_then_short_reply" },
  { label: "follow_joke_once", value: "follow_joke_once" },
  { label: "ack_emotion_no_lecture", value: "ack_emotion_no_lecture" },
  { label: "stay_on_current_topic", value: "stay_on_current_topic" },
  { label: "avoid_forced_topic_shift", value: "avoid_forced_topic_shift" },
  { label: "brief_multi_party_anchor", value: "brief_multi_party_anchor" },
  { label: "short_help_then_stop", value: "short_help_then_stop" },
] as const;
const BEHAVIOR_OUTCOME_OPTIONS = [
  { label: "未判定", value: "" },
  { label: "接住了", value: "engaged" },
  { label: "一般", value: "neutral" },
  { label: "被无视", value: "ignored" },
  { label: "很尬", value: "awkward" },
  { label: "带偏了", value: "derailed" },
] as const;

function parseFilter(raw: string): number | null {
  const n = Number(raw.trim());
  return raw.trim() && Number.isFinite(n) ? n : null;
}

const combinedErr = computed(() => err.value || historyErr.value);
const anyBusy = computed(() => loading.value || historyBusy.value);
const feedbackGroupId = computed(() => parseFilter(feedbackGroup.value));
const observeGroupId = computed(() => parseFilter(observeGroup.value));
const memoryBotId = computed(() => parseFilter(memoryBot.value));
const memoryGroupId = computed(() => parseFilter(memoryGroup.value));
const behaviorRunsGroupId = computed(() => parseFilter(behaviorRunsGroup.value));
const patternsGroupId = computed(() => parseFilter(patternsGroup.value));
const historySummary = computed(() => [
  {
    label: "每日快照",
    value: String(historyDailyRows.value.length),
    accent: true,
  },
  {
    label: "最近会话",
    value: String(sessions.value.length),
  },
  {
    label: "当前选中",
    value: selectedSession.value ? (selectedSession.value.group_id === 0 ? "私聊会话" : `群 ${selectedSession.value.group_id}`) : "未选择",
  },
  {
    label: "回复路径",
    value: routeRowsTop.value.length ? `${routeRowsTop.value.length} 种` : "暂无",
  },
]);
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
    value: behaviorRunsOutcome.value || "全部",
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
    value: patternsScene.value || "全部",
  },
]);

function kernelFlagLabel(active: boolean): string {
  return active ? "已生效" : "未生效";
}

const kernelStatusOverview = computed(() => {
  const status = kernelStatus.value;
  if (!status) return [];
  return [
    { label: "功能层级", value: status.feature_level, accent: true },
    { label: "llm_chat", value: status.llm_chat_enabled ? "开" : "关" },
    { label: "反哺收集", value: kernelFlagLabel(status.feedback_collect_active), accent: status.feedback_collect_active },
    { label: "反哺加权", value: kernelFlagLabel(status.feedback_bias_active), accent: status.feedback_bias_active },
    { label: "写回晋升", value: kernelFlagLabel(status.writeback_active), accent: status.writeback_active },
    {
      label: "会话摘要",
      value: kernelFlagLabel(Boolean(status.runtime_state_summary_active)),
      accent: Boolean(status.runtime_state_summary_active),
    },
    { label: "最近 trace", value: String(kernelTraces.value.length), accent: kernelTraces.value.length > 0 },
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
    `read_session=${readSession ? "是" : "否"}`,
    `read_persistent=${readPersistent ? "是" : "否"}`,
    `read_group_style=${policy.read_group_style ? "是" : "否"}`,
    `read_affect=${readAffect ? "是" : "否"}`,
    `write_session=${writeSession ? "是" : "否"}`,
  ];
  return `repeater ${status.llm_repeater_mode || "—"} · memory ${flags.join(" / ")}`;
}

function kernelTraceKey(row: ConversationKernelTraceRow, index: number): string {
  return `${row.group_id ?? 0}-${row.bot_id ?? 0}-${row.created_at ?? index}-${row.action ?? ""}`;
}

function kernelTraceSummary(row: ConversationKernelTraceRow): string {
  const parts: string[] = [];
  const action = String(row.action || "").trim();
  if (action) parts.push(action.replace(/_/g, " "));
  const scene = String(row.scene || "").trim();
  if (scene) parts.push(scene);
  const path = String(row.path || "").trim();
  if (path) parts.push(path.replace(/_/g, " "));
  return parts.join(" · ") || "conversation_decision_trace";
}

function kernelTraceHighlights(row: ConversationKernelTraceRow): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = [];
  const mode = String(row.mode || "").trim();
  const reason = String(row.trace_reason || "").trim();
  const confidence = row.confidence;
  const stages = Array.isArray(row.generation_stages)
    ? row.generation_stages.map((item) => String(item)).filter(Boolean)
    : [];
  if (mode) items.push({ label: "mode", value: mode });
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
  return [
    { label: "执行模式", value: result.mode || "mock_tools", accent: true },
    { label: "任务", value: result.task || "llm_chat" },
    { label: "请求快照", value: result.request_snapshot_id || "无" },
    {
      label: "工具调用",
      value: typeof replayRunTrace.value?.tool_call_count === "number" ? String(replayRunTrace.value.tool_call_count) : "0",
    },
  ];
});

async function copyReplayPayload(requestId: string) {
  const key = requestId.trim();
  if (!key || replayCopyBusy.value[key]) return;
  replayCopyBusy.value = { ...replayCopyBusy.value, [key]: true };
  try {
    const payload = await fetchLlmRuntimeReplay(key);
    const ok = await copyTextToClipboard(JSON.stringify(payload, null, 2));
    pushConsoleToast(ok ? `已复制 Replay Payload：${key}` : "复制 Replay Payload 失败", ok ? "ok" : "err");
  } catch {
    pushConsoleToast("复制 Replay Payload 失败", "err");
  } finally {
    replayCopyBusy.value = { ...replayCopyBusy.value, [key]: false };
  }
}

function closeReplayRunDialog() {
  replayRunDialogOpen.value = false;
  replayRunRawExpanded.value = false;
}

async function copyReplayRunResult() {
  if (!replayRunResult.value) return;
  const ok = await copyTextToClipboard(JSON.stringify(replayRunResult.value, null, 2));
  pushConsoleToast(ok ? "已复制 Replay 结果" : "复制 Replay 结果失败", ok ? "ok" : "err");
}

async function runReplay(requestId: string) {
  const key = requestId.trim();
  if (!key || replayRunBusy.value[key]) return;
  replayRunBusy.value = { ...replayRunBusy.value, [key]: true };
  replayRunDialogTitle.value = `Replay 结果 · ${key}`;
  replayRunDialogSubtitle.value = "mock_tools";
  replayRunResult.value = null;
  replayRunError.value = "";
  replayRunRawExpanded.value = false;
  try {
    const result = await postLlmRuntimeReplayRun(key);
    replayRunDialogSubtitle.value = `${result.mode || "mock_tools"} · ${result.task || "llm_chat"}`;
    replayRunResult.value = result;
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
  observe: pendingPromotionCandidates.value.length > 0
    ? pendingPromotionCandidates.value.length
    : behaviorRunsItems.value.length,
  rules: patternsItems.value.length,
  memory: memoryEntries.value.length + relationshipNotes.value.length,
  stats: historyDailyRows.value.length,
}));
const workspaceContextLabel = computed(() => {
  const session = selectedSession.value;
  if (!session) return "";
  return session.group_id === 0
    ? `私聊 · 用户 ${session.user_id} · Bot ${session.bot_id}`
    : `群 ${session.group_id} · 用户 ${session.user_id} · Bot ${session.bot_id}`;
});
const feedbackOverview = computed(() => [
  {
    label: "样本数",
    value: feedbackSummary.value ? String(feedbackSummary.value.count) : "—",
    accent: true,
  },
  {
    label: "待晋升",
    value: feedbackSummary.value?.promotion_candidate_count != null
      ? String(feedbackSummary.value.promotion_candidate_count)
      : "—",
    accent: Boolean(feedbackSummary.value?.promotion_candidate_count),
  },
  {
    label: "高频回复",
    value: feedbackSummary.value?.top_replies?.length ? feedbackSummary.value.top_replies.slice(0, 2).join(" / ") : "暂无",
  },
  {
    label: "场景",
    value: feedbackSummary.value?.scenes?.length ? feedbackSummary.value.scenes.slice(0, 2).join(" / ") : "暂无",
  },
]);

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
  if (!count) return observeScene.value ? "当前场景下暂无样本" : "当前群暂无样本";
  return `样本 ${count}${pending ? ` · 待晋升 ${pending}` : ""}`;
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
  const scene = behaviorRunsScene.value || "全部场景";
  const outcome = behaviorRunsOutcome.value;
  const outcomeLabel = outcome
    ? BEHAVIOR_OUTCOME_OPTIONS.find((item) => item.value === outcome)?.label || outcome
    : "";
  return `${count} 条 · ${group} · ${scene}${outcomeLabel ? ` · ${outcomeLabel}` : ""}`;
});

function isObservePanelExpanded(key: ObservePanelKey): boolean {
  return observePanelExpanded.value[key];
}

function toggleObservePanel(key: ObservePanelKey): void {
  observePanelExpanded.value = {
    ...observePanelExpanded.value,
    [key]: !observePanelExpanded.value[key],
  };
}

function promotionCandidateStatusLabel(item: LlmPromotionCandidate): string {
  if (item.promoted) return "已晋升";
  if (String(item.rejected_reason || "").trim()) return "已拒绝";
  return "待审批";
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

const visibleDailyRows = computed(() =>
  showAllDailyRows.value ? historyDailyRows.value : historyDailyRows.value.slice(0, 7),
);

const visibleSessions = computed(() =>
  showAllSessions.value ? sessions.value : sessions.value.slice(0, 8),
);

const dailySubmitPoints = computed(() =>
  historyDailyRows.value.map((row) => ({ date: row.date, value: row.botSubmit })),
);

const dailyCallbackPoints = computed(() =>
  historyDailyRows.value.map((row) => ({ date: row.date, value: row.botCallback })),
);

const dailySuccessPoints = computed(() =>
  historyDailyRows.value.map((row) => ({ date: row.date, value: row.aiOk })),
);

const dailyFailPoints = computed(() =>
  historyDailyRows.value.map((row) => ({ date: row.date, value: row.aiFail })),
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
  const hit = BEHAVIOR_OUTCOME_OPTIONS.find((item) => item.value === (outcome || ""));
  return hit?.label || outcome || "未判定";
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
  precedingUserText: string;
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

const sessionTurnRows = computed(() => {
  const detail = sessionDetail.value;
  if (!detail) {
    return { rows: [] as SessionTurnRow[], orphanRuns: [] as LlmHistoryBehaviorRun[] };
  }
  const runs = [...(detail.behavior_runs || [])];
  const consumed = new Set<string>();
  let lastUserText = "";
  const rows: SessionTurnRow[] = [];
  for (let index = 0; index < detail.turns.length; index += 1) {
    const turn = detail.turns[index];
    if (turn.role === "user") {
      lastUserText = turn.content;
      rows.push({ turn, index, behaviorRun: null, precedingUserText: "" });
      continue;
    }
    const behaviorRun = matchBehaviorRunForAssistantTurn(turn, lastUserText, runs, consumed);
    rows.push({ turn, index, behaviorRun, precedingUserText: lastUserText });
  }
  const orphanRuns = runs.filter((run) => !consumed.has(run.request_id));
  return { rows, orphanRuns };
});

const expandedSessionBehaviorIds = ref<Record<string, boolean>>({});

function isSessionBehaviorExpanded(requestId: string): boolean {
  return !!expandedSessionBehaviorIds.value[requestId];
}

function toggleSessionBehaviorExpanded(requestId: string): void {
  expandedSessionBehaviorIds.value = {
    ...expandedSessionBehaviorIds.value,
    [requestId]: !expandedSessionBehaviorIds.value[requestId],
  };
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

function openObserveWorkspace(groupId?: number | null) {
  activeWorkspace.value = "observe";
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
    return;
  }
  historyBusy.value = true;
  historyErr.value = "";
  try {
    sessionDetail.value = await fetchLlmHistorySession({
      botId: summary.bot_id,
      groupId: summary.group_id,
      userId: summary.user_id,
      limit: AI_STATS_LIMITS.historyTurns,
    });
  } catch (e) {
    sessionDetail.value = null;
    historyErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    historyBusy.value = false;
  }
}

async function refreshAll() {
  await Promise.all([refresh(), refreshSessions()]);
}

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
    ? `批准将「${candidate.reply_text}」标记为晋升候选？\n（语料实际写回尚未接通，仅记录审批结果）`
    : `拒绝候选「${candidate.reply_text}」？`;
  if (!confirm(prompt)) return;
  promotionResolveBusyId.value = candidate.candidate_id;
  promotionCandidatesErr.value = "";
  try {
    await postLlmPromotionCandidateResolve({
      candidateId: candidate.candidate_id,
      action,
      reason: action === "reject" ? "webui_reject" : "",
    });
    await Promise.all([refreshPromotionCandidates(), refreshFeedback()]);
  } catch (e) {
    promotionCandidatesErr.value = e instanceof Error ? e.message : String(e);
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
    patternErr.value = "pattern_id 不能为空";
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
  const ok = window.confirm(`确定删除 pattern ${item.pattern_id}？此操作不可恢复。`);
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

watch(month, () => {
  resetMonthRange();
  showAllDailyRows.value = false;
  void refresh();
});

watch([start, end], () => {
  showAllDailyRows.value = false;
  void refresh();
});

watch(pendingPromotionCandidates, (items) => {
  if (items.length > 0) {
    observePanelExpanded.value = { ...observePanelExpanded.value, promotion: true };
  }
});

watch(selectedSessionKey, () => {
  expandedTurnKeys.value = {};
  expandedSessionBehaviorIds.value = {};
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
  resetMonthRange();
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
  <div class="console-hub-page ai-surface ai-history-page">
    <ConsoleHubMasthead :icon="panelNavIcon">
      <template #title>
        AI 历史
      </template>
      <template #lead>
        按工作区浏览：会话对话、观测反馈、规则维护与统计趋势；选中会话后会自动同步群号到观测与规则筛选。
      </template>
      <template #actions>
        <label class="ai-date-field">
          <span>月份</span>
          <input v-model="month" class="inp" type="month">
        </label>
        <label class="ai-date-field">
          <span>起始</span>
          <input v-model="start" class="inp" type="date">
        </label>
        <label class="ai-date-field">
          <span>结束</span>
          <input v-model="end" class="inp" type="date">
        </label>
        <UiButton variant="primary" :busy="anyBusy" @click="refreshAll">刷新</UiButton>
      </template>
      <template #extra>
        <p class="muted ai-history-page__hint">{{ persistenceHint }}</p>
      </template>
    </ConsoleHubMasthead>

    <div v-if="combinedErr" class="alert alert--err">{{ combinedErr }}</div>

    <nav class="ai-history-page__workspace-tabs" aria-label="AI 历史工作区">
      <div class="console-view-toggle" role="tablist">
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

    <div
      v-if="workspaceContextLabel"
      class="ai-history-page__context-strip"
    >
      <span class="muted">当前会话</span>
      <strong>{{ workspaceContextLabel }}</strong>
      <div class="row-actions ai-history-page__context-actions">
        <UiButton
          size="sm"
          variant="ghost"
          @click="activeWorkspace = 'sessions'"
        >
          会话
        </UiButton>
        <UiButton
          size="sm"
          variant="outline"
          @click="openObserveWorkspace(selectedSession?.group_id || null)"
        >
          观测此群
        </UiButton>
        <UiButton
          size="sm"
          variant="ghost"
          @click="activeWorkspace = 'rules'"
        >
          规则
        </UiButton>
      </div>
    </div>

    <div v-show="activeWorkspace === 'stats'" class="ai-history-page__workspace">
    <section class="ai-history-page__summary">
      <UiCard class="ai-history-page__panel ai-history-page__summary-card">
        <div class="ai-head">
          <h3 class="ai-head__title">历史摘要</h3>
          <span class="ai-head__hint">先看当前时间窗内有多少快照、会话和路径数据</span>
        </div>
        <div class="ai-stat-grid ai-history-page__summary-stats">
          <div
            v-for="item in historySummary"
            :key="item.label"
            class="ai-stat ai-history-page__summary-stat"
          >
            <span class="ai-stat__label">{{ item.label }}</span>
            <strong class="ai-stat__value" :class="{ 'ai-stat__value--accent': item.accent }">{{ item.value }}</strong>
          </div>
        </div>
      </UiCard>
    </section>

    <section class="ai-history-page__overview">
      <UiCard class="ai-history-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">每日完成任务</h3>
          <span class="ai-head__hint">成功、失败与热点强度一起看</span>
        </div>
        <AiDailyTrendChart
          :series="[
            {
              id: 'done',
              label: 'AI 完成',
              color: 'var(--accent)',
              unit: '次',
              points: historyDailyRows.map((row) => ({ date: row.date, value: row.aiOk + row.aiFail })),
            },
            {
              id: 'routes',
              label: '路径热点',
              color: '#22c55e',
              unit: '次',
              points: historyRouteHeatPoints,
            },
          ]"
          :summary="[
            `完成任务 ${historyDailyRows.reduce((sum, row) => sum + row.aiOk + row.aiFail, 0).toLocaleString()} 次`,
            `路径命中 ${historyRouteHeatPoints.reduce((sum, row) => sum + row.value, 0).toLocaleString()} 次`,
          ]"
          empty-text="当前时间窗暂无历史快照。"
        />
      </UiCard>
    </section>

    <UiCard class="ai-history-page__panel">
      <div class="ai-head">
        <h3 class="ai-head__title">按日趋势</h3>
        <span class="ai-head__hint">先看提交、回调、成功、失败的日波动</span>
      </div>
      <AiDailyTrendChart
        :series="[
          { id: 'submit', label: 'Bot 提交', color: '#38bdf8', unit: '次', points: dailySubmitPoints },
          { id: 'callback', label: 'Bot 回调', color: '#22c55e', unit: '次', points: dailyCallbackPoints },
          { id: 'success', label: 'AI 成功', color: 'var(--accent)', unit: '次', points: dailySuccessPoints },
          { id: 'fail', label: 'AI 失败', color: '#fb7185', unit: '次', points: dailyFailPoints },
        ]"
        :summary="[
          `Bot 提交 ${dailySubmitPoints.reduce((sum, row) => sum + row.value, 0).toLocaleString()} 次`,
          `Bot 回调 ${dailyCallbackPoints.reduce((sum, row) => sum + row.value, 0).toLocaleString()} 次`,
          `AI 成功 ${dailySuccessPoints.reduce((sum, row) => sum + row.value, 0).toLocaleString()} 次`,
          `AI 失败 ${dailyFailPoints.reduce((sum, row) => sum + row.value, 0).toLocaleString()} 次`,
        ]"
        empty-text="当前时间窗内没有 AI 历史快照。"
      />
      <div v-if="historyDailyRows.length" class="ai-history-page__daily-section">
        <div class="ai-head ai-history-page__daily-subhead">
          <h4 class="ai-head__title">最近快照明细</h4>
          <span class="ai-head__hint">仅保留最近几天，主要用于对照具体数值</span>
        </div>
        <div class="ai-history-page__daily-list">
        <article v-for="row in visibleDailyRows" :key="row.date" class="ai-history-page__daily-card">
          <div class="ai-history-page__daily-head">
            <strong>{{ row.date }}</strong>
            <span class="muted">路径 {{ row.routes.length }} 种</span>
          </div>
          <div class="ai-history-page__daily-stats">
            <span class="ai-history-page__daily-stat">
              <span class="ai-history-page__daily-label">Bot 提交</span>
              <strong>{{ row.botSubmit.toLocaleString() }}</strong>
            </span>
            <span class="ai-history-page__daily-stat">
              <span class="ai-history-page__daily-label">Bot 回调</span>
              <strong>{{ row.botCallback.toLocaleString() }}</strong>
            </span>
            <span class="ai-history-page__daily-stat">
              <span class="ai-history-page__daily-label">AI 成功</span>
              <strong>{{ row.aiOk.toLocaleString() }}</strong>
            </span>
            <span class="ai-history-page__daily-stat">
              <span class="ai-history-page__daily-label">AI 失败</span>
              <strong>{{ row.aiFail.toLocaleString() }}</strong>
            </span>
          </div>
          <div class="ai-history-page__daily-foot">
            <span>排队 {{ row.queued.toLocaleString() }} / 运行 {{ row.running.toLocaleString() }}</span>
            <span class="ai-history-page__daily-routes">
              {{ row.routes.map((item) => `${item.key} ${item.count}`).join(" · ") || "—" }}
            </span>
          </div>
        </article>
        <button
          v-if="historyDailyRows.length > visibleDailyRows.length"
          type="button"
          class="ai-history-page__more"
          @click="showAllDailyRows = true"
        >
          展开其余 {{ historyDailyRows.length - visibleDailyRows.length }} 天
        </button>
        <button
          v-else-if="historyDailyRows.length > 7"
          type="button"
          class="ai-history-page__more"
          @click="showAllDailyRows = false"
        >
          收起到最近 7 天
        </button>
        </div>
      </div>
    </UiCard>
    </div>

    <div v-show="activeWorkspace === 'sessions'" class="ai-history-page__workspace ai-history-page__workspace--sessions">
    <section class="ai-history-page__sessions">
      <UiCard class="ai-history-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">最近会话</h3>
          <span class="ai-head__hint">按最后消息时间排序</span>
        </div>
        <div class="ai-history-page__filters-card">
          <div class="ai-history-page__filters-head">
            <strong>会话筛选</strong>
            <span class="muted">留空表示不过滤</span>
          </div>
          <div class="ai-history-page__filters ai-history-page__filters--aligned">
            <label class="ai-history-page__filter">
              <span>Bot</span>
              <input v-model="filterBot" class="inp" inputmode="numeric" placeholder="全部" @keyup.enter="refreshSessions">
            </label>
            <label class="ai-history-page__filter">
              <span>群号</span>
              <input v-model="filterGroup" class="inp" inputmode="numeric" placeholder="全部" @keyup.enter="refreshSessions">
            </label>
            <label class="ai-history-page__filter">
              <span>用户</span>
              <input v-model="filterUser" class="inp" inputmode="numeric" placeholder="全部" @keyup.enter="refreshSessions">
            </label>
            <div class="ai-history-page__filter-action">
              <UiButton size="sm" variant="outline" :busy="historyBusy" @click="refreshSessions">筛选</UiButton>
            </div>
          </div>
        </div>
        <div v-if="sessions.length" class="ai-history-page__session-list ai-history-page__session-list--scroll">
          <button
            v-for="item in visibleSessions"
            :key="item.session_key"
            type="button"
            class="ai-history-page__session"
            :class="{ 'is-on': selectedSessionKey === item.session_key }"
            @click="selectedSessionKey = item.session_key"
          >
            <div class="ai-history-page__session-top">
              <strong>{{ item.group_id === 0 ? `私聊 ${item.user_id}` : `群 ${item.group_id} · 用户 ${item.user_id}` }}</strong>
              <span class="ai-history-page__session-role">{{ item.last_role === "assistant" ? "Bot" : "用户" }}</span>
              <span class="muted ai-history-page__session-time">{{ formatCompactDateTime(item.last_created_at) }}</span>
            </div>
            <div class="muted ai-history-page__session-meta">Bot {{ item.bot_id }} · {{ item.turn_count }} 条对话</div>
            <p class="ai-history-page__session-preview">{{ item.last_content || "（空消息）" }}</p>
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
      </UiCard>

      <div ref="sessionDetailAnchor" class="ai-history-page__detail-anchor">
      <UiCard class="ai-history-page__panel ai-history-page__detail-panel">
        <div class="ai-head">
          <h3 class="ai-head__title">会话明细</h3>
          <span class="ai-head__hint">{{ sessionDetail ? workspaceContextLabel || "当前选中会话" : "选择左侧会话查看" }}</span>
        </div>
        <div v-if="sessionDetail" class="ai-history-page__detail">
          <div class="ai-history-page__detail-summary">
            <span>Bot {{ sessionDetail.session.bot_id }}</span>
            <span>{{ sessionDetail.session.group_id === 0 ? "私聊" : `群 ${sessionDetail.session.group_id}` }}</span>
            <span>用户 {{ sessionDetail.session.user_id }}</span>
            <span>{{ sessionDetail.session.turn_count }} 条对话</span>
            <span v-if="sessionDetail.behavior_runs?.length">{{ sessionDetail.behavior_runs.length }} 条 behavior</span>
            <div v-if="sessionDetail.behavior_runs?.length" class="row-actions ai-history-page__detail-actions">
              <UiButton
                size="sm"
                variant="outline"
                @click="openObserveWorkspace(sessionDetail.session.group_id || null)"
              >
                打开观测
              </UiButton>
              <UiButton
                size="sm"
                variant="ghost"
                @click="activeWorkspace = 'rules'"
              >
                管理规则
              </UiButton>
            </div>
          </div>
          <div class="ai-history-page__thread">
            <article
              v-for="row in sessionTurnRows.rows"
              :key="turnKey(row.turn.created_at, row.index)"
              class="ai-history-page__turn"
              :class="row.turn.role === 'assistant' ? 'is-assistant' : 'is-user'"
            >
              <div class="ai-history-page__turn-head">
                <strong>{{ row.turn.role === "assistant" ? AI_ASSISTANT_NAME : `用户 ${row.turn.user_id}` }}</strong>
                <span class="muted">{{ formatCompactDateTime(row.turn.created_at) }}</span>
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
              <div v-if="row.behaviorRun" class="ai-history-page__turn-behavior">
                <div class="ai-history-page__turn-behavior-bar">
                  <span class="ai-history-page__turn-behavior-tag">Behavior</span>
                  <strong>{{ row.behaviorRun.scene }}</strong>
                  <span
                    class="ai-history-page__outcome-badge"
                    :class="outcomeClass(row.behaviorRun.final_outcome)"
                  >
                    {{ formatOutcomeLabel(row.behaviorRun.final_outcome) }}
                  </span>
                  <span class="muted ai-history-page__turn-behavior-actions">
                    动作：{{ row.behaviorRun.selected_actions.join(" / ") || "未选" }}
                  </span>
                  <button
                    type="button"
                    class="ai-history-page__turn-toggle ai-history-page__turn-behavior-toggle"
                    @click="toggleSessionBehaviorExpanded(row.behaviorRun.request_id)"
                  >
                    {{ isSessionBehaviorExpanded(row.behaviorRun.request_id) ? "收起校正" : "校正这条回复" }}
                  </button>
                </div>
                <div
                  v-if="isSessionBehaviorExpanded(row.behaviorRun.request_id)"
                  class="ai-history-page__turn-behavior-body"
                >
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
                        {{ expandedBehaviorTraceKeys[behaviorAgentTraceKey('session', row.behaviorRun.request_id)] ? "收起 Agent Trace" : "查看 Agent Trace" }}
                      </button>
                      <button
                        type="button"
                        class="ai-history-page__turn-toggle"
                        :disabled="replayRunBusy[row.behaviorRun.request_id]"
                        @click="runReplay(row.behaviorRun.request_id)"
                      >
                        {{ replayRunBusy[row.behaviorRun.request_id] ? "Replay 中…" : "执行 Replay" }}
                      </button>
                      <button
                        type="button"
                        class="ai-history-page__turn-toggle"
                        :disabled="replayCopyBusy[row.behaviorRun.request_id]"
                        @click="copyReplayPayload(row.behaviorRun.request_id)"
                      >
                        复制 Replay Payload
                      </button>
                    </div>
                  </template>
                  <p v-if="row.behaviorRun.behavior_hint_text" class="ai-history-page__behavior-hint">
                    {{ row.behaviorRun.behavior_hint_text }}
                  </p>
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
                      <span>结果</span>
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
                </div>
              </div>
            </article>
          </div>
          <section v-if="sessionTurnRows.orphanRuns.length" class="ai-history-page__orphan-behavior">
            <div class="ai-head ai-history-page__orphan-behavior-head">
              <h4 class="ai-head__title">未对齐的 Behavior</h4>
              <span class="ai-head__hint">无法自动匹配到某条 Bot 回复，仍可在此校正</span>
            </div>
            <article
              v-for="run in sessionTurnRows.orphanRuns"
              :key="run.request_id"
              class="ai-history-page__behavior-card"
            >
              <div class="ai-history-page__behavior-top">
                <strong>{{ run.scene }}</strong>
                <span
                  class="ai-history-page__outcome-badge"
                  :class="outcomeClass(run.final_outcome)"
                >
                  {{ formatOutcomeLabel(run.final_outcome) }}
                </span>
              </div>
              <div class="ai-history-page__behavior-meta">
                <span>动作：{{ run.selected_actions.join(" / ") || "未选" }}</span>
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
                    {{ expandedBehaviorTraceKeys[behaviorAgentTraceKey('orphan', run.request_id)] ? "收起 Agent Trace" : "查看 Agent Trace" }}
                  </button>
                  <button
                    type="button"
                    class="ai-history-page__turn-toggle"
                    :disabled="replayRunBusy[run.request_id]"
                    @click="runReplay(run.request_id)"
                  >
                    {{ replayRunBusy[run.request_id] ? "Replay 中…" : "执行 Replay" }}
                  </button>
                  <button
                    type="button"
                    class="ai-history-page__turn-toggle"
                    :disabled="replayCopyBusy[run.request_id]"
                    @click="copyReplayPayload(run.request_id)"
                  >
                    复制 Replay Payload
                  </button>
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
      </UiCard>
      </div>
    </section>
    </div>

    <div v-show="activeWorkspace === 'observe'" class="ai-history-page__workspace ai-history-page__workspace--observe">
    <UiCard class="ai-history-page__panel ai-history-page__observe-toolbar">
      <div class="ai-history-page__filters-head">
        <strong>观测筛选</strong>
        <span class="muted">群号会同时作用于决策 trace、反馈样本与 behavior 记录</span>
      </div>
      <div class="ai-history-page__filters ai-history-page__filters--aligned">
        <label class="ai-history-page__filter">
          <span>群号</span>
          <input
            v-model="observeGroup"
            class="inp"
            inputmode="numeric"
            placeholder="全部 / 必填反馈"
            @input="observeGroupTouched = true; feedbackGroup = observeGroup; behaviorRunsGroup = observeGroup; feedbackGroupTouched = true; behaviorRunsGroupTouched = true"
            @keyup.enter="refreshObservePanels"
          >
        </label>
        <label class="ai-history-page__filter">
          <span>场景</span>
          <select
            v-model="observeScene"
            class="inp"
            @change="behaviorRunsScene = observeScene; refreshBehaviorRuns()"
          >
            <option v-for="item in BEHAVIOR_SCENE_OPTIONS" :key="`observe-scene-${item.value || 'empty'}`" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
        <div class="ai-history-page__filter-action">
          <UiButton
            size="sm"
            variant="primary"
            :busy="kernelStatusBusy || kernelTracesBusy || feedbackBusy || promotionCandidatesBusy || behaviorRunsBusy"
            @click="refreshObservePanels"
          >
            刷新观测
          </UiButton>
        </div>
      </div>
    </UiCard>
    <section class="ai-history-page__feedback ai-history-page__kernel-panel">
      <UiCard class="ai-history-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">对话决策 Kernel</h3>
          <span class="ai-head__hint">运行态、memory 策略与最近决策 trace</span>
        </div>
        <div v-if="kernelStatusErr" class="alert alert--err">{{ kernelStatusErr }}</div>
        <div v-if="kernelTracesErr" class="alert alert--err">{{ kernelTracesErr }}</div>
        <div class="ai-stat-grid ai-history-page__feedback-summary">
          <div
            v-for="item in kernelStatusOverview"
            :key="item.label"
            class="ai-stat ai-history-page__summary-stat"
          >
            <span class="ai-stat__label">{{ item.label }}</span>
            <strong class="ai-stat__value" :class="{ 'ai-stat__value--accent': item.accent }">{{ item.value }}</strong>
          </div>
          <div class="ai-stat ai-history-page__summary-stat">
            <span class="ai-stat__label">筛选群号</span>
            <strong class="ai-stat__value">{{ observeGroupId ? String(observeGroupId) : "全部" }}</strong>
          </div>
        </div>
        <p v-if="kernelStatus && !kernelStatusBusy" class="muted ai-history-page__kernel-policy">
          {{ kernelMemoryPolicyLine(kernelStatus) }}
        </p>
        <p v-else-if="kernelStatusBusy" class="muted ai-history-page__kernel-policy">正在读取 kernel 状态…</p>
        <div class="ai-history-page__kernel-trace-block">
          <div class="ai-head ai-history-page__kernel-trace-head">
            <h4 class="ai-head__title">决策 Trace</h4>
            <span class="ai-head__hint">repeater 机会判定与 conversation_decision_trace</span>
          </div>
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
                <span class="ai-history-page__scene-pill">{{ row.kind || "trace" }}</span>
              </div>
              <div class="ai-history-page__feedback-meta">
                <span v-if="row.group_id">群 {{ row.group_id }}</span>
                <span v-if="row.bot_id">Bot {{ row.bot_id }}</span>
                <span v-if="row.created_at">{{ formatCompactDateTime(row.created_at) }}</span>
              </div>
              <div v-if="kernelTraceHighlights(row).length" class="ai-history-page__trace-highlights">
                <span
                  v-for="item in kernelTraceHighlights(row)"
                  :key="`${kernelTraceKey(row, index)}-${item.label}`"
                >
                  {{ item.label }}：{{ item.value }}
                </span>
              </div>
              <pre
                v-if="expandedKernelTraceKeys[kernelTraceKey(row, index)]"
                class="ai-history-page__kernel-trace-json"
              >{{ JSON.stringify(row, null, 2) }}</pre>
              <button
                type="button"
                class="ai-history-page__turn-toggle"
                @click="toggleKernelTraceExpanded(kernelTraceKey(row, index))"
              >
                {{ expandedKernelTraceKeys[kernelTraceKey(row, index)] ? "收起原始 JSON" : "查看原始 JSON" }}
              </button>
            </article>
          </div>
          <p v-else class="muted ai-history-page__empty-hint">
            <span>{{ kernelTracesBusy ? "正在读取 trace…" : "当前筛选下暂无决策 trace" }}</span>
          </p>
        </div>
      </UiCard>
    </section>
    <section class="ai-history-page__feedback">
      <UiCard class="ai-history-page__panel">
        <div class="ai-history-page__observe-panel-hd">
          <div class="ai-history-page__observe-panel-hd-text">
            <h3 class="ai-history-page__observe-panel-title">闲聊反哺接话</h3>
            <p class="ai-history-page__observe-panel-sub">
              <span v-if="isObservePanelExpanded('feedback')">观察 llm_chat 成功回复沉淀出的软反馈样本</span>
              <span v-else class="muted">{{ feedbackPanelSummary }}</span>
            </p>
          </div>
          <UiButton
            size="sm"
            variant="outline"
            class="panel-hd-collapse-btn ai-history-page__observe-panel-toggle"
            @click="toggleObservePanel('feedback')"
          >
            {{ isObservePanelExpanded('feedback') ? "收起" : "展开" }}
          </UiButton>
        </div>
        <div v-show="isObservePanelExpanded('feedback')" class="ai-history-page__observe-panel-body">
        <div class="ai-history-page__filters-card">
          <div class="ai-history-page__filters-head">
            <strong>反馈筛选</strong>
            <span class="muted">按群号查看最近沉淀的反馈样本</span>
          </div>
          <div class="ai-history-page__filters ai-history-page__filters--aligned">
            <label class="ai-history-page__filter">
              <span>群号</span>
              <input
                v-model="feedbackGroup"
                class="inp"
                inputmode="numeric"
                placeholder="必填"
                @input="feedbackGroupTouched = true; observeGroup = feedbackGroup; observeGroupTouched = true"
                @keyup.enter="refreshFeedback"
              >
            </label>
            <div class="ai-history-page__filter-action">
              <UiButton size="sm" variant="outline" :busy="feedbackBusy" @click="refreshFeedback">读取反馈</UiButton>
            </div>
          </div>
        </div>
        <div v-if="feedbackErr" class="alert alert--err">{{ feedbackErr }}</div>
        <div class="ai-stat-grid ai-history-page__feedback-summary">
          <div
            v-for="item in feedbackOverview"
            :key="item.label"
            class="ai-stat ai-history-page__summary-stat"
          >
            <span class="ai-stat__label">{{ item.label }}</span>
            <strong class="ai-stat__value" :class="{ 'ai-stat__value--accent': item.accent }">{{ item.value }}</strong>
          </div>
        </div>
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
                {{ item.behavior_scene }}
              </button>
              <span v-else class="ai-history-page__scene-pill">未标注</span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>{{ formatCompactDateTime(item.created_at) }}</span>
              <span>路由：{{ item.llm_route || "未知" }}</span>
              <span>bias：{{ item.eligible_for_bias ? "可用" : "过滤" }}</span>
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
          <span class="ai-empty__hint">这里只读展示，不会直接修改复读语料。</span>
        </div>
        </div>
      </UiCard>
    </section>

    <section class="ai-history-page__feedback">
      <UiCard class="ai-history-page__panel">
        <div class="ai-history-page__observe-panel-hd">
          <div class="ai-history-page__observe-panel-hd-text">
            <h3 class="ai-history-page__observe-panel-title">写回晋升候选</h3>
            <p class="ai-history-page__observe-panel-sub">
              <span v-if="isObservePanelExpanded('promotion')">同群重复出现的接话可审批为晋升候选；语料实际写回尚未接通</span>
              <span v-else class="muted">{{ promotionPanelSummary }}</span>
            </p>
          </div>
          <UiButton
            size="sm"
            variant="outline"
            class="panel-hd-collapse-btn ai-history-page__observe-panel-toggle"
            @click="toggleObservePanel('promotion')"
          >
            {{ isObservePanelExpanded('promotion') ? "收起" : "展开" }}
          </UiButton>
        </div>
        <div v-show="isObservePanelExpanded('promotion')" class="ai-history-page__observe-panel-body">
        <div class="ai-history-page__filters-card">
          <div class="ai-history-page__filters-head">
            <strong>候选筛选</strong>
            <span class="muted">与上方反馈共用群号；需开启 writeback 开关后才会生成候选</span>
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
        </div>
      </UiCard>
    </section>

    <section class="ai-history-page__feedback">
      <UiCard class="ai-history-page__panel">
        <div class="ai-history-page__observe-panel-hd">
          <div class="ai-history-page__observe-panel-hd-text">
            <h3 class="ai-history-page__observe-panel-title">近期 Behavior 记录</h3>
            <p class="ai-history-page__observe-panel-sub">
              <span v-if="isObservePanelExpanded('behavior')">跨会话观察最近自动判定结果，判断当前规则是否稳定</span>
              <span v-else class="muted">{{ behaviorPanelSummary }}</span>
            </p>
          </div>
          <UiButton
            size="sm"
            variant="outline"
            class="panel-hd-collapse-btn ai-history-page__observe-panel-toggle"
            @click="toggleObservePanel('behavior')"
          >
            {{ isObservePanelExpanded('behavior') ? "收起" : "展开" }}
          </UiButton>
        </div>
        <div v-show="isObservePanelExpanded('behavior')" class="ai-history-page__observe-panel-body">
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
                <span>包含 disabled</span>
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
                {{ run.scene }}
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
                  {{ expandedBehaviorTraceKeys[behaviorAgentTraceKey('observe', run.request_id)] ? "收起 Agent Trace" : "查看 Agent Trace" }}
                </button>
                <button
                  type="button"
                  class="ai-history-page__turn-toggle"
                  :disabled="replayRunBusy[run.request_id]"
                  @click="runReplay(run.request_id)"
                >
                  {{ replayRunBusy[run.request_id] ? "Replay 中…" : "执行 Replay" }}
                </button>
                <button
                  type="button"
                  class="ai-history-page__turn-toggle"
                  :disabled="replayCopyBusy[run.request_id]"
                  @click="copyReplayPayload(run.request_id)"
                >
                  复制 Replay Payload
                </button>
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
          <span>{{ behaviorRunsBusy ? "正在读取记录" : "当前筛选下暂无 behavior 记录" }}</span>
          <span class="ai-empty__hint">这里适合快速观察最近哪些 rule 在生效、哪些结果被自动判成 ignored 或 derailed。</span>
        </div>
        </div>
      </UiCard>
    </section>
    </div>

    <div v-show="activeWorkspace === 'memory'" class="ai-history-page__workspace">
    <section class="ai-history-page__feedback">
      <UiCard class="ai-history-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">记忆与知识管理</h3>
          <span class="ai-head__hint">先提供最小可用浏览面：群内旧事、关系备注、已加载知识源</span>
        </div>
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
          <span class="ai-head__hint">teach / ambient 提炼出的短期群记忆</span>
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
          <span class="ai-head__hint">按 Bot / 群 / 用户维度维护的稳定备注</span>
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
              <span>来源：{{ item.source || "teach" }}</span>
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
          <span class="ai-head__hint">已加载到当前 Bot 运行态的知识源声明</span>
        </div>
        <div v-if="knowledgeSources.length" class="ai-history-page__feedback-list">
          <article
            v-for="item in knowledgeSources"
            :key="item.source_id"
            class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior"
          >
            <div class="ai-history-page__feedback-top">
              <strong class="ai-history-page__feedback-reply">{{ item.title }}</strong>
              <span class="ai-history-page__scene-pill">{{ item.scope || "global" }}</span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>{{ item.source_id }}</span>
              <span>来源：{{ item.plugin_title || item.plugin_name || item.origin || "未知" }}</span>
              <span>模式：{{ item.retrieval_mode || "prompt_inject" }}</span>
              <span>chunks：{{ item.chunk_count ?? 0 }}</span>
            </div>
            <p v-if="item.description" class="ai-history-page__feedback-user">说明：{{ item.description }}</p>
          </article>
        </div>
        <p v-else class="muted ai-history-page__empty-hint">
          {{ memoryBusy ? "正在读取知识源…" : "当前暂无知识源" }}
        </p>
      </UiCard>
    </section>
    </div>

    <div v-show="activeWorkspace === 'rules'" class="ai-history-page__workspace">
    <section class="ai-history-page__feedback">
      <UiCard class="ai-history-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">Behavior 规则管理</h3>
          <span class="ai-head__hint">先做最小可用维护面：筛选、编辑、禁用、删除</span>
        </div>
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
                <span>包含 disabled</span>
              </label>
            </div>
            <label class="ai-history-page__filter">
              <span>排序</span>
              <select v-model="patternSortKey" class="inp">
                <option value="success_score">success 优先</option>
                <option value="manual_score">manual 优先</option>
                <option value="pattern_id">ID 字母序</option>
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
                <th>pattern_id</th>
                <th>scene / action</th>
                <th>群</th>
                <th>分数</th>
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
                <td>{{ item.scene }} / {{ item.action }}</td>
                <td>{{ item.scope_group_id || "全局" }}</td>
                <td>{{ item.success_score ?? 0 }} / {{ item.manual_score ?? 0 }}</td>
                <td>{{ item.disabled ? "disabled" : "active" }}</td>
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
              <strong>{{ item.pattern_id }}</strong>
              <span class="muted">{{ item.scene }} / {{ item.action }}</span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>群：{{ item.scope_group_id || "全局" }}</span>
              <span>success：{{ item.success_score ?? 0 }}</span>
              <span>manual：{{ item.manual_score ?? 0 }}</span>
              <span>已禁用：{{ item.disabled ? "是" : "否" }}</span>
            </div>
            <p v-if="item.persona_affinity" class="ai-history-page__feedback-user">persona：{{ item.persona_affinity }}</p>
            <p class="ai-history-page__feedback-user">features：{{ item.trigger_features?.join(" / ") || "无" }}</p>
            <p class="ai-history-page__feedback-user">examples：{{ item.reference_examples?.join(" / ") || "无" }}</p>
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
          <span class="ai-empty__hint">这块先承接最基础的 pattern 维护，后续再考虑更强的 run 联动和人工纠偏。</span>
        </div>
      </UiCard>
    </section>
    </div>

    <UiDialog
      :open="patternEditorOpen"
      :title="patternEditorMode === 'edit' ? '编辑规则' : '新建规则'"
      :subtitle="'trigger_features 与 reference_examples 按行输入'"
      :busy="patternSaveBusy"
      panel-class="ai-history-page__pattern-dialog"
      @close="closePatternEditor"
    >
      <div class="ai-history-page__pattern-form">
        <label class="ai-history-page__filter">
          <span>pattern_id</span>
          <input v-model="patternEditor.pattern_id" class="inp" placeholder="例如 group-threading-001">
        </label>
        <label class="ai-history-page__filter">
          <span>scene</span>
          <select v-model="patternEditor.scene" class="inp">
            <option v-for="item in BEHAVIOR_SCENE_OPTIONS.filter((row) => row.value)" :key="`editor-scene-${item.value}`" :value="item.value">
              {{ item.value }}
            </option>
          </select>
        </label>
        <label class="ai-history-page__filter">
          <span>action</span>
          <select v-model="patternEditor.action" class="inp">
            <option v-for="item in BEHAVIOR_ACTION_OPTIONS" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
        <label class="ai-history-page__filter">
          <span>scope_group_id</span>
          <input
            :value="patternEditor.scope_group_id ?? ''"
            class="inp"
            inputmode="numeric"
            placeholder="留空表示全局"
            @input="patternEditor.scope_group_id = parseFilter(($event.target as HTMLInputElement).value)"
          >
        </label>
        <label class="ai-history-page__filter">
          <span>success_score</span>
          <input
            :value="patternEditor.success_score ?? 0"
            class="inp"
            inputmode="numeric"
            @input="patternEditor.success_score = Number(($event.target as HTMLInputElement).value || 0)"
          >
        </label>
        <label class="ai-history-page__filter">
          <span>manual_score</span>
          <input
            :value="patternEditor.manual_score ?? 0"
            class="inp"
            inputmode="numeric"
            @input="patternEditor.manual_score = Number(($event.target as HTMLInputElement).value || 0)"
          >
        </label>
        <label class="ai-history-page__filter ai-history-page__pattern-form-span">
          <span>persona_affinity</span>
          <input v-model="patternEditor.persona_affinity" class="inp" placeholder="可留空">
        </label>
        <label class="ai-history-page__filter ai-history-page__pattern-form-span">
          <span>trigger_features</span>
          <textarea
            class="inp ai-history-page__pattern-textarea"
            :value="patternEditorTriggerText()"
            placeholder="每行一个特征"
            @input="patternEditor.trigger_features = parseLineList(($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>
        <label class="ai-history-page__filter ai-history-page__pattern-form-span">
          <span>reference_examples</span>
          <textarea
            class="inp ai-history-page__pattern-textarea"
            :value="patternEditorExampleText()"
            placeholder="每行一个示例"
            @input="patternEditor.reference_examples = parseLineList(($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>
        <label class="ai-history-page__behavior-check">
          <input v-model="patternEditor.disabled" type="checkbox">
          <span>保存为 disabled</span>
        </label>
      </div>
      <template #footer>
        <div class="row-actions ai-history-page__pattern-actions">
          <UiButton size="sm" :busy="patternSaveBusy" @click="savePattern">
            {{ patternEditorMode === "edit" ? "保存修改" : "创建 Pattern" }}
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
          <div v-if="replayRunReply || replayRunAssistantPreview" class="ai-history-page__replay-block">
            <div class="ai-head ai-history-page__replay-block-head">
              <h4 class="ai-head__title">重放回复</h4>
              <span class="ai-head__hint">优先展示 replay 返回的 reply，缺省时回退 assistant_message.content</span>
            </div>
            <pre class="ai-history-page__kernel-trace-json ai-history-page__kernel-trace-json--compact">{{ replayRunReply || replayRunAssistantPreview }}</pre>
          </div>
          <div v-if="replayRunTrace" class="ai-history-page__replay-block">
            <div class="ai-head ai-history-page__replay-block-head">
              <h4 class="ai-head__title">Agent Trace 摘要</h4>
              <span class="ai-head__hint">快速看阶段、工具调用与快照关联</span>
            </div>
            <div v-if="behaviorAgentTraceHighlights(replayRunTrace).length" class="ai-history-page__trace-highlights">
              <span
                v-for="item in behaviorAgentTraceHighlights(replayRunTrace)"
                :key="`replay-${item.label}`"
              >
                {{ item.label }}：{{ item.value }}
              </span>
            </div>
            <p v-else class="muted">本次 replay 未返回可展示的 trace 摘要。</p>
          </div>
          <button
            type="button"
            class="ai-history-page__turn-toggle"
            @click="replayRunRawExpanded = !replayRunRawExpanded"
          >
            {{ replayRunRawExpanded ? "收起完整结果 JSON" : "查看完整结果 JSON" }}
          </button>
          <pre
            v-if="replayRunRawExpanded"
            class="ai-history-page__kernel-trace-json"
          >{{ JSON.stringify(replayRunResult, null, 2) }}</pre>
        </template>
        <p v-else class="muted">暂无 replay 结果。</p>
      </div>
      <template #footer>
        <div class="row-actions ai-history-page__pattern-actions">
          <UiButton size="sm" variant="outline" :disabled="!replayRunResult" @click="copyReplayRunResult">
            复制结果 JSON
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
.ai-history-page__promotion-actions {
  margin-top: 10px;
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

.ai-history-page__observe-panel-toggle:deep(.ui-btn) {
  flex-shrink: 0;
}

.ai-history-page__observe-panel-body {
  display: grid;
  gap: 0;
}

@media (max-width: 560px) {
  .ai-history-page__promotion-actions > .btn,
  .ai-history-page__promotion-actions > :deep(.ui-btn),
  .ai-history-page__trace-actions > button {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
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

.ai-history-page__context-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent) 5%, transparent);
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

.ai-history-page__workspace--sessions .ai-history-page__sessions {
  align-items: stretch;
}

.ai-history-page__session-list--scroll {
  max-height: min(68vh, 720px);
  overflow: auto;
  padding-right: 2px;
}

.ai-history-page__detail-panel {
  min-height: min(68vh, 720px);
}

.ai-history-page__thread {
  display: grid;
  gap: 10px;
  max-height: min(52vh, 560px);
  overflow: auto;
  padding-right: 4px;
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
  gap: 10px;
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

.ai-history-page__session {
  display: grid;
  gap: 6px;
  text-align: left;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 2.5%, transparent);
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.ai-history-page__session:hover {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
}

.ai-history-page__session.is-on {
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.ai-history-page__session-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ai-history-page__session-role {
  margin-left: auto;
  padding: 1px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.ai-history-page__session.is-on .ai-history-page__session-role {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}

.ai-history-page__session-time,
.ai-history-page__session-meta {
  font-size: 0.75rem;
}

.ai-history-page__session-preview {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--text-muted);
  display: -webkit-box;
  min-height: calc(1.45em * 2);
  max-height: calc(1.45em * 2);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
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
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 2.5%, transparent);
}

.ai-history-page__turn.is-assistant {
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.ai-history-page__turn-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.8125rem;
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

@media (max-width: 860px) {
  .ai-history-page__overview,
  .ai-history-page__sessions,
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
  .ai-history-page__session-top,
  .ai-history-page__turn-head,
  .ai-history-page__behavior-top,
  .ai-history-page__feedback-top {
    display: grid;
    gap: 4px;
  }

  .ai-history-page__session-role {
    margin-left: 0;
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

  .ai-history-page__turn-behavior-bar {
    display: grid;
    gap: 6px;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
