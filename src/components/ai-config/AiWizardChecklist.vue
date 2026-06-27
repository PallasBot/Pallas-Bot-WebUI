<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { fetchLlmWizardStatus } from "@/api/consoleApi";
import type { LlmWizardStatusData } from "@/api/pallasTypes";
import UiButton from "@/components/ui/UiButton.vue";
import { AI_CONFIG_WIZARD_PATH } from "@/config/aiSetupGuide";
import { AI_WIZARD_CHECKLIST_DISMISS_KEY, wizardActionForCheckId } from "@/config/aiWizardGuide";

const props = withDefaults(
  defineProps<{
    compact?: boolean;
    checkIds?: string[];
    title?: string;
    dismissible?: boolean;
  }>(),
  {
    compact: false,
    checkIds: undefined,
    title: "接通自检",
    dismissible: true,
  },
);

const loading = ref(false);
const err = ref("");
const wizardStatus = ref<LlmWizardStatusData | null>(null);
const dismissed = ref(
  props.dismissible && typeof localStorage !== "undefined"
    && localStorage.getItem(AI_WIZARD_CHECKLIST_DISMISS_KEY) === "1",
);

const checkRows = computed(() => {
  const rows = wizardStatus.value?.checks ?? [];
  const allowed = props.checkIds?.length ? new Set(props.checkIds) : null;
  return rows
    .filter((row) => !allowed || allowed.has(row.id))
    .map((row) => ({
      ...row,
      action: wizardActionForCheckId(row.id),
    }));
});

const failedRows = computed(() => checkRows.value.filter((row) => !row.ok));
const allPassed = computed(() => checkRows.value.length > 0 && failedRows.value.length === 0);

async function refresh() {
  loading.value = true;
  err.value = "";
  try {
    wizardStatus.value = await fetchLlmWizardStatus();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    wizardStatus.value = null;
  } finally {
    loading.value = false;
  }
}

function dismissChecklist() {
  dismissed.value = true;
  localStorage.setItem(AI_WIZARD_CHECKLIST_DISMISS_KEY, "1");
}

function restoreChecklist() {
  dismissed.value = false;
  localStorage.removeItem(AI_WIZARD_CHECKLIST_DISMISS_KEY);
  void refresh();
}

onMounted(() => {
  if (!dismissed.value) {
    void refresh();
  }
});

defineExpose({ refresh, allPassed, failedRows, dismissed, restoreChecklist });
</script>

<template>
  <p
    v-if="dismissible && dismissed"
    class="muted ai-wizard-checklist__collapsed"
  >
    已收起接通自检。
    <button type="button" class="ai-wizard-checklist__restore" @click="restoreChecklist">
      再次显示
    </button>
    <span class="ai-wizard-checklist__collapsed-sep">·</span>
    <RouterLink :to="AI_CONFIG_WIZARD_PATH" class="ai-wizard-checklist__restore">
      打开完整体检
    </RouterLink>
  </p>
  <section
    v-else
    class="ai-wizard-checklist"
    :class="{ 'ai-wizard-checklist--compact': compact, 'is-ok': allPassed }"
    aria-label="AI 体检清单"
  >
    <div class="ai-wizard-checklist__head">
      <div>
        <h3 class="ai-wizard-checklist__title">{{ title }}</h3>
        <p v-if="allPassed" class="muted ai-wizard-checklist__lead">各项已通过，可去 AI 历史验证回复效果。</p>
        <p v-else-if="wizardStatus?.next_step" class="muted ai-wizard-checklist__lead">
          建议优先：{{ wizardStatus.next_step }}
        </p>
      </div>
      <div class="row-actions ai-wizard-checklist__actions">
        <UiButton size="sm" variant="ghost" :busy="loading" @click="refresh">刷新</UiButton>
        <RouterLink :to="AI_CONFIG_WIZARD_PATH">
          <UiButton size="sm" variant="outline">完整体检</UiButton>
        </RouterLink>
        <UiButton
          v-if="dismissible"
          size="sm"
          variant="ghost"
          @click="dismissChecklist"
        >
          关闭
        </UiButton>
      </div>
    </div>
    <div v-if="err" class="alert alert--err">{{ err }}</div>
    <ul v-else class="ai-wizard-checklist__list">
      <li
        v-for="row in checkRows"
        :key="row.id"
        class="ai-wizard-checklist__item"
        :class="{ 'is-fail': !row.ok, 'is-pass': row.ok }"
      >
        <div class="ai-wizard-checklist__item-main">
          <span class="ai-wizard-checklist__status">{{ row.ok ? "✓" : "!" }}</span>
          <div class="ai-wizard-checklist__item-copy">
            <strong>{{ row.label }}</strong>
            <span v-if="!compact && row.detail" class="muted">{{ row.detail }}</span>
          </div>
        </div>
        <RouterLink v-if="!row.ok" :to="row.action.to">
          <UiButton size="sm" variant="outline">{{ row.action.label }}</UiButton>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.ai-wizard-checklist {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--text) 2.5%, transparent);
}

.ai-wizard-checklist.is-ok {
  border-color: color-mix(in srgb, var(--ok, #22c55e) 35%, var(--border));
}

.ai-wizard-checklist__collapsed {
  margin: 0;
  font-size: 0.82rem;
}

.ai-wizard-checklist__restore {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  text-decoration: none;
}

.ai-wizard-checklist__restore:hover {
  text-decoration: underline;
}

.ai-wizard-checklist__collapsed-sep {
  margin: 0 4px;
  color: var(--text-muted);
}

.ai-wizard-checklist__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.ai-wizard-checklist__title {
  margin: 0 0 4px;
  font-size: 0.92rem;
}

.ai-wizard-checklist__lead {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
}

.ai-wizard-checklist__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.ai-wizard-checklist__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid transparent;
}

.ai-wizard-checklist__item.is-fail {
  border-color: color-mix(in srgb, var(--warn, #f59e0b) 40%, var(--border));
  background: color-mix(in srgb, var(--warn, #f59e0b) 8%, transparent);
}

.ai-wizard-checklist__item.is-pass {
  opacity: 0.88;
}

.ai-wizard-checklist__item-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.ai-wizard-checklist__item-copy {
  display: grid;
  gap: 2px;
  font-size: 0.82rem;
}

.ai-wizard-checklist__status {
  width: 1.1rem;
  font-weight: 700;
  flex-shrink: 0;
}

.ai-wizard-checklist--compact .ai-wizard-checklist__item-copy span {
  display: none;
}

@media (max-width: 560px) {
  .ai-wizard-checklist__head {
    flex-direction: column;
  }

  .ai-wizard-checklist__actions {
    width: 100%;
  }

  .ai-wizard-checklist__actions :deep(.btn) {
    flex: 1 1 auto;
  }

  .ai-wizard-checklist__item {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
