<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AiConfigConnectionSection from "@/components/ai-config/AiConfigConnectionSection.vue";
import AiConfigKnowledgeSection from "@/components/ai-config/AiConfigKnowledgeSection.vue";
import AiConfigLogsSection from "@/components/ai-config/AiConfigLogsSection.vue";
import AiConfigModelSection from "@/components/ai-config/AiConfigModelSection.vue";
import AiConfigNcmSection from "@/components/ai-config/AiConfigNcmSection.vue";
import AiConfigPersonaSection from "@/components/ai-config/AiConfigPersonaSection.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import {
  AI_CONFIG_HUB_LEAD,
  AI_CONFIG_SECTIONS,
  aiConfigSectionMeta,
  aiConfigSectionPath,
  normalizeAiConfigSection,
  type AiConfigSectionId,
} from "@/config/aiConfigSections";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { useSaveHotkey } from "@/composables/useSaveHotkey";

const route = useRoute();
const router = useRouter();
const panelNavIcon = usePanelNavIcon();
const pageReady = ref(false);

const modelSectionRef = ref<InstanceType<typeof AiConfigModelSection> | null>(null);
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
    void router.replace(aiConfigSectionPath("model"));
  },
  { immediate: true },
);

function selectSection(id: AiConfigSectionId) {
  if (id === activeSection.value) return;
  void router.push(aiConfigSectionPath(id));
}

useSaveHotkey(
  () => {
    if (activeSection.value === "model") return modelSectionRef.value?.canSave?.() ?? false;
    if (activeSection.value === "knowledge") return knowledgeSectionRef.value?.canSave?.() ?? false;
    if (activeSection.value === "connection") return connectionSectionRef.value?.canSave?.() ?? false;
    return false;
  },
  () => {
    if (activeSection.value === "model") void modelSectionRef.value?.save?.();
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
          AI配置
        </template>
        <template #lead>
          {{ AI_CONFIG_HUB_LEAD }}
        </template>
      </ConsoleHubMasthead>

      <div class="ai-config-page__layout">
        <nav
          class="ai-config-page__rail"
          role="tablist"
          aria-label="AI 配置分区"
        >
          <button
            v-for="sec in AI_CONFIG_SECTIONS"
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
            <AiConfigModelSection
              v-if="activeSection === 'model'"
              ref="modelSectionRef"
            />
            <AiConfigPersonaSection v-else-if="activeSection === 'persona'" />
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

.ai-config-page__rail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: sticky;
  top: 16px;
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
    flex-direction: row;
    flex-wrap: wrap;
  }

  .ai-config-page__rail-item {
    flex: 1 1 auto;
  }

  .ai-config-page__rail-lead {
    display: none;
  }
}
</style>
