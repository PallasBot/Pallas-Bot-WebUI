<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AiConfigConnectionSection from "@/components/ai-config/AiConfigConnectionSection.vue";
import AiConfigKnowledgeSection from "@/components/ai-config/AiConfigKnowledgeSection.vue";
import AiConfigLogsSection from "@/components/ai-config/AiConfigLogsSection.vue";
import AiConfigModelSection from "@/components/ai-config/AiConfigModelSection.vue";
import AiConfigNcmSection from "@/components/ai-config/AiConfigNcmSection.vue";
import AiConfigPersonaSection from "@/components/ai-config/AiConfigPersonaSection.vue";
import AiConfigRuntimeSection from "@/components/ai-config/AiConfigRuntimeSection.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
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
  () => (route.name === "ai" ? route.params.section : null),
  (raw) => {
    if (raw === null) return;
    const id = typeof raw === "string" ? raw.trim() : "";
    if (id && normalizeAiConfigSection(id) === id) return;
    void router.replace(aiConfigSectionPath("runtime"));
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

      <nav
        class="ai-config-page__tabs console-hub-page__tab-group"
        role="tablist"
        aria-label="AI 配置分区"
      >
        <button
          v-for="sec in AI_CONFIG_SECTIONS"
          :key="sec.id"
          type="button"
          role="tab"
          class="console-hub-page__tab-btn ai-config-page__tab-btn"
          :class="{ 'is-on': activeSection === sec.id }"
          :aria-selected="activeSection === sec.id"
          @click="selectSection(sec.id)"
        >
          {{ sec.label }}
        </button>
      </nav>

      <p
        class="ai-config-page__section-lead muted"
        role="status"
      >
        {{ sectionMeta.lead }}
      </p>

      <div class="ai-config-page__content">
        <AiConfigModelSection
          v-if="activeSection === 'model'"
          ref="modelSectionRef"
        />
        <AiConfigRuntimeSection v-else-if="activeSection === 'runtime'" />
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
</template>
