<script setup lang="ts">
import type {
  ConversationKernelKnowledgeSource,
  ConversationKernelMemoryEntry,
  ConversationKernelRelationshipNote,
} from "@/api/pallasTypes";
import AiHistoryPanelShell from "@/components/ai-history/AiHistoryPanelShell.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import type { AiHistoryBotOption, AiHistoryStatItem } from "@/components/ai-history/types";
import type { MemoryScopeSummary } from "@/utils/memoryScope";
import { formatCompactDateTime } from "@/utils/formatDateTime";

const memoryBot = defineModel<string>("memoryBot", { default: "" });
const memoryGroup = defineModel<string>("memoryGroup", { default: "" });
const memoryQuery = defineModel<string>("memoryQuery", { default: "" });

defineProps<{
  botOptions: ReadonlyArray<AiHistoryBotOption>;
  memoryScope?: MemoryScopeSummary | null;
  memoryErr?: string;
  memoryBusy?: boolean;
  memoryOverview: ReadonlyArray<AiHistoryStatItem>;
  memoryEntries: ReadonlyArray<ConversationKernelMemoryEntry>;
  relationshipNotes: ReadonlyArray<ConversationKernelRelationshipNote>;
  knowledgeSources: ReadonlyArray<ConversationKernelKnowledgeSource>;
  memoryDeleteBusy?: string;
}>();

const emit = defineEmits<{
  "bot-touched": [];
  "group-touched": [];
  refresh: [];
  "delete-memory": [item: ConversationKernelMemoryEntry];
  "delete-relationship": [item: ConversationKernelRelationshipNote];
}>();
</script>

<template>
  <div class="ai-history-page__workspace plugin-config-page">
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
            <label class="ai-history-page__filter ai-history-page__filter--memory-bot">
              <span>Bot QQ</span>
              <UiSelect
                v-model="memoryBot"
                aria-label="选择 Bot QQ"
                @update:model-value="emit('bot-touched')"
              >
                <option value="">
                  请选择 Bot
                </option>
                <option
                  v-for="bot in botOptions"
                  :key="bot.value"
                  :value="bot.value"
                >
                  {{ bot.label }}
                </option>
              </UiSelect>
            </label>
            <label class="ai-history-page__filter">
              <span>群号</span>
              <UiInput
                v-model="memoryGroup"
                inputmode="numeric"
                placeholder="留空查看全部范围"
                aria-label="群号"
                @update:model-value="emit('group-touched')"
                @keyup.enter="emit('refresh')"
              />
            </label>
            <label class="ai-history-page__filter">
              <span>搜索</span>
              <UiInput
                v-model="memoryQuery"
                type="search"
                placeholder="搜内容、关键词或来源"
                aria-label="搜索"
                @keyup.enter="emit('refresh')"
              />
            </label>
            <div class="ai-history-page__filter-action">
              <UiButton
                size="sm"
                variant="outline"
                :busy="memoryBusy"
                @click="emit('refresh')"
              >
                读取记忆
              </UiButton>
            </div>
          </div>
          <div
            v-if="memoryScope"
            class="ai-history-page__memory-scope-card"
          >
            <strong>{{ memoryScope.title }}</strong>
            <span class="muted">{{ memoryScope.detail }}</span>
          </div>
        </div>
        <div
          v-if="memoryErr"
          class="alert alert--err"
        >
          {{ memoryErr }}
        </div>
        <div class="ai-stat-grid ai-history-page__feedback-summary">
          <div
            v-for="item in memoryOverview"
            :key="item.label"
            class="ai-stat ai-history-page__summary-stat"
          >
            <span class="ai-stat__label">{{ item.label }}</span>
            <strong
              class="ai-stat__value"
              :class="{ 'ai-stat__value--accent': item.accent }"
            >{{ item.value }}</strong>
          </div>
        </div>

        <div class="ai-head ai-history-page__kernel-trace-head">
          <h4 class="ai-head__title">
            群内旧事
          </h4>
        </div>
        <div
          v-if="memoryEntries.length"
          class="ai-history-page__feedback-list"
        >
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
                @click="emit('delete-memory', item)"
              >
                删除
              </UiButton>
            </div>
          </article>
        </div>
        <p
          v-else
          class="muted ai-history-page__empty-hint"
        >
          {{ memoryBusy ? "正在读取群内旧事…" : "当前筛选下暂无群内旧事" }}
        </p>

        <div class="ai-head ai-history-page__kernel-trace-head">
          <h4 class="ai-head__title">
            关系备注
          </h4>
        </div>
        <div
          v-if="relationshipNotes.length"
          class="ai-history-page__feedback-list"
        >
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
                @click="emit('delete-relationship', item)"
              >
                删除
              </UiButton>
            </div>
          </article>
        </div>
        <p
          v-else
          class="muted ai-history-page__empty-hint"
        >
          {{ memoryBusy ? "正在读取关系备注…" : "当前筛选下暂无关系备注" }}
        </p>

        <div class="ai-head ai-history-page__kernel-trace-head">
          <h4 class="ai-head__title">
            知识源
          </h4>
        </div>
        <div
          v-if="knowledgeSources.length"
          class="ai-history-page__feedback-list"
        >
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
            <p
              v-if="item.description"
              class="ai-history-page__feedback-user"
            >
              说明：{{ item.description }}
            </p>
          </article>
        </div>
        <p
          v-else
          class="muted ai-history-page__empty-hint"
        >
          {{ memoryBusy ? "正在读取知识源…" : "当前暂无知识源" }}
        </p>
      </AiHistoryPanelShell>
    </section>
  </div>
</template>
