<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { AI_OBSERVATION_LINKS_LIST } from "@/config/aiEntrySemantics";

const props = withDefaults(
  defineProps<{
    exclude?: string;
  }>(),
  {
    exclude: "",
  },
);

const route = useRoute();

const links = computed(() =>
  AI_OBSERVATION_LINKS_LIST.filter((item) => item.id !== props.exclude),
);

function isActive(path: string): boolean {
  if (path.includes("?")) {
    const [pathname, query] = path.split("?");
    if (route.path !== pathname) return false;
    const panel = new URLSearchParams(query).get("panel");
    return route.query.panel === panel;
  }
  return route.path === path;
}
</script>

<template>
  <nav
    class="ai-obs-links"
    aria-label="AI 观测快捷入口"
  >
    <RouterLink
      v-for="item in links"
      :key="item.id"
      :to="item.path"
      class="ai-obs-links__item"
      :class="{ 'is-on': isActive(item.path) }"
    >
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
