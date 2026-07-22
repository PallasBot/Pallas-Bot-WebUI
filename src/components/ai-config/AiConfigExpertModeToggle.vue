<script setup lang="ts">
import { useAiConfigExpertMode } from "@/composables/useAiConfigExpertMode";

const { expertMode, setExpertMode } = useAiConfigExpertMode();
</script>

<template>
  <div class="ai-config-expert-toggle">
    <div
      class="ai-config-expert-toggle__controls console-view-toggle"
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
    </div>
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
  display: grid;
  gap: 6px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.ai-config-expert-toggle__controls {
  width: fit-content;
  max-width: 100%;
}

.ai-config-expert-toggle__hint {
  min-width: 0;
  font-size: 0.76rem;
  line-height: 1.35;
}
</style>
