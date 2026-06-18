<script setup lang="ts">
import { computed } from "vue";
import type { PluginConfigCheckResult } from "@/api/pallasTypes";
import type { AiRuntimeState } from "@/config/aiRuntimeRegistry";
import { resolveAiRuntimeSnapshot } from "@/utils/aiRuntimeResolver";

const props = defineProps<{
  results: PluginConfigCheckResult["results"];
}>();

function runtimeBadgeLabel(state: AiRuntimeState): string {
  if (state === "healthy") return "正常";
  if (state === "degraded") return "降级";
  if (state === "disabled") return "未启用";
  return "待确认";
}

function runtimeBadgeClass(state: AiRuntimeState): string {
  if (state === "healthy") return "tag--ok";
  if (state === "degraded") return "tag--warn";
  return "tag--muted";
}

const runtimeItems = computed(() =>
  resolveAiRuntimeSnapshot({
    gatewayResults: props.results.filter((row) => row.runtime_state || row.runtime_detail),
    extensionTest: null,
  }),
);
</script>

<template>
  <div
    v-if="runtimeItems.length"
    class="runtime-check-results"
  >
    <div
      v-for="item in runtimeItems"
      :key="item.capabilityId"
      class="runtime-check-results__card"
    >
      <div class="runtime-check-results__head">
        <div class="runtime-check-results__title-wrap">
          <strong>{{ item.title }}</strong>
          <span class="muted runtime-check-results__meta">{{ item.groupTitle }}</span>
        </div>
        <span
          class="tag"
          :class="runtimeBadgeClass(item.state)"
          :title="item.statusTitle"
        >
          {{ runtimeBadgeLabel(item.state) }}
        </span>
      </div>
      <div class="muted runtime-check-results__detail">
        {{ item.detail }}
      </div>
      <div
        v-if="item.sources.length"
        class="muted runtime-check-results__source"
      >
        来源：{{ item.sources[0].category || "服务" }} / {{ item.sources[0].site }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.runtime-check-results {
  display: grid;
  gap: 12px;
}

.runtime-check-results__card {
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  border-radius: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-card) 92%, white 8%), var(--bg-card));
}

.runtime-check-results__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.runtime-check-results__title-wrap {
  min-width: 0;
}

.runtime-check-results__meta,
.runtime-check-results__source {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}

.runtime-check-results__detail {
  margin-top: 8px;
  line-height: 1.6;
  font-size: 13px;
}
</style>
