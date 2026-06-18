<script setup lang="ts">
import type { AiRuntimeState } from "@/config/aiRuntimeRegistry";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import type { AiRuntimeOverview, AiRuntimeSnapshotGroup } from "@/utils/aiRuntimeTypes";
import { RouterLink } from "vue-router";

withDefaults(
  defineProps<{
    overview: AiRuntimeOverview;
    groups: AiRuntimeSnapshotGroup[];
    title?: string;
    variant?: "default" | "compact";
    emptyText?: string;
    showHubLink?: boolean;
  }>(),
  {
    title: "统一能力摘要",
    variant: "default",
    emptyText: "当前没有接入可展示的运行态数据。",
    showHubLink: false,
  },
);

function runtimeStateClass(state: AiRuntimeState): string {
  if (state === "healthy") return "tag--ok";
  if (state === "degraded") return "tag--warn";
  return "tag--muted";
}

function runtimeStateLabel(state: AiRuntimeState): string {
  if (state === "healthy") return "正常";
  if (state === "degraded") return "降级";
  if (state === "disabled") return "未启用";
  return "待确认";
}
</script>

<template>
  <div
    class="ai-runtime-summary"
    :class="`ai-runtime-summary--${variant}`"
  >
    <div class="ai-runtime-summary__head">
      <div>
        <h3 class="ai-runtime-summary__title">{{ title }}</h3>
        <p class="muted ai-runtime-summary__lead">
          {{ overview.lead }}
        </p>
      </div>
      <span
        class="tag"
        :class="runtimeStateClass(overview.state)"
      >
        {{ runtimeStateLabel(overview.state) }}
      </span>
    </div>

    <p
      v-if="showHubLink"
      class="ai-runtime-summary__hub-link muted"
    >
      完整运行态与队列观测见
      <RouterLink :to="aiConfigSectionPath('runtime')">AI配置</RouterLink>。
    </p>

    <div
      v-if="groups.some((item) => item.total)"
      class="ai-runtime-summary__grid"
    >
      <div
        v-for="group in groups.filter((item) => item.total)"
        :key="group.id"
        class="ai-runtime-summary__card"
      >
        <div class="ai-runtime-summary__card-head">
          <strong>{{ group.title }}</strong>
          <span
            class="tag"
            :class="runtimeStateClass(group.state)"
          >
            {{ runtimeStateLabel(group.state) }}
          </span>
        </div>
        <div class="muted ai-runtime-summary__card-lead">
          {{ group.lead }}
        </div>
        <div class="ai-runtime-summary__chips">
          <span
            v-for="item in group.items"
            :key="item.capabilityId"
            class="ai-runtime-summary__chip"
          >
            {{ item.title }}
          </span>
        </div>
      </div>
    </div>
    <p
      v-else
      class="muted ai-runtime-summary__empty"
    >
      {{ emptyText }}
    </p>
  </div>
</template>

<style scoped>
.ai-runtime-summary {
  padding: 14px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-card) 92%, white 8%), var(--bg-card));
}

.ai-runtime-summary__head,
.ai-runtime-summary__card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ai-runtime-summary__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.ai-runtime-summary__lead {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
}

.ai-runtime-summary__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.ai-runtime-summary__card {
  padding: 12px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-card) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--text) 6%, transparent);
}

.ai-runtime-summary__card-lead {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
}

.ai-runtime-summary__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.ai-runtime-summary__chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.ai-runtime-summary__empty {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.6;
}

.ai-runtime-summary--compact {
  padding: 12px;
}

.ai-runtime-summary--compact .ai-runtime-summary__title {
  font-size: 14px;
}

@media (max-width: 560px) {
  .ai-runtime-summary__head,
  .ai-runtime-summary__card-head {
    flex-direction: column;
  }

  .ai-runtime-summary__grid {
    grid-template-columns: 1fr;
  }
}
</style>
