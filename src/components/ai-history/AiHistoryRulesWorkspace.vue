<script setup lang="ts">
import type { LlmBehaviorPattern } from "@/api/pallasTypes";
import AiHistoryPanelShell from "@/components/ai-history/AiHistoryPanelShell.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import type { AiHistoryStatItem } from "@/components/ai-history/types";
import {
  BEHAVIOR_SCENE_OPTIONS,
  PATTERN_SORT_OPTIONS,
  labelAction,
  labelScene,
} from "@/utils/aiHistoryLabels";

const patternsGroup = defineModel<string>("patternsGroup", { default: "" });
const patternsScene = defineModel<string>("patternsScene", { default: "" });
const patternsIncludeDisabled = defineModel<boolean>("patternsIncludeDisabled", { default: false });
const patternSortKey = defineModel<"success_score" | "manual_score" | "pattern_id">(
  "patternSortKey",
  { default: "success_score" },
);

defineProps<{
  patternBusy?: boolean;
  patternErr?: string;
  patternsOverview: ReadonlyArray<AiHistoryStatItem>;
  sortedPatternsItems: ReadonlyArray<LlmBehaviorPattern>;
  patternEditorOpen?: boolean;
  editingPatternId?: string;
  patternSaveBusy?: boolean;
}>();

const emit = defineEmits<{
  "group-touched": [];
  refresh: [];
  create: [];
  edit: [item: LlmBehaviorPattern];
  "toggle-disabled": [item: LlmBehaviorPattern];
  delete: [item: LlmBehaviorPattern];
}>();
</script>

<template>
  <div class="ai-history-page__workspace plugin-config-page">
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
              <UiInput
                v-model="patternsGroup"
                inputmode="numeric"
                placeholder="全部"
                aria-label="群号"
                @update:model-value="emit('group-touched')"
                @keyup.enter="emit('refresh')"
              />
            </label>
            <label class="ai-history-page__filter">
              <span>场景</span>
              <UiSelect
                v-model="patternsScene"
                aria-label="场景"
              >
                <option
                  v-for="item in BEHAVIOR_SCENE_OPTIONS"
                  :key="`pattern-${item.value || 'empty'}`"
                  :value="item.value"
                >
                  {{ item.label }}
                </option>
              </UiSelect>
            </label>
            <div class="ai-history-page__filter-action ai-history-page__filter-action--check">
              <label class="ai-history-page__behavior-check">
                <input
                  v-model="patternsIncludeDisabled"
                  type="checkbox"
                >
                <span>包含已禁用</span>
              </label>
            </div>
            <label class="ai-history-page__filter">
              <span>排序</span>
              <UiSelect
                v-model="patternSortKey"
                aria-label="排序"
              >
                <option
                  v-for="item in PATTERN_SORT_OPTIONS"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </option>
              </UiSelect>
            </label>
            <div class="ai-history-page__filter-action ai-history-page__filter-action--row">
              <UiButton
                size="sm"
                variant="outline"
                :busy="patternBusy"
                @click="emit('refresh')"
              >
                读取规则
              </UiButton>
              <UiButton
                size="sm"
                variant="ghost"
                @click="emit('create')"
              >
                新建规则
              </UiButton>
            </div>
          </div>
        </div>
        <div
          v-if="patternErr"
          class="alert alert--err"
        >
          {{ patternErr }}
        </div>
        <div class="ai-stat-grid ai-history-page__feedback-summary">
          <div
            v-for="item in patternsOverview"
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

        <div
          v-if="sortedPatternsItems.length"
          class="table-wrap ai-history-page__pattern-table-wrap"
        >
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
                :class="{ 'is-editing': patternEditorOpen && editingPatternId === item.pattern_id }"
              >
                <td class="ai-history-page__pattern-id">
                  {{ item.pattern_id }}
                </td>
                <td>{{ labelScene(item.scene) }} / {{ labelAction(item.action) }}</td>
                <td>{{ item.scope_group_id || "全局" }}</td>
                <td>{{ item.success_score ?? 0 }} / {{ item.manual_score ?? 0 }}</td>
                <td>{{ item.disabled ? "已禁用" : "生效中" }}</td>
                <td>
                  <div class="row-actions ai-history-page__pattern-actions ai-history-page__pattern-actions--table">
                    <UiButton
                      size="sm"
                      variant="outline"
                      @click="emit('edit', item)"
                    >
                      编辑
                    </UiButton>
                    <UiButton
                      size="sm"
                      variant="ghost"
                      :busy="patternSaveBusy && editingPatternId === item.pattern_id"
                      @click="emit('toggle-disabled', item)"
                    >
                      {{ item.disabled ? "启用" : "禁用" }}
                    </UiButton>
                    <UiButton
                      size="sm"
                      variant="destructive"
                      @click="emit('delete', item)"
                    >
                      删除
                    </UiButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="sortedPatternsItems.length"
          class="ai-history-page__pattern-cards ai-history-page__feedback-list"
        >
          <article
            v-for="item in sortedPatternsItems"
            :key="item.pattern_id"
            class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior"
            :class="{ 'is-editing': patternEditorOpen && editingPatternId === item.pattern_id }"
          >
            <div class="ai-history-page__feedback-top">
              <strong>{{ labelScene(item.scene) }} · {{ labelAction(item.action) }}</strong>
              <span
                class="muted ai-history-page__pattern-id"
                :title="item.pattern_id"
              >{{ item.pattern_id }}</span>
            </div>
            <div class="ai-history-page__feedback-meta">
              <span>群：{{ item.scope_group_id || "全局" }}</span>
              <span>自动分：{{ item.success_score ?? 0 }}</span>
              <span>人工分：{{ item.manual_score ?? 0 }}</span>
              <span>已禁用：{{ item.disabled ? "是" : "否" }}</span>
            </div>
            <p
              v-if="item.persona_affinity"
              class="ai-history-page__feedback-user"
            >
              人设倾向：{{ item.persona_affinity }}
            </p>
            <p class="ai-history-page__feedback-user">
              触发特征：{{ item.trigger_features?.join(" / ") || "无" }}
            </p>
            <p class="ai-history-page__feedback-user">
              参考示例：{{ item.reference_examples?.join(" / ") || "无" }}
            </p>
            <div class="row-actions ai-history-page__pattern-actions">
              <UiButton
                size="sm"
                variant="outline"
                @click="emit('edit', item)"
              >
                编辑
              </UiButton>
              <UiButton
                size="sm"
                variant="ghost"
                :busy="patternSaveBusy && editingPatternId === item.pattern_id"
                @click="emit('toggle-disabled', item)"
              >
                {{ item.disabled ? "启用" : "禁用" }}
              </UiButton>
              <UiButton
                size="sm"
                variant="destructive"
                @click="emit('delete', item)"
              >
                删除
              </UiButton>
            </div>
          </article>
        </div>
        <div
          v-else
          class="ai-empty"
        >
          <span>{{ patternBusy ? "正在读取规则" : "当前筛选下暂无规则" }}</span>
          <span class="ai-empty__hint">在此维护基础行为规则；可与会话里的行为记录互相跳转。</span>
        </div>
      </AiHistoryPanelShell>
    </section>
  </div>
</template>
