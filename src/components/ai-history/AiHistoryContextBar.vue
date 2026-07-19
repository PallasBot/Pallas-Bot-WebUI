<script setup lang="ts">
import UiButton from "@/components/ui/UiButton.vue";

export type AiHistoryContextWorkspace = "sessions" | "maintain" | "rules" | "memory";

defineProps<{
  title: string;
  meta?: string;
  activeWorkspace: AiHistoryContextWorkspace;
  groupId?: number | null;
  showGroupField?: boolean;
  groupValue?: string;
  sceneValue?: string;
  sceneOptions?: ReadonlyArray<{ label: string; value: string }>;
  busy?: boolean;
  compact?: boolean;
}>();

const emit = defineEmits<{
  maintainGroup: [];
  refreshGroup: [];
  "update:groupValue": [value: string];
  "update:sceneValue": [value: string];
}>();

function onGroupInput(ev: Event) {
  emit("update:groupValue", (ev.target as HTMLInputElement).value);
}

function onSceneChange(ev: Event) {
  emit("update:sceneValue", (ev.target as HTMLSelectElement).value);
}
</script>

<template>
  <div
    class="ai-history-context-bar"
    :class="{ 'ai-history-context-bar--compact': compact }"
  >
    <div class="ai-history-context-bar__main">
      <strong class="ai-history-context-bar__title">{{ title }}</strong>
      <p
        v-if="meta"
        class="muted ai-history-context-bar__meta"
      >
        {{ meta }}
      </p>
    </div>

    <div
      v-if="showGroupField"
      class="ai-history-context-bar__filters"
    >
      <input
        class="inp ai-history-context-bar__inp"
        inputmode="numeric"
        placeholder="群号"
        aria-label="群号"
        :value="groupValue"
        @input="onGroupInput"
        @keyup.enter="emit('refreshGroup')"
      >
      <select
        v-if="sceneOptions?.length"
        class="inp ai-history-context-bar__inp"
        aria-label="场景"
        :value="sceneValue"
        @change="onSceneChange"
      >
        <option
          v-for="item in sceneOptions"
          :key="`ctx-scene-${item.value || 'empty'}`"
          :value="item.value"
        >
          {{ item.label }}
        </option>
      </select>
      <UiButton
        size="sm"
        variant="ghost"
        :busy="busy"
        @click="emit('refreshGroup')"
      >
        刷新
      </UiButton>
    </div>

    <UiButton
      v-if="groupId && groupId > 0 && activeWorkspace === 'sessions'"
      size="sm"
      variant="outline"
      class="ai-history-context-bar__action"
      @click="emit('maintainGroup')"
    >
      维护此群
    </UiButton>
  </div>
</template>
