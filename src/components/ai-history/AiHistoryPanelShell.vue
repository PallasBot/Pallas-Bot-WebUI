<script setup lang="ts">
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";

withDefaults(
  defineProps<{
    title: string;
    purpose?: string;
    summary?: string;
    expanded?: boolean;
    collapsible?: boolean;
    glass?: boolean;
    panelClass?: string;
  }>(),
  {
    purpose: "",
    summary: "",
    expanded: true,
    collapsible: true,
    glass: true,
    panelClass: "",
  },
);

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <UiCard
    tag="section"
    :glass="glass"
    class="ai-history-panel-shell ai-history-page__panel"
    :class="panelClass"
  >
    <div class="ai-history-panel-shell__hd panel__hd panel__hd--split">
      <div class="ai-history-panel-shell__text">
        <h3 class="ai-history-panel-shell__title panel__title">{{ title }}</h3>
        <p
          v-if="expanded ? purpose : summary || purpose"
          class="ai-history-panel-shell__sub muted"
        >
          {{ expanded ? purpose : (summary || purpose) }}
        </p>
      </div>
      <div class="row-actions ai-history-panel-shell__actions">
        <slot name="actions" />
        <UiButton
          v-if="collapsible"
          size="sm"
          variant="outline"
          class="panel-hd-collapse-btn"
          @click="emit('toggle')"
        >
          {{ expanded ? "收起" : "展开" }}
        </UiButton>
      </div>
    </div>
    <div
      v-show="expanded"
      class="ai-history-panel-shell__body"
    >
      <slot />
    </div>
  </UiCard>
</template>

<style scoped>
.ai-history-panel-shell {
  margin: 0;
}

.ai-history-panel-shell__hd {
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 0;
  padding-bottom: 0;
}

.ai-history-panel-shell__text {
  min-width: 0;
  flex: 1;
}

.ai-history-panel-shell__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  line-height: 1.35;
}

.ai-history-panel-shell__sub {
  margin: 6px 0 0;
  font-size: 0.84rem;
  line-height: 1.5;
}

.ai-history-panel-shell__actions {
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ai-history-panel-shell__body {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ai-history-panel-shell :deep(.ai-history-page__filters-card) {
  margin-top: 0;
}

@media (max-width: 560px) {
  .ai-history-panel-shell__hd {
    flex-wrap: wrap;
  }

  .ai-history-panel-shell__actions {
    width: 100%;
  }

  .ai-history-panel-shell__actions > .ui-btn {
    flex: 1 1 auto;
  }
}
</style>
