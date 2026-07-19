<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import AiConfigCapabilitiesSection from "@/components/ai-config/AiConfigCapabilitiesSection.vue";
import AiConfigConnectionSection from "@/components/ai-config/AiConfigConnectionSection.vue";
import AiConfigDrawSection from "@/components/ai-config/AiConfigDrawSection.vue";
import AiConfigKnowledgeSection from "@/components/ai-config/AiConfigKnowledgeSection.vue";
import AiConfigLogsSection from "@/components/ai-config/AiConfigLogsSection.vue";
import AiConfigNcmSection from "@/components/ai-config/AiConfigNcmSection.vue";
import AiConfigProviderSection from "@/components/ai-config/AiConfigProviderSection.vue";
import AiConfigStrategySection from "@/components/ai-config/AiConfigStrategySection.vue";
import AiConfigSetupGuide from "@/components/ai-config/AiConfigSetupGuide.vue";
import AiConfigExpertModeToggle from "@/components/ai-config/AiConfigExpertModeToggle.vue";
import AiConfigProfilePicker from "@/components/ai-config/AiConfigProfilePicker.vue";
import AiConfigHealthFlow from "@/components/ai-config/AiConfigHealthFlow.vue";
import AiWizardChecklist from "@/components/ai-config/AiWizardChecklist.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import UiButton from "@/components/ui/UiButton.vue";
import {
  AI_CONFIG_HUB_LEAD,
  AI_CONFIG_MORE_NAV_ITEM,
  SIMPLE_AI_CONFIG_NAV_SECTION_IDS,
  aiConfigSectionMeta,
  aiConfigSectionPath,
  aiConfigSectionsByGroup,
  normalizeAiConfigSection,
  type AiConfigSectionDef,
  type AiConfigSectionId,
} from "@/config/aiConfigSections";
import { AI_CONFIG_WIZARD_PATH } from "@/config/aiSetupGuide";
import { AI_OBSERVATION_SIDEBAR_PATH } from "@/config/aiObservationNav";
import { useAiConfigExpertMode } from "@/composables/useAiConfigExpertMode";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { useSaveHotkey } from "@/composables/useSaveHotkey";

const route = useRoute();
const router = useRouter();
const panelNavIcon = usePanelNavIcon();
const pageReady = ref(false);
const navGroups = aiConfigSectionsByGroup();
const { isSimpleMode, setExpertMode } = useAiConfigExpertMode();

const SIMPLE_SECTION_IDS = new Set<string>(SIMPLE_AI_CONFIG_NAV_SECTION_IDS);

const visibleSections = computed((): AiConfigSectionDef[] => {
  if (!isSimpleMode.value) {
    return navGroups.flatMap((row) => row.sections);
  }
  return navGroups
    .flatMap((row) => row.sections)
    .filter((sec) => SIMPLE_SECTION_IDS.has(sec.id));
});

const providerSectionRef = ref<InstanceType<typeof AiConfigProviderSection> | null>(null);
const strategySectionRef = ref<InstanceType<typeof AiConfigStrategySection> | null>(null);
const knowledgeSectionRef = ref<InstanceType<typeof AiConfigKnowledgeSection> | null>(null);
const connectionSectionRef = ref<InstanceType<typeof AiConfigConnectionSection> | null>(null);

const activeSection = computed((): AiConfigSectionId =>
  normalizeAiConfigSection(route.params.section),
);

const sectionMeta = computed(() => aiConfigSectionMeta(activeSection.value));

watch(
  () => (route.name === "ai-config" ? route.params.section : null),
  (raw) => {
    if (raw === null) return;
    const id = typeof raw === "string" ? raw.trim() : "";
    if (id && normalizeAiConfigSection(id) === id) return;
    void router.replace(aiConfigSectionPath(normalizeAiConfigSection(id)));
  },
  { immediate: true },
);

watch(
  [isSimpleMode, activeSection],
  ([simple, section]) => {
    if (simple && !SIMPLE_SECTION_IDS.has(section)) {
      void router.replace(aiConfigSectionPath("provider"));
    }
  },
  { immediate: true },
);

function selectSection(id: AiConfigSectionId) {
  if (id === activeSection.value) return;
  void router.push(aiConfigSectionPath(id));
}

function showMoreSections() {
  setExpertMode(true);
  void router.push(aiConfigSectionPath(AI_CONFIG_MORE_NAV_ITEM.targetSectionId));
}

useSaveHotkey(
  () => {
    if (activeSection.value === "provider") return providerSectionRef.value?.canSave?.() ?? false;
    if (activeSection.value === "strategy") return strategySectionRef.value?.canSave?.() ?? false;
    if (activeSection.value === "knowledge") return knowledgeSectionRef.value?.canSave?.() ?? false;
    if (activeSection.value === "connection") return connectionSectionRef.value?.canSave?.() ?? false;
    return false;
  },
  () => {
    if (activeSection.value === "provider") void providerSectionRef.value?.save?.();
    else if (activeSection.value === "strategy") void strategySectionRef.value?.save?.();
    else if (activeSection.value === "knowledge") void knowledgeSectionRef.value?.save?.();
    else if (activeSection.value === "connection") void connectionSectionRef.value?.save?.();
  },
);

