<script setup lang="ts">
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import { useAiConfigExpertMode } from "@/composables/useAiConfigExpertMode";

const { expertMode, setExpertMode } = useAiConfigExpertMode();
</script>

<template>
  <label class="ai-config-expert-toggle">
    <span class="ai-config-expert-toggle__copy">
      <strong>专家模式</strong>
      <span class="muted ai-config-expert-toggle__hint">
        {{ expertMode ? "本页底部显示任务路由与多模型分流" : "简单模式：模型与 Provider 同页可改，高级路由请开专家模式" }}
      </span>
    </span>
    <ConsoleSwitch
      :model-value="expertMode"
      aria-label="专家模式"
      @update:model-value="setExpertMode"
    />
  </label>
</template>

<style scoped>
.ai-config-expert-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 3%, transparent);
}

.ai-config-expert-toggle__copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.ai-config-expert-toggle__hint {
  font-size: 0.76rem;
  line-height: 1.35;
}

@media (max-width: 560px) {
  .ai-config-expert-toggle {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
