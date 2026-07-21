<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

export type AiHistoryWorkspaceTab = {
  label: string;
  value: string;
  icon: ConsoleNavIconId;
};

const modelValue = defineModel<string>({ required: true });

defineProps<{
  tabs: ReadonlyArray<AiHistoryWorkspaceTab>;
  badges?: Readonly<Record<string, number>>;
}>();
</script>

<template>
  <nav
    class="ai-history-page__workspace-tabs"
    aria-label="AI 历史工作区"
  >
    <div
      class="console-view-toggle console-view-toggle--full"
      role="tablist"
    >
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        class="ai-history-page__workspace-tab"
        :class="{ 'is-on': modelValue === tab.value }"
        :aria-selected="modelValue === tab.value"
        @click="modelValue = tab.value"
      >
        <ConsoleNavIcon
          :name="tab.icon"
          :size="16"
        />
        <span>{{ tab.label }}</span>
        <span
          v-if="(badges?.[tab.value] ?? 0) > 0"
          class="ai-history-page__workspace-badge"
        >
          {{ badges?.[tab.value] }}
        </span>
      </button>
    </div>
  </nav>
</template>
