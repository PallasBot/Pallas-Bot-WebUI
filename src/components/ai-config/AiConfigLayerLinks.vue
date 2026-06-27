<script setup lang="ts">
import { RouterLink, useRoute } from "vue-router";
import { AI_CONFIG_LAYER_LINKS, type AiConfigLayerLinkId } from "@/config/aiEntrySemantics";

const props = defineProps<{
  active?: AiConfigLayerLinkId;
  exclude?: AiConfigLayerLinkId;
}>();

const route = useRoute();

function linkActive(path: string): boolean {
  if (props.active) {
    return AI_CONFIG_LAYER_LINKS[props.active].path === path;
  }
  return route.path === path || route.path.startsWith(`${path}/`);
}
</script>

<template>
  <nav
    class="ai-config-layer-links"
    aria-label="对话链路配置"
  >
    <RouterLink
      v-for="(item, key) in AI_CONFIG_LAYER_LINKS"
      :key="key"
      v-show="exclude !== key"
      :to="item.path"
      class="ai-config-layer-links__item"
      :class="{ 'is-on': linkActive(item.path) }"
    >
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
