<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import AiConfigConnectionSection from "@/components/ai-config/AiConfigConnectionSection.vue";
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
  aiConfigSectionMeta,
  aiConfigSectionPath,
  aiConfigSectionsByGroup,
  normalizeAiConfigSection,
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
const { isSimpleMode } = useAiConfigExpertMode();

const SIMPLE_SECTION_IDS = new Set(["provider", "strategy", "connection", "knowledge"]);

const visibleNavGroups = computed(() => {
  if (!isSimpleMode.value) return navGroups;
  return navGroups
    .map((row) => ({
      ...row,
      sections: row.sections.filter((sec) => SIMPLE_SECTION_IDS.has(sec.id)),
    }))
    .filter((row) => row.sections.length > 0);
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

      <AiConfigHealthFlow />
      <AiConfigExpertModeToggle />
      <AiWizardChecklist />
      <AiConfigProfilePicker />
      <AiConfigSetupGuide />

      <div class="ai-config-page__layout">
        <nav
          class="ai-config-page__rail"
          role="tablist"
          aria-label="AI 配置分区"
        >
          <div
            v-for="group in visibleNavGroups"
            :key="group.group.id"
            class="ai-config-page__rail-group"
          >
            <div class="ai-config-page__rail-group-label">
              {{ group.group.label }}
            </div>
            <button
              v-for="sec in group.sections"
              :key="sec.id"
              type="button"
              role="tab"
              class="ai-config-page__rail-item"
              :class="{ 'is-on': activeSection === sec.id }"
              :aria-selected="activeSection === sec.id"
              @click="selectSection(sec.id)"
            >
              <ConsoleNavIcon :name="sec.icon" :size="18" />
              <span class="ai-config-page__rail-text">
                <span class="ai-config-page__rail-label">{{ sec.label }}</span>
                <span class="ai-config-page__rail-lead">{{ sec.lead }}</span>
              </span>
            </button>
          </div>
        </nav>

        <div class="ai-config-page__detail">
          <header class="ai-config-page__detail-head">
            <ConsoleNavIcon :name="sectionMeta.icon" :size="20" />
            <div>
              <h2 class="ai-config-page__detail-title">{{ sectionMeta.label }}</h2>
              <p class="ai-config-page__section-lead muted" role="status">{{ sectionMeta.lead }}</p>
            </div>
          </header>

          <div class="ai-config-page__content">
            <AiConfigProviderSection
              v-if="activeSection === 'provider'"
              ref="providerSectionRef"
            />
            <AiConfigStrategySection
              v-else-if="activeSection === 'strategy'"
              ref="strategySectionRef"
            />
            <AiConfigKnowledgeSection
              v-else-if="activeSection === 'knowledge'"
              ref="knowledgeSectionRef"
            />
            <AiConfigConnectionSection
              v-else-if="activeSection === 'connection'"
              ref="connectionSectionRef"
            />
            <AiConfigNcmSection v-else-if="activeSection === 'ncm'" />
            <AiConfigLogsSection v-else-if="activeSection === 'logs'" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-config-page__layout {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: var(--hub-page-gap, 18px);
  align-items: start;
}

.ai-config-page__body {
  display: grid;
  gap: var(--hub-page-gap, 18px);
}

.ai-config-page__rail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: sticky;
  top: 16px;
}

.ai-config-page__rail-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-config-page__rail-group-label {
  padding: 0 12px;
  font-size: 0.68rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.ai-config-page__rail-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  text-align: left;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.ai-config-page__rail-item:hover {
  background: color-mix(in srgb, var(--text) 4%, transparent);
}

.ai-config-page__rail-item.is-on {
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.ai-config-page__rail-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ai-config-page__rail-label {
  font-weight: 600;
  font-size: 0.875rem;
}

.ai-config-page__rail-lead {
  font-size: 0.7rem;
  line-height: 1.35;
  color: var(--text-muted);
}

.ai-config-page__detail {
  display: flex;
  flex-direction: column;
  gap: var(--hub-page-gap, 18px);
  min-width: 0;
}

.ai-config-page__detail-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.ai-config-page__detail-title {
  margin: 0 0 2px;
  font-size: 1.05rem;
}

@media (max-width: 860px) {
  .ai-config-page__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-config-page__rail {
    position: static;
  }

  .ai-config-page__rail-group {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .ai-config-page__rail-group-label {
    flex: 0 0 100%;
    padding: 0 4px;
  }

  .ai-config-page__rail-item {
    flex: 1 1 auto;
    min-width: min(100%, 140px);
  }

  .ai-config-page__rail-lead {
    display: none;
  }
}
</style>
