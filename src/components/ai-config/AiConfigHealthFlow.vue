<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { fetchLlmWizardStatus } from "@/api/consoleApi";
import type { LlmWizardStatusData } from "@/api/pallasTypes";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { AI_CONFIG_WIZARD_PATH } from "@/config/aiSetupGuide";
import { wizardActionForCheckId } from "@/config/aiWizardGuide";

const wizardStatus = ref<LlmWizardStatusData | null>(null);

const firstFailedCheck = computed(() => (wizardStatus.value?.checks ?? []).find((row) => !row.ok) ?? null);

const changeTarget = computed(() => {
  const failed = firstFailedCheck.value;
  if (!failed) {
    return {
      label: "微调策略",
      to: `${aiConfigSectionPath("strategy")}#learning-loop`,
      detail: "接通已完成，可在策略页或历史里继续优化。",
    };
  }
  const action = wizardActionForCheckId(failed.id);
  return {
    label: action.label,
    to: action.to,
    detail: failed.label,
  };
});

onMounted(() => {
  void fetchLlmWizardStatus().then((data) => {
    wizardStatus.value = data;
  }).catch(() => {
    wizardStatus.value = null;
  });
});
</script>

<template>
  <nav class="ai-config-health-flow" aria-label="健康—修改—验证">
    <RouterLink :to="AI_CONFIG_WIZARD_PATH" class="ai-config-health-flow__step">
      <span class="ai-config-health-flow__index">1</span>
      <span class="ai-config-health-flow__copy">
        <strong>体检</strong>
        <span class="muted">连通与开关</span>
      </span>
    </RouterLink>
    <span class="ai-config-health-flow__sep" aria-hidden="true">→</span>
    <RouterLink :to="changeTarget.to" class="ai-config-health-flow__step">
      <span class="ai-config-health-flow__index">2</span>
      <span class="ai-config-health-flow__copy">
        <strong>{{ changeTarget.label }}</strong>
        <span class="muted">{{ changeTarget.detail }}</span>
      </span>
    </RouterLink>
    <span class="ai-config-health-flow__sep" aria-hidden="true">→</span>
    <RouterLink to="/ai/history?workspace=sessions" class="ai-config-health-flow__step">
      <span class="ai-config-health-flow__index">3</span>
      <span class="ai-config-health-flow__copy">
        <strong>历史验证</strong>
        <span class="muted">排除 / 填期望回复</span>
      </span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.ai-config-health-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
}

.ai-config-health-flow__step {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  background: color-mix(in srgb, var(--text) 2.5%, transparent);
}

.ai-config-health-flow__step:hover {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}

.ai-config-health-flow__index {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 0.72rem;
  font-weight: 700;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  flex-shrink: 0;
}

.ai-config-health-flow__copy {
  display: grid;
  gap: 2px;
  min-width: 0;
  font-size: 0.78rem;
}

.ai-config-health-flow__copy strong {
  font-size: 0.84rem;
}

.ai-config-health-flow__sep {
  display: grid;
  place-items: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}

@media (max-width: 560px) {
  .ai-config-health-flow {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-config-health-flow__sep {
    display: none;
  }
}
</style>
