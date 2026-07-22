<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
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
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PageChrome from "@/components/PageChrome.vue";
import PagePinned from "@/components/PagePinned.vue";
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
import { useAiNavGate } from "@/composables/useAiNavGate";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import { searchAiConfigTargets, type AiConfigSearchHit } from "@/utils/aiConfigSearch";

const route = useRoute();
const router = useRouter();
const panelNavIcon = usePanelNavIcon();
const pageReady = ref(false);
const configSearch = ref("");
const navGroups = aiConfigSectionsByGroup();
const { isSimpleMode, setExpertMode } = useAiConfigExpertMode();
const { essentialsOnly } = useAiNavGate();

const SIMPLE_SECTION_IDS = new Set<string>(SIMPLE_AI_CONFIG_NAV_SECTION_IDS);

const visibleSections = computed((): AiConfigSectionDef[] => {
  if (essentialsOnly.value) {
    return navGroups.flatMap((row) => row.sections).filter((sec) => sec.id === "provider");
  }
  if (!isSimpleMode.value) {
    return navGroups.flatMap((row) => row.sections);
  }
  return navGroups
    .flatMap((row) => row.sections)
    .filter((sec) => SIMPLE_SECTION_IDS.has(sec.id));
});

const railGroups = computed(() => {
  if (essentialsOnly.value || isSimpleMode.value) {
    const sections = visibleSections.value;
    return sections.length
      ? [{ group: { id: "simple", label: essentialsOnly.value ? "接入" : "常用" }, sections }]
      : [];
  }
  return navGroups;
});

const searchHits = computed((): AiConfigSearchHit[] => searchAiConfigTargets(configSearch.value));

function openSearchHit(hit: AiConfigSearchHit) {
  configSearch.value = "";
  const [path, hash] = hit.path.split("#");
  void router.push(path).then(() => {
    if (hash) {
      void nextTick(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  });
}

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
  [isSimpleMode, essentialsOnly, activeSection],
  ([simple, essentials, section]) => {
    if (essentials && section !== "provider") {
      void router.replace(aiConfigSectionPath("provider"));
      return;
    }
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
    <template v-else>
      <PagePinned>
        <PageChrome
          :icon="panelNavIcon"
          title="AI 配置"
          :lead="AI_CONFIG_HUB_LEAD"
        >
          <template #actions>
            <RouterLink :to="AI_CONFIG_WIZARD_PATH">
              <UiButton variant="outline">体检向导</UiButton>
            </RouterLink>
            <RouterLink :to="AI_OBSERVATION_SIDEBAR_PATH">
              <UiButton variant="ghost">AI 观测</UiButton>
            </RouterLink>
          </template>
        </PageChrome>

        <AiConfigExpertModeToggle v-if="!essentialsOnly" />
      </PagePinned>

      <div class="ai-config-page__body">
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

        <div class="ai-config-page__shell">
          <nav
            class="ai-config-page__rail"
            aria-label="AI 配置分区"
          >
            <label class="ai-config-page__rail-search">
              <span class="visually-hidden">搜索配置</span>
              <input
                v-model="configSearch"
                class="inp"
                type="search"
                placeholder="搜索分区或字段…"
                autocomplete="off"
              >
            </label>
            <div class="ai-config-page__rail-scroll">
              <div
                v-if="searchHits.length"
                class="ai-config-page__rail-hits"
              >
                <button
                  v-for="hit in searchHits"
                  :key="hit.path"
                  type="button"
                  class="ai-config-page__rail-item"
                  @click="openSearchHit(hit)"
                >
                  <span>{{ hit.label }}</span>
                  <span class="muted">{{ hit.kind === "field" ? "字段" : "分区" }}</span>
                </button>
              </div>
              <template v-else>
                <template
                  v-for="row in railGroups"
                  :key="row.group.id"
                >
                  <p
                    v-if="!isSimpleMode && !essentialsOnly"
                    class="ai-config-page__rail-group"
                  >
                    {{ row.group.label }}
                  </p>
                  <button
                    v-for="sec in row.sections"
                    :key="sec.id"
                    type="button"
                    class="ai-config-page__rail-item"
                    :class="{ 'is-on': activeSection === sec.id }"
                    :title="sec.lead"
                    @click="selectSection(sec.id)"
                  >
                    <ConsoleNavIcon
                      :name="sec.icon"
                      :size="16"
                    />
                    <span>{{ sec.label }}</span>
                  </button>
                </template>
                <button
                  v-if="isSimpleMode && !essentialsOnly"
                  type="button"
                  class="ai-config-page__rail-item ai-config-page__rail-item--more"
                  :title="AI_CONFIG_MORE_NAV_ITEM.lead"
                  @click="showMoreSections"
                >
                  <ConsoleNavIcon
                    :name="AI_CONFIG_MORE_NAV_ITEM.icon"
                    :size="16"
                  />
                  <span>{{ AI_CONFIG_MORE_NAV_ITEM.label }}</span>
                </button>
              </template>
            </div>
            <p
              v-if="essentialsOnly"
              class="muted ai-config-page__rail-gate"
            >
              扩展服务未就绪，仅显示接入配置。
            </p>
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

.ai-config-page__shell {
  display: grid;
  grid-template-columns: minmax(10.5rem, 12.5rem) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  min-width: 0;
}

.ai-config-page__rail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-radius: var(--hub-radius, 12px);
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--text) 2.5%, transparent);
  position: sticky;
  top: 0;
}

.ai-config-page__rail-search {
  display: block;
  flex-shrink: 0;
  width: 100%;
  min-width: 0;
  margin: 0 0 6px;
}

.ai-config-page__rail-search .inp {
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 34px;
  font-size: 0.8125rem;
}

.ai-config-page__rail-scroll {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ai-config-page__rail-hits {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 2px;
}

.ai-config-page__rail-hits .ai-config-page__rail-item {
  justify-content: space-between;
}

.ai-config-page__rail-gate {
  margin: 8px 8px 4px;
  font-size: 0.72rem;
  line-height: 1.4;
}

.ai-config-page__rail-group {
  margin: 8px 8px 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.ai-config-page__rail-group:first-child {
  margin-top: 2px;
}

.ai-config-page__rail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: calc(var(--hub-radius-control, 10px) - 2px);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.ai-config-page__rail-item:hover:not(.is-on) {
  color: var(--text);
  background: color-mix(in srgb, var(--text) 4%, transparent);
}

.ai-config-page__rail-item.is-on {
  color: var(--text);
  background: var(--surface-segment-active, color-mix(in srgb, var(--text) 8%, transparent));
  border-color: color-mix(in srgb, var(--border) 70%, transparent);
}

.ai-config-page__rail-item--more {
  opacity: 0.92;
}

.ai-config-page__rail-item :deep(.console-nav-icon) {
  display: inline-flex;
  flex-shrink: 0;
  line-height: 0;
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

@media (max-width: 860px) {
  .ai-config-page__shell {
    grid-template-columns: 1fr;
  }

  .ai-config-page__rail {
    position: static;
    flex-direction: column;
    gap: 8px;
    overflow: visible;
  }

  .ai-config-page__rail-search {
    margin-bottom: 0;
  }

  .ai-config-page__rail-scroll {
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2px;
  }

  .ai-config-page__rail-hits {
    flex-direction: row;
    flex-wrap: nowrap;
    margin-bottom: 0;
  }

  .ai-config-page__rail-group {
    display: none;
  }

  .ai-config-page__rail-item {
    flex: 0 0 auto;
    width: auto;
    white-space: nowrap;
  }

  .ai-config-page__rail-gate {
    margin: 0 2px;
  }
}
</style>
