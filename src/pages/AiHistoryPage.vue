<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchLlmHistorySession, fetchLlmHistorySessions } from "@/api/consoleApi";
import type { LlmHistorySessionDetailData, LlmHistorySessionSummary } from "@/api/pallasTypes";
import ChartsDailyBarChart from "@/components/ChartsDailyBarChart.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { AI_ASSISTANT_NAME, AI_STATS_LIMITS } from "@/config/aiConstants";
import { useAiTaskStatsPage } from "@/composables/useAiTaskStatsPage";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { formatCompactDateTime } from "@/utils/formatDateTime";

const panelNavIcon = usePanelNavIcon();
const {
  loading,
  err,
  month,
  start,
  end,
  historyDailyRows,
  routeRowsTop,
  persistenceHint,
  refresh,
  resetMonthRange,
} = useAiTaskStatsPage();

const sessions = ref<LlmHistorySessionSummary[]>([]);
const selectedSessionKey = ref("");
const sessionDetail = ref<LlmHistorySessionDetailData | null>(null);
const historyBusy = ref(false);
const historyErr = ref("");

// 会话筛选：bot / group / user（空 = 不限）
const filterBot = ref("");
const filterGroup = ref("");
const filterUser = ref("");

function parseFilter(raw: string): number | null {
  const n = Number(raw.trim());
  return raw.trim() && Number.isFinite(n) ? n : null;
}

const combinedErr = computed(() => err.value || historyErr.value);
const anyBusy = computed(() => loading.value || historyBusy.value);

const selectedSession = computed(() =>
  sessions.value.find((item) => item.session_key === selectedSessionKey.value) ?? null,
);

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

watch(month, () => {
  resetMonthRange();
  void refresh();
});

watch([start, end], () => {
  void refresh();
});

watch(selectedSessionKey, () => {
  void refreshSessionDetail();
});

onMounted(() => {
  resetMonthRange();
  void refreshAll();
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

    <section class="ai-history-page__overview">
      <UiCard class="ai-history-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">每日完成任务</h3>
          <span class="ai-head__hint">成功 + 失败合计</span>
        </div>
        <ChartsDailyBarChart
          :points="historyDailyRows.map((row) => ({ date: row.date, value: row.aiOk + row.aiFail }))"
          title=""
          unit="次"
          accent="var(--accent)"
          empty-text="当前时间窗暂无历史快照。"
        />
      </UiCard>

      <UiCard class="ai-history-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">回复路径热点</h3>
          <span class="ai-head__hint">当前查询区间累计</span>
        </div>
        <div v-if="routeRowsTop.length" class="ai-rows">
          <div v-for="row in routeRowsTop" :key="row.key" class="ai-row">
            <span class="ai-row__key">{{ row.key }}</span>
            <strong class="ai-row__val">{{ row.count.toLocaleString() }}</strong>
          </div>
        </div>
        <div v-else class="ai-empty">
          <span>暂无路径数据</span>
          <span class="ai-empty__hint">这段时间还没有产生回复路径统计。</span>
        </div>
      </UiCard>
    </section>

    <section class="ai-history-page__sessions">
      <UiCard class="ai-history-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">最近会话</h3>
          <span class="ai-head__hint">按最后消息时间排序</span>
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
        <div v-if="sessions.length" class="ai-history-page__session-list">
          <button
            v-for="item in sessions"
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
          <article
            v-for="(turn, idx) in sessionDetail.turns"
            :key="`${turn.created_at}-${idx}`"
            class="ai-history-page__turn"
            :class="turn.role === 'assistant' ? 'is-assistant' : 'is-user'"
          >
            <div class="ai-history-page__turn-head">
              <strong>{{ turn.role === "assistant" ? AI_ASSISTANT_NAME : `用户 ${turn.user_id}` }}</strong>
              <span class="muted">{{ formatCompactDateTime(turn.created_at) }}</span>
            </div>
            <p>{{ turn.content }}</p>
          </article>
        </div>
        <div v-else class="ai-empty">
          <span>未选择会话</span>
          <span class="ai-empty__hint">点左侧任意会话查看完整对话。</span>
        </div>
      </UiCard>
    </section>

    <UiCard class="ai-history-page__panel">
      <div class="ai-head">
        <h3 class="ai-head__title">按日快照</h3>
        <span class="ai-head__hint">每日聚合明细</span>
      </div>
      <div v-if="historyDailyRows.length" class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>日期</th>
              <th>Bot 提交</th>
              <th>Bot 回调</th>
              <th>AI 成功</th>
              <th>AI 失败</th>
              <th>排队 / 运行</th>
              <th>主要路径</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in historyDailyRows" :key="row.date">
              <td>{{ row.date }}</td>
              <td>{{ row.botSubmit.toLocaleString() }}</td>
              <td>{{ row.botCallback.toLocaleString() }}</td>
              <td>{{ row.aiOk.toLocaleString() }}</td>
              <td>{{ row.aiFail.toLocaleString() }}</td>
              <td>{{ row.queued.toLocaleString() }} / {{ row.running.toLocaleString() }}</td>
              <td>{{ row.routes.map((item) => `${item.key} ${item.count}`).join(" · ") || "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="ai-empty">
        <span>暂无快照</span>
        <span class="ai-empty__hint">当前时间窗内没有 AI 历史快照。</span>
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.ai-history-page__hint {
  margin-top: 8px;
  font-size: 0.75rem;
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

.ai-history-page__panel {
  height: 100%;
}

.ai-history-page__session-list,
.ai-history-page__detail {
  display: grid;
  gap: 10px;
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

.ai-history-page__session {
  display: grid;
  gap: 4px;
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
  line-height: 1.5;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  margin: 8px 0 0;
  font-size: 0.875rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 860px) {
  .ai-history-page__overview,
  .ai-history-page__sessions {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
