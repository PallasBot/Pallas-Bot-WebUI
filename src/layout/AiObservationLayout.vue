<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import UiButton from "@/components/ui/UiButton.vue";
import { AI_CONFIG_SIDEBAR_PATH } from "@/config/aiConfigSections";
import { AI_OBSERVATION_TABS } from "@/config/aiObservationNav";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const route = useRoute();
const panelNavIcon = usePanelNavIcon();

const activeTab = computed(() =>
  AI_OBSERVATION_TABS.find((tab) => tab.routeName === route.name) ?? AI_OBSERVATION_TABS[0],
);
</script>

<template>
  <div class="console-hub-page ai-surface ai-observation-layout">
    <ConsoleHubMasthead :icon="panelNavIcon">
      <template #title>
        AI 观测
      </template>
      <template #lead>
        {{ activeTab.lead }}
      </template>
      <template #actions>
        <RouterLink :to="AI_CONFIG_SIDEBAR_PATH">
          <UiButton variant="primary">AI 配置</UiButton>
        </RouterLink>
        <RouterLink to="/ai/wizard">
          <UiButton variant="ghost">体检向导</UiButton>
        </RouterLink>
      </template>
    </ConsoleHubMasthead>

    <nav
      class="ai-observation-layout__tabs"
      aria-label="AI 观测分区"
    >
      <div
        class="console-view-toggle"
        role="tablist"
      >
        <RouterLink
          v-for="tab in AI_OBSERVATION_TABS"
          :key="tab.id"
          v-slot="{ navigate, isActive }"
          :to="tab.path"
          custom
        >
          <button
            type="button"
            role="tab"
            class="ai-observation-layout__tab"
            :class="{ 'is-on': isActive }"
            :aria-selected="isActive"
            @click="navigate"
          >
            {{ tab.label }}
          </button>
        </RouterLink>
      </div>
    </nav>

    <div class="ai-observation-layout__body">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.ai-observation-layout {
  display: flex;
  flex-direction: column;
  gap: var(--hub-page-gap, 18px);
}

.ai-observation-layout__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.ai-observation-layout__tab {
  font-family: var(--font-sans);
}

@media (max-width: 560px) {
  .ai-observation-layout__tabs .console-view-toggle {
    display: flex;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .ai-observation-layout__tabs .console-view-toggle button {
    flex: 1 1 auto;
    min-width: 4.5rem;
    white-space: nowrap;
  }
}
</style>
