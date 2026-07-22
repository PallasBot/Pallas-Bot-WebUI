<script setup lang="ts">
import { useAiConfigExpertMode } from "@/composables/useAiConfigExpertMode";

const { expertMode, setExpertMode } = useAiConfigExpertMode();
</script>

<template>
  <div
    class="ai-config-expert-toggle console-view-toggle"
    role="group"
    aria-label="配置模式"
  >
    <button
      type="button"
      :class="{ 'is-on': !expertMode }"
      @click="setExpertMode(false)"
    >
      简单
    </button>
    <button
      type="button"
      :class="{ 'is-on': expertMode }"
      @click="setExpertMode(true)"
    >
      专家
    </button>
    <span class="muted ai-config-expert-toggle__hint">
      {{
        expertMode
          ? "已展开媒体服务、网易云、日志等高级分区"
          : "先完成接入、对话与知识库；更多项开专家模式"
      }}
    </span>
  </div>
</template>

<style scoped>
.ai-config-expert-toggle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.ai-config-expert-toggle__hint {
  flex: 1 1 12rem;
  min-width: 0;
  font-size: 0.76rem;
  line-height: 1.35;
}

@media (max-width: 560px) {
  .ai-config-expert-toggle__hint {
    flex-basis: 100%;
  }
}
</style>
