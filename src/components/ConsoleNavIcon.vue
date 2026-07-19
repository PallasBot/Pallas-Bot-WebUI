<script setup lang="ts">
import { computed } from "vue";
import {
  CONSOLE_NAV_ICON_NODES,
  type ConsoleIconNode,
  type ConsoleNavIconId,
  resolveConsoleNavIcon,
} from "@/config/consoleNavIcons";

const props = withDefaults(
  defineProps<{
    name: ConsoleNavIconId | string;
    size?: number;
  }>(),
  {
    size: 16,
  },
);

const iconId = computed(() => resolveConsoleNavIcon(props.name));
const nodes = computed(() => CONSOLE_NAV_ICON_NODES[iconId.value] ?? CONSOLE_NAV_ICON_NODES.default);

function nodeKey(node: ConsoleIconNode, index: number): string {
  return `${node.kind}-${index}`;
}
</script>

<template>
  <span
    class="console-nav-icon"
    aria-hidden="true"
  >
    <svg
      class="console-nav-icon__svg"
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <template
        v-for="(node, index) in nodes"
        :key="nodeKey(node, index)"
      >
        <path
          v-if="node.kind === 'path'"
          :d="node.d"
        />
        <rect
          v-else-if="node.kind === 'rect'"
          :x="node.x"
          :y="node.y"
          :width="node.width"
          :height="node.height"
          :rx="node.rx"
        />
        <circle
          v-else-if="node.kind === 'circle'"
          :cx="node.cx"
          :cy="node.cy"
          :r="node.r"
        />
        <line
          v-else-if="node.kind === 'line'"
          :x1="node.x1"
          :y1="node.y1"
          :x2="node.x2"
          :y2="node.y2"
        />
        <polyline
          v-else-if="node.kind === 'polyline'"
          :points="node.points"
        />
      </template>
    </svg>
  </span>
</template>
