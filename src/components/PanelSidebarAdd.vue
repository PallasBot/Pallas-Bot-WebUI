<script setup lang="ts">
import { computed } from "vue";
import { sidebarPinToken } from "@/config/sidebarPins";
import { addNavTokenToSidebar, isNavTokenInSidebar } from "@/utils/sidebarNavActions";

const props = withDefaults(
  defineProps<{
    /** 主导航 path，如 `/instances` */
    mainPath?: string;
    /** `sidebarPins` 中的 id，如 `friends-groups-friends` */
    pinId?: string;
  }>(),
  { mainPath: "", pinId: "" },
);

const resolvedToken = computed(() => {
  if (props.pinId?.trim()) return sidebarPinToken(props.pinId.trim());
  const p = (props.mainPath || "").trim();
  return p || "";
});

/** 已在侧栏则不渲染，避免出现「✓」占位 */
const show = computed(() => {
  const t = resolvedToken.value;
  return Boolean(t) && !isNavTokenInSidebar(t);
});

function onClick() {
  const t = resolvedToken.value;
  if (!t) return;
  addNavTokenToSidebar(t);
}
</script>

<template>
  <button
    v-if="show"
    type="button"
    class="panel-sidebar-add"
    title="添加到侧栏"
    aria-label="添加到侧栏"
    @click="onClick"
  >
    <span aria-hidden="true">+</span>
  </button>
</template>

<style scoped>
.panel-sidebar-add {
  flex: 0 0 28px;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  max-width: 28px;
  max-height: 28px;
  padding: 0;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm, 6px);
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  background: color-mix(in srgb, var(--bg-muted) 40%, transparent);
  color: var(--accent);
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.15s var(--ease, ease),
    color 0.15s var(--ease, ease),
    border-color 0.15s var(--ease, ease);
}

.panel-sidebar-add:hover {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}
</style>
