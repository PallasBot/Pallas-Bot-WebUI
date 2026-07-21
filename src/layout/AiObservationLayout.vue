<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import PageChrome from "@/components/PageChrome.vue";
import PagePinned from "@/components/PagePinned.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import UiButton from "@/components/ui/UiButton.vue";
import { provideAiObservationRefresh } from "@/composables/useAiObservationRefresh";
import { AI_CONFIG_SIDEBAR_PATH } from "@/config/aiConfigSections";
import { AI_OBSERVATION_TABS } from "@/config/aiObservationNav";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const route = useRoute();
const panelNavIcon = usePanelNavIcon();
const observationRefresh = provideAiObservationRefresh();
const { mastheadBusy, trigger } = observationRefresh;

const activeTab = computed(() =>
  AI_OBSERVATION_TABS.find((tab) => tab.routeName === route.name) ?? AI_OBSERVATION_TABS[0],
);
</script>

<template>
  <div class="console-hub-page ai-surface ai-observation-layout">
    <PagePinned>
      <PageChrome
        :icon="panelNavIcon"
        title="AI 观测"
        :lead="activeTab.lead"
      >
        <template #actions>
          <RefreshIconButton
            embedded
            :show-label="false"
            :busy="mastheadBusy"
            label="刷新"
            @click="trigger()"
          />
          <RouterLink :to="AI_CONFIG_SIDEBAR_PATH">
            <UiButton variant="primary">AI 配置</UiButton>
          </RouterLink>
          <RouterLink to="/ai/wizard">
            <UiButton variant="ghost">体检向导</UiButton>
          </RouterLink>
        </template>
      </PageChrome>

      <nav
        class="ai-observation-layout__tabs"
        aria-label="AI 观测分区"
      >
        <div
          class="console-view-toggle console-view-toggle--full"
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
              <ConsoleNavIcon
                :name="tab.icon"
                :size="16"
              />
              <span>{{ tab.label }}</span>
            </button>
          </RouterLink>
        </div>
      </nav>
    </PagePinned>

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
  flex: 1 1 auto;
  min-height: 0;
}

.ai-observation-layout__tabs {
  display: block;
  width: 100%;
  flex: 0 0 auto;
}

.ai-observation-layout__body {
  min-width: 0;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ai-observation-layout__tab {
  font-family: var(--font-sans);
}

@media (max-width: 560px) {
  .ai-observation-layout__tabs .console-view-toggle {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .ai-observation-layout__tabs .console-view-toggle button {
    white-space: nowrap;
  }
}
</style>
