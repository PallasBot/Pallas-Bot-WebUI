<script setup lang="ts">
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";

const filterBot = defineModel<string>("filterBot", { default: "" });
const filterGroup = defineModel<string>("filterGroup", { default: "" });
const filterUser = defineModel<string>("filterUser", { default: "" });

defineProps<{
  busy?: boolean;
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleApply(delay = 480) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    emit("apply");
  }, delay);
}

function applyNow() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = undefined;
  emit("apply");
}

function resetFilters() {
  filterBot.value = "";
  filterGroup.value = "";
  filterUser.value = "";
  emit("reset");
}
</script>

<template>
  <div class="ai-history-filter-inline">
    <UiInput
      v-model="filterBot"
      class="ai-history-filter-inline__inp"
      inputmode="numeric"
      aria-label="Bot"
      placeholder="Bot"
      @update:model-value="scheduleApply()"
      @keyup.enter="applyNow"
    />
    <UiInput
      v-model="filterGroup"
      class="ai-history-filter-inline__inp"
      inputmode="numeric"
      aria-label="群号"
      placeholder="群号"
      @update:model-value="scheduleApply()"
      @keyup.enter="applyNow"
    />
    <UiInput
      v-model="filterUser"
      class="ai-history-filter-inline__inp"
      inputmode="numeric"
      aria-label="用户"
      placeholder="用户"
      @update:model-value="scheduleApply()"
      @keyup.enter="applyNow"
    />
    <UiButton
      size="sm"
      variant="ghost"
      class="ai-history-filter-inline__clear"
      @click="resetFilters"
    >
      清空
    </UiButton>
    <RefreshIconButton
      :embedded="false"
      :busy="busy"
      label="刷新列表"
      @click="applyNow"
    />
  </div>
</template>
