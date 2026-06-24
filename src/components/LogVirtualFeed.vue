<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { LogEntry } from "@/api/pallasTypes";
import { formatLogDisplayTime } from "@/utils/logDisplay";

const props = withDefaults(
  defineProps<{
    rows: LogEntry[];
    followTail?: boolean;
    rowHeight?: number;
    overscan?: number;
  }>(),
  {
    followTail: true,
    rowHeight: 34,
    overscan: 10,
  },
);

const emit = defineEmits<{
  scrollState: [nearBottom: boolean];
}>();

const scrollEl = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const viewportHeight = ref(480);
const expandedKey = ref<string | null>(null);
let ro: ResizeObserver | null = null;

const totalHeight = computed(() => Math.max(0, props.rows.length * props.rowHeight));

const startIndex = computed(() => {
  const raw = Math.floor(scrollTop.value / props.rowHeight) - props.overscan;
  return Math.max(0, raw);
});

const endIndex = computed(() => {
  const raw = Math.ceil((scrollTop.value + viewportHeight.value) / props.rowHeight) + props.overscan;
  return Math.min(props.rows.length, raw);
});

const visibleRows = computed(() =>
  props.rows.slice(startIndex.value, endIndex.value).map((row, i) => ({
    row,
    index: startIndex.value + i,
    key: rowKey(row, startIndex.value + i),
  })),
);

const offsetY = computed(() => startIndex.value * props.rowHeight);

const expandedRow = computed(() => {
  if (!expandedKey.value) return null;
  return props.rows.find((row, index) => rowKey(row, index) === expandedKey.value) ?? null;
});

function rowKey(row: LogEntry, index: number): string {
  return String(row.id ?? `${row.time}|${index}|${row.message.slice(0, 32)}`);
}

function previewMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

function scrollThreshold(el: HTMLElement): number {
  const h = el.clientHeight;
  return Math.min(80, Math.max(24, Math.floor(h * 0.08)));
}

function isNearBottom(el: HTMLElement): boolean {
  const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
  return gap <= scrollThreshold(el);
}

function onScroll() {
  const el = scrollEl.value;
  if (!el) return;
  scrollTop.value = el.scrollTop;
  emit("scrollState", isNearBottom(el));
}

function toggleRow(key: string) {
  expandedKey.value = expandedKey.value === key ? null : key;
}

async function scrollToBottom(force = false) {
  if (!force && !props.followTail) return;
  await nextTick();
  const el = scrollEl.value;
  if (!el) return;
  const apply = () => {
    el.scrollTop = el.scrollHeight;
    scrollTop.value = el.scrollTop;
  };
  apply();
  if (typeof window !== "undefined") {
    window.requestAnimationFrame(() => {
      apply();
    });
  }
}

function bindViewport() {
  const el = scrollEl.value;
  if (!el || typeof ResizeObserver === "undefined") return;
  ro?.disconnect();
  ro = new ResizeObserver(() => {
    viewportHeight.value = el.clientHeight || 480;
  });
  ro.observe(el);
  viewportHeight.value = el.clientHeight || 480;
}

watch(
  () => props.rows.length,
  () => {
    if (props.followTail) void scrollToBottom(true);
  },
);

watch(
  () => props.followTail,
  (on) => {
    if (on) void scrollToBottom(true);
  },
);

onMounted(() => {
  bindViewport();
  void scrollToBottom(true);
});

onUnmounted(() => {
  ro?.disconnect();
  ro = null;
});

defineExpose({ scrollToBottom });
</script>

<template>
  <div class="log-virtual-feed-wrap">
    <div
      ref="scrollEl"
      class="log-feed log-virtual-feed"
      @scroll.passive="onScroll"
    >
      <div
        class="log-virtual-feed__spacer"
        :style="{ height: `${totalHeight}px` }"
      >
        <div
          class="log-virtual-feed__window"
          :style="{ transform: `translateY(${offsetY}px)` }"
        >
          <button
            v-for="{ row, key } in visibleRows"
            :key="key"
            type="button"
            class="log-line log-line--virtual"
            :class="{ 'log-line--virtual-active': expandedKey === key }"
            :style="{ minHeight: `${rowHeight}px`, height: `${rowHeight}px` }"
            :title="previewMessage(row.message)"
            @click="toggleRow(key)"
          >
            <span class="log-line__time">{{ formatLogDisplayTime(row.time) }}</span>
            <span :class="['log-line__lv-tag', `log-line__lv-tag--${row.level}`]">{{ row.level }}</span>
            <span
              v-if="row.scope"
              class="log-line__scope"
            >[{{ row.scope }}]</span>
            <span class="log-line__msg log-line__msg--clip">{{ previewMessage(row.message) }}</span>
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="expandedRow"
      class="log-virtual-feed__detail"
    >
      <div class="log-virtual-feed__detail-meta">
        <span class="log-line__time">{{ formatLogDisplayTime(expandedRow.time) }}</span>
        <span :class="['log-line__lv-tag', `log-line__lv-tag--${expandedRow.level}`]">{{ expandedRow.level }}</span>
        <span
          v-if="expandedRow.scope"
          class="log-line__scope"
        >[{{ expandedRow.scope }}]</span>
        <button
          type="button"
          class="btn btn--ghost log-virtual-feed__detail-close"
          @click="expandedKey = null"
        >
          收起
        </button>
      </div>
      <pre class="log-virtual-feed__detail-body">{{ expandedRow.message }}</pre>
    </div>
  </div>
</template>

<style scoped>
.log-virtual-feed-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  flex: 1;
}
.log-virtual-feed {
  position: relative;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  max-height: none;
}
.log-virtual-feed__spacer {
  position: relative;
  width: 100%;
}
.log-virtual-feed__window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}
.log-line--virtual {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 0 10px;
  margin: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.log-line--virtual:hover,
.log-line--virtual-active {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.log-line--virtual .log-line__lv-tag {
  flex-shrink: 0;
}
.log-line--virtual .log-line__scope {
  flex: 0 1 7rem;
  max-width: 7rem;
}
.log-line--virtual .log-line__msg--clip {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.log-virtual-feed__detail {
  flex-shrink: 0;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  background: color-mix(in srgb, var(--bg-elev) 92%, transparent);
}
.log-virtual-feed__detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.log-virtual-feed__detail-close {
  margin-left: auto;
  padding: 4px 10px;
  min-height: 0;
  font-size: 12px;
}
.log-virtual-feed__detail-body {
  margin: 0;
  max-height: min(220px, 28vh);
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.45;
  color: var(--text);
}
</style>