onMounted(() => {
  pageReady.value = true;
});
</script>

<template>
  <div class="console-hub-page ai-config-page">
    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="2"
    />
    <div
      v-else
      class="ai-config-page__body"
    >
      <ConsoleHubMasthead :icon="panelNavIcon">
        <template #title>
          AI 配置
        </template>
        <template #lead>
          {{ AI_CONFIG_HUB_LEAD }}
        </template>
        <template #actions>
          <RouterLink :to="AI_CONFIG_WIZARD_PATH">
            <UiButton variant="outline">体检向导</UiButton>
          </RouterLink>
          <RouterLink :to="AI_OBSERVATION_SIDEBAR_PATH">
            <UiButton variant="ghost">AI 观测</UiButton>
          </RouterLink>
        </template>
      </ConsoleHubMasthead>

      <AiConfigExpertModeToggle />

      <details class="ai-config-page__diagnostics">
        <summary class="ai-config-page__diagnostics-summary">
          <span>
            <strong>诊断</strong>
            <span class="muted">体检、配置画像与入门检查</span>
          </span>
          <span
            class="ai-config-page__diagnostics-caret"
            aria-hidden="true"
          >v</span>
        </summary>
        <div class="ai-config-page__diagnostics-body">
          <AiConfigHealthFlow />
          <AiWizardChecklist />
          <AiConfigProfilePicker />
          <AiConfigSetupGuide />
        </div>
      </details>

      <nav
        class="console-view-toggle console-view-toggle--full ai-config-page__tabs"
        role="tablist"
        aria-label="AI 配置分区"
      >
        <button
          v-for="sec in visibleSections"
          :key="sec.id"
          type="button"
          role="tab"
          :class="{ 'is-on': activeSection === sec.id }"
          :aria-selected="activeSection === sec.id"
          :title="sec.lead"
          @click="selectSection(sec.id)"
        >
          <ConsoleNavIcon
            :name="sec.icon"
            :size="16"
          />
          <span>{{ sec.label }}</span>
        </button>
        <button
          v-if="isSimpleMode"
          type="button"
          role="tab"
          class="ai-config-page__tabs-more"
          aria-selected="false"
          :title="AI_CONFIG_MORE_NAV_ITEM.lead"
          @click="showMoreSections"
        >
          <ConsoleNavIcon
            :name="AI_CONFIG_MORE_NAV_ITEM.icon"
            :size="16"
          />
          <span>{{ AI_CONFIG_MORE_NAV_ITEM.label }}</span>
        </button>
      </nav>

      <div class="ai-config-page__detail">
        <p
          class="ai-config-page__section-lead muted"
          role="status"
        >
          {{ sectionMeta.lead }}
        </p>

        <div class="ai-config-page__content">
          <AiConfigProviderSection
            v-if="activeSection === 'provider'"
            :key="isSimpleMode ? 'simple' : 'expert'"
            ref="providerSectionRef"
          />
          <AiConfigStrategySection
            v-else-if="activeSection === 'strategy'"
            ref="strategySectionRef"
          />
          <AiConfigConnectionSection
            v-else-if="activeSection === 'connection'"
            ref="connectionSectionRef"
          />
          <AiConfigCapabilitiesSection v-else-if="activeSection === 'capabilities'" />
          <AiConfigDrawSection v-else-if="activeSection === 'draw'" />
          <AiConfigKnowledgeSection
            v-else-if="activeSection === 'knowledge'"
            ref="knowledgeSectionRef"
          />
          <AiConfigNcmSection v-else-if="activeSection === 'ncm'" />
          <AiConfigLogsSection v-else-if="activeSection === 'logs'" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-config-page__body {
  display: grid;
  gap: var(--hub-page-gap, 18px);
}

.ai-config-page__diagnostics {
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
}

.ai-config-page__diagnostics-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  list-style: none;
}

.ai-config-page__diagnostics-summary::-webkit-details-marker {
  display: none;
}

.ai-config-page__diagnostics-summary > span:first-child {
  display: grid;
  gap: 2px;
}

.ai-config-page__diagnostics-caret {
  color: var(--text-muted);
  transition: transform 0.18s ease;
}

.ai-config-page__diagnostics[open] .ai-config-page__diagnostics-caret {
  transform: rotate(180deg);
}

.ai-config-page__diagnostics-body {
  display: grid;
  gap: var(--hub-page-gap, 18px);
  padding: 0 14px 14px;
}

.ai-config-page__tabs {
  gap: 4px;
}

.ai-config-page__tabs button :deep(.console-nav-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  line-height: 0;
}

.ai-config-page__tabs button :deep(.console-nav-icon__svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.ai-config-page__tabs-more {
  opacity: 0.92;
}

.ai-config-page__detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.ai-config-page__section-lead {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
}

@media (max-width: 560px) {
  .ai-config-page__tabs button {
    min-width: calc(33.33% - 4px);
  }
}
</style>
