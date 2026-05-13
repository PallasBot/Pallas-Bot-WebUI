<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 占位面板块数量 */
    panels?: number;
  }>(),
  { panels: 3 },
);
</script>

<template>
  <div
    class="console-page-skel"
    aria-busy="true"
    aria-label="加载中"
  >
    <div
      v-for="n in panels"
      :key="n"
      class="console-page-skel__panel"
    >
      <div class="console-page-skel__hd skel-pulse" />
      <div class="console-page-skel__bd">
        <div class="console-page-skel__line skel-pulse" />
        <div class="console-page-skel__line skel-pulse console-page-skel__line--mid" />
        <div
          v-if="n <= 2"
          class="console-page-skel__line skel-pulse console-page-skel__line--short"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.console-page-skel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 120px;
}
.console-page-skel__panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
.console-page-skel__hd {
  height: 22px;
  margin: 12px 16px 0;
  border-radius: 6px;
  max-width: 180px;
  background: var(--border-strong);
}
.console-page-skel__bd {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.console-page-skel__line {
  height: 11px;
  border-radius: 5px;
  background: var(--border-strong);
  max-width: 100%;
}
.console-page-skel__line--mid {
  width: 72%;
}
.console-page-skel__line--short {
  width: 44%;
}
</style>
