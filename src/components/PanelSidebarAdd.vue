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
