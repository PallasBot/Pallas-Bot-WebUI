<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  fetchLlmBehaviorRuns,
  fetchLlmHistorySession,
  fetchLlmHistorySessions,
  fetchLlmRepeaterFeedback,
  fetchLlmRepeaterFeedbackSummary,
  postLlmHistoryBehaviorAnnotate,
} from "@/api/consoleApi";
import type {
  LlmHistoryBehaviorRun,
  LlmHistoryBehaviorAutoFeedbackPayload,
  LlmHistorySessionDetailData,
  LlmHistorySessionSummary,
  LlmRepeaterFeedbackEntry,
  LlmRepeaterFeedbackSummary,
} from "@/api/pallasTypes";
import AiDailyTrendChart from "@/components/ai-config/stats/AiDailyTrendChart.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { AI_ASSISTANT_NAME, AI_STATS_LIMITS } from "@/config/aiConstants";
import { useAiTaskStatsPage } from "@/composables/useAiTaskStatsPage";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
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
const behaviorRunsBusy = ref(false);
const behaviorRunsErr = ref("");
const behaviorRunsItems = ref<LlmHistoryBehaviorRun[]>([]);
const behaviorRunsGroup = ref("");
const behaviorRunsGroupTouched = ref(false);
const behaviorRunsScene = ref("");
const behaviorRunsOutcome = ref("");
const behaviorRunsIncludeDisabled = ref(false);

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
  { label: "全部 Scene", value: "" },
  { label: "provocation", value: "provocation" },
  { label: "banter", value: "banter" },
  { label: "smalltalk", value: "smalltalk" },
  { label: "venting", value: "venting" },
  { label: "group_threading", value: "group_threading" },
  { label: "light_help", value: "light_help" },
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
const behaviorRunsGroupId = computed(() => parseFilter(behaviorRunsGroup.value));
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
const feedbackOverview = computed(() => [
  {
    label: "样本数",
    value: feedbackSummary.value ? String(feedbackSummary.value.count) : "—",
    accent: true,
  },
  {
    label: "高频回复",
    value: feedbackSummary.value?.top_replies?.length ? feedbackSummary.value.top_replies.slice(0, 2).join(" / ") : "暂无",
  },
  {
    label: "Scene",
    value: feedbackSummary.value?.scenes?.length ? feedbackSummary.value.scenes.slice(0, 2).join(" / ") : "暂无",
  },
]);

