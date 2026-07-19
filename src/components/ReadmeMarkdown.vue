<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { setupReadmeCodeCopyButtons } from "@/utils/readmeCodeCopy";

const props = withDefaults(
  defineProps<{
    html: string;
    extraClass?: string;
  }>(),
  {
    extraClass: "",
  },
);

const root = ref<HTMLElement | null>(null);
let teardown: (() => void) | null = null;

async function refreshCopyButtons() {
  teardown?.();
  teardown = null;
  if (!props.html.trim()) return;
  await nextTick();
  if (!root.value) return;
  teardown = setupReadmeCodeCopyButtons(root.value);
}

watch(
  () => props.html,
  () => {
    void refreshCopyButtons();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  teardown?.();
});
</script>

<template>
  <div
    ref="root"
    class="readme-markdown markdown-body"
    :class="extraClass"
    v-html="html"
  />
</template>
