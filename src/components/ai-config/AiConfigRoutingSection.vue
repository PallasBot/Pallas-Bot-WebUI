<script setup lang="ts">
import { RouterLink } from "vue-router";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { useAiConfigExpertMode } from "@/composables/useAiConfigExpertMode";

const { setExpertMode } = useAiConfigExpertMode();
</script>

<template>
  <div class="ai-config-section ai-config-section--routing">
    <div class="ai-config-section__simple-card">
      <strong>路由与分流已并入「模型与 Provider」</strong>
      <p class="muted">
        任务→模型、多模型分档与分流请在专家模式下于 Provider 页底部编辑；此处保留链接兼容旧书签。
      </p>
      <button type="button" class="ai-config-section__simple-link" @click="setExpertMode(true)">
        开启专家模式
      </button>
      <RouterLink :to="aiConfigSectionPath('provider')" class="ai-config-section__simple-link">
        前往模型与 Provider
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.ai-config-section--routing {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-config-section__simple-card {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border: 1px dashed var(--border);
  border-radius: 12px;
}

.ai-config-section__simple-link {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  text-decoration: none;
}

.ai-config-section__simple-link:hover {
  text-decoration: underline;
}
</style>
