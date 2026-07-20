<script setup lang="ts">
import { RouterLink } from "vue-router";
import PluginConfigWorkspace from "@/components/PluginConfigWorkspace.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { aiConfigSectionPath } from "@/config/aiConfigSections";

const DRAW_PLUGIN = "draw";
</script>

<template>
  <div class="ai-config-section ai-config-section--draw">
    <UiCard tag="div" glass class="ai-config-section__panel">
      <div class="panel__bd">
        <p class="muted ai-config-section__intro">
          画画网关与连通性配置写入插件 <code>{{ DRAW_PLUGIN }}</code>（与插件页同一套键，无第二数据源）。
          默认在 Bot 进程直连网关，不依赖 AI Runtime。完整命令权限等仍可在
          <RouterLink :to="`/plugins/${DRAW_PLUGIN}`">插件页</RouterLink>
          查看。
        </p>
        <p class="muted ai-config-section__intro ai-config-draw__hint">
          服务网关批量探测见
          <RouterLink :to="aiConfigSectionPath('connection')">扩展连接</RouterLink>
          旁的连通性入口；仅当显式选用 AI 服务画图模式时才需要 AI Runtime。
        </p>
      </div>
    </UiCard>
    <PluginConfigWorkspace
      :plugin-name="DRAW_PLUGIN"
      presentation="dialog"
    />
  </div>
</template>

<style scoped>
.ai-config-section--draw {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-config-draw__hint {
  margin-top: 0;
}

@media (max-width: 560px) {
  .ai-config-section--draw :deep(.plugin-config-page__hero-actions) {
    width: 100%;
  }
}
</style>
