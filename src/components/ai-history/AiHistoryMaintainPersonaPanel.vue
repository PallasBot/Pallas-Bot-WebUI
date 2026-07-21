<script setup lang="ts">
import { ref } from "vue";
import AiHistoryPanelShell from "@/components/ai-history/AiHistoryPanelShell.vue";
import PersonaAffectObservePanel from "@/components/PersonaAffectObservePanel.vue";
import UiButton from "@/components/ui/UiButton.vue";

withDefaults(
  defineProps<{
    expanded?: boolean;
    summary?: string;
    syncGroupId?: string;
  }>(),
  {
    expanded: false,
    summary: "",
    syncGroupId: "",
  },
);

const emit = defineEmits<{
  toggle: [];
  "pick-group": [];
}>();

const observePanelRef = ref<InstanceType<typeof PersonaAffectObservePanel> | null>(null);

function reload() {
  observePanelRef.value?.reload?.();
}

defineExpose({ reload });
</script>

<template>
  <AiHistoryPanelShell
    title="牛格观测"
    purpose="按群查看情感轴、群画像与情感细化"
    :summary="summary"
    :expanded="expanded"
    panel-class="ai-history-page__persona-wrap"
    @toggle="emit('toggle')"
  >
    <template #actions>
      <UiButton
        size="sm"
        variant="ghost"
        @click="emit('pick-group')"
      >
        从会话选群
      </UiButton>
      <UiButton
        size="sm"
        variant="ghost"
        :disabled="!expanded"
        @click="reload"
      >
        刷新
      </UiButton>
    </template>
    <div class="ai-history-page__observe-panel-body ai-history-page__observe-panel-body--persona">
      <PersonaAffectObservePanel
        ref="observePanelRef"
        embedded
        headless
        :sync-group-id="syncGroupId"
        class="ai-history-page__persona-panel"
      />
    </div>
  </AiHistoryPanelShell>
</template>