const selectedSession = computed(() =>
  sessions.value.find((item) => item.session_key === selectedSessionKey.value) ?? null,
);

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
  } catch (e) {
    feedbackItems.value = [];
    feedbackSummary.value = null;
    feedbackErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    feedbackBusy.value = false;
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

watch(month, () => {
  resetMonthRange();
  showAllDailyRows.value = false;
  void refresh();
});

watch([start, end], () => {
  showAllDailyRows.value = false;
  void refresh();
});

watch(selectedSessionKey, () => {
  expandedTurnKeys.value = {};
  void refreshSessionDetail();
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
});

onMounted(() => {
  resetMonthRange();
  void refreshAll();
  feedbackGroup.value = filterGroup.value;
  behaviorRunsGroup.value = filterGroup.value;
  void refreshBehaviorRuns();
});
</script>

<template>
  <div class="console-hub-page ai-surface ai-history-page">
    <ConsoleHubMasthead :icon="panelNavIcon">
      <template #title>
        AI 历史
      </template>
      <template #lead>
        左侧按时间窗看每日走势与回复路径，下面浏览最近的 AI 会话，点开任意会话即可看到完整的来回对话。
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
          <div class="ai-history-page__filters">
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
            <UiButton size="sm" variant="outline" :busy="historyBusy" @click="refreshSessions">筛选</UiButton>
          </div>
        </div>
        <div v-if="sessions.length" class="ai-history-page__session-list">
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

      <UiCard class="ai-history-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">会话明细</h3>
          <span class="ai-head__hint">{{ sessionDetail ? "当前选中会话的完整对话" : "选择左侧会话查看" }}</span>
        </div>
        <div v-if="sessionDetail" class="ai-history-page__detail">
          <div class="ai-history-page__detail-summary">
            <span>Bot {{ sessionDetail.session.bot_id }}</span>
            <span>{{ sessionDetail.session.group_id === 0 ? "私聊" : `群 ${sessionDetail.session.group_id}` }}</span>
            <span>用户 {{ sessionDetail.session.user_id }}</span>
            <span>{{ sessionDetail.session.turn_count }} 条对话</span>
          </div>
          <section v-if="sessionDetail.behavior_runs?.length" class="ai-history-page__behavior">
            <div class="ai-head ai-history-page__behavior-head">
              <h4 class="ai-head__title">Behavior 参考</h4>
              <span class="ai-head__hint">在历史对话里校正姿态、结果和保留样本</span>
            </div>
            <article
              v-for="run in sessionDetail.behavior_runs"
              :key="run.request_id"
              class="ai-history-page__behavior-card"
            >
              <div class="ai-history-page__behavior-top">
                <strong>{{ run.scene }}</strong>
                <span class="muted">请求 {{ run.request_id }}</span>
              </div>
              <div class="ai-history-page__behavior-meta">
                <span>动作：{{ run.selected_actions.join(" / ") || "未选" }}</span>
                <span>Pattern：{{ run.selected_pattern_ids.join(", ") || "无" }}</span>
                <span>结果：{{ run.final_outcome || "未判定" }}</span>
              </div>
              <div v-if="run.auto_feedback_payload" class="ai-history-page__behavior-evidence">
                <span>依据来源：{{ formatBehaviorSource(run.auto_feedback_payload) }}</span>
                <span>命中信号：{{ formatBehaviorSignal(run.auto_feedback_payload) }}</span>
                <span>命中词：{{ formatBehaviorTokens(run.auto_feedback_payload) }}</span>
                <span>观察消息：{{ run.auto_feedback_payload.observed_turn_count ?? 0 }} 条</span>
              </div>
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
          <article
            v-for="(turn, idx) in sessionDetail.turns"
            :key="turnKey(turn.created_at, idx)"
            class="ai-history-page__turn"
            :class="turn.role === 'assistant' ? 'is-assistant' : 'is-user'"
          >
            <div class="ai-history-page__turn-head">
              <strong>{{ turn.role === "assistant" ? AI_ASSISTANT_NAME : `用户 ${turn.user_id}` }}</strong>
              <span class="muted">{{ formatCompactDateTime(turn.created_at) }}</span>
            </div>
            <div
              class="ai-history-page__turn-body"
              :class="{ 'is-expanded': isTurnExpanded(turnKey(turn.created_at, idx)) }"
            >
              <p>{{ turn.content }}</p>
            </div>
            <button
              v-if="isLongTurn(turn.content)"
              type="button"
              class="ai-history-page__turn-toggle"
              @click="toggleTurnExpanded(turnKey(turn.created_at, idx))"
            >
              {{ isTurnExpanded(turnKey(turn.created_at, idx)) ? "收起" : "展开全文" }}
            </button>
          </article>
        </div>
        <div v-else class="ai-empty">
          <span>未选择会话</span>
          <span class="ai-empty__hint">点左侧任意会话查看完整对话。</span>
        </div>
      </UiCard>
    </section>

    <section class="ai-history-page__feedback">
      <UiCard class="ai-history-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">闲聊反哺接话</h3>
          <span class="ai-head__hint">观察 llm_chat 成功回复沉淀出的软反馈样本</span>
        </div>
        <div class="ai-history-page__filters-card">
          <div class="ai-history-page__filters-head">
            <strong>反馈筛选</strong>
            <span class="muted">按群号查看最近沉淀的反馈样本</span>
          </div>
          <div class="ai-history-page__filters">
            <label class="ai-history-page__filter">
              <span>群号</span>
              <input
                v-model="feedbackGroup"
                class="inp"
                inputmode="numeric"
                placeholder="必填"
                @input="feedbackGroupTouched = true"
                @keyup.enter="refreshFeedback"
              >
            </label>
            <UiButton size="sm" variant="outline" :busy="feedbackBusy" @click="refreshFeedback">读取反馈</UiButton>
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
        <div v-if="feedbackItems.length" class="ai-history-page__feedback-list">
          <article
            v-for="item in feedbackItems"
            :key="item.entry_id || item.request_id"
            class="ai-history-page__feedback-card"
          >
            <div class="ai-history-page__feedback-top">
              <strong>{{ item.reply_text || "（空回复）" }}</strong>
              <span class="muted">{{ formatCompactDateTime(item.created_at) }}</span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>scene：{{ item.behavior_scene || "未标注" }}</span>
              <span>route：{{ item.llm_route || "未知" }}</span>
              <span>bias：{{ item.eligible_for_bias ? "可用" : "过滤" }}</span>
            </div>
            <p class="ai-history-page__feedback-user">用户：{{ item.user_text || "（空）" }}</p>
          </article>
        </div>
        <div v-else class="ai-empty">
          <span>{{ feedbackGroupId ? "当前群暂无反馈样本" : "输入群号查看反馈" }}</span>
          <span class="ai-empty__hint">这里只读展示，不会直接修改复读语料。</span>
        </div>
      </UiCard>
    </section>

    <section class="ai-history-page__feedback">
      <UiCard class="ai-history-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">近期 Behavior 记录</h3>
          <span class="ai-head__hint">跨会话观察最近自动判定结果，判断当前规则是否稳定</span>
        </div>
        <div class="ai-history-page__filters-card">
          <div class="ai-history-page__filters-head">
            <strong>记录筛选</strong>
            <span class="muted">默认跟随当前选中会话的群号</span>
          </div>
          <div class="ai-history-page__filters">
            <label class="ai-history-page__filter">
              <span>群号</span>
              <input
                v-model="behaviorRunsGroup"
                class="inp"
                inputmode="numeric"
                placeholder="全部"
                @input="behaviorRunsGroupTouched = true"
                @keyup.enter="refreshBehaviorRuns"
              >
            </label>
            <label class="ai-history-page__filter">
              <span>Scene</span>
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
            <label class="ai-history-page__behavior-check">
              <input v-model="behaviorRunsIncludeDisabled" type="checkbox">
              <span>包含 disabled</span>
            </label>
            <UiButton size="sm" variant="outline" :busy="behaviorRunsBusy" @click="refreshBehaviorRuns">
              读取记录
            </UiButton>
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
            class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior"
          >
            <div class="ai-history-page__feedback-top">
              <strong>{{ run.scene }}</strong>
              <span class="muted">{{ run.final_outcome || "未判定" }}</span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>群：{{ run.group_id || "私聊" }}</span>
              <span>用户：{{ run.user_id || "—" }}</span>
              <span>score：{{ run.score_delta ?? 0 }}</span>
              <span>disabled：{{ run.disabled ? "是" : "否" }}</span>
            </div>
            <div class="ai-history-page__behavior-evidence">
              <span>依据来源：{{ formatBehaviorSource(run.auto_feedback_payload) }}</span>
              <span>命中信号：{{ formatBehaviorSignal(run.auto_feedback_payload) }}</span>
              <span>命中词：{{ formatBehaviorTokens(run.auto_feedback_payload) }}</span>
              <span>观察消息：{{ run.auto_feedback_payload?.observed_turn_count ?? 0 }} 条</span>
            </div>
            <p v-if="run.behavior_hint_text" class="ai-history-page__feedback-user">提示：{{ run.behavior_hint_text }}</p>
          </article>
        </div>
        <div v-else class="ai-empty">
          <span>{{ behaviorRunsBusy ? "正在读取记录" : "当前筛选下暂无 behavior 记录" }}</span>
          <span class="ai-empty__hint">这里适合快速观察最近哪些 rule 在生效、哪些结果被自动判成 ignored 或 derailed。</span>
        </div>
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
</template>

<style scoped>
.ai-history-page__hint {
  margin-top: 8px;
  font-size: 0.75rem;
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
  gap: 8px 12px;
  font-size: 0.75rem;
  color: var(--text-muted);
  padding-bottom: 4px;
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

.ai-history-page__feedback-list {
  display: grid;
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
  .ai-history-page__sessions {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-history-page__daily-stats {
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

  .ai-history-page__behavior-actions,
  .ai-history-page__behavior-labels,
  .ai-history-page__behavior-evidence {
    display: grid;
  }

  .ai-history-page__behavior-select {
    min-width: 0;
  }

  .ai-history-page__behavior-check {
    min-height: auto;
  }
}
</style>
