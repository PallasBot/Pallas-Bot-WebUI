<script setup lang="ts">
import { dismissConsoleToast, useConsoleToastState } from "@/utils/consoleToast";

const { items } = useConsoleToastState();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="items.length"
      class="console-toast-host"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      <div
        v-for="item in items"
        :key="item.id"
        class="console-toast"
        :class="`console-toast--${item.level}`"
      >
        <span class="console-toast__msg">{{ item.message }}</span>
        <button
          type="button"
          class="console-toast__close"
          aria-label="关闭"
          @click="dismissConsoleToast(item.id)"
        >
          ×
        </button>
      </div>
    </div>
  </Teleport>
</template>
