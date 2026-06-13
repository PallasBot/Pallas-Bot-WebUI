<script setup lang="ts">
import * as d3 from "d3";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { fetchCommunityCorpusHot } from "@/api/consoleApi";
import type { CommunityCorpusHotData, CommunityHotPeriod, HotCorpusItem } from "@/api/pallasTypes";
import {
  hotBubbleFill,
  hotBubbleFontSize,
  hotBubbleLabel,
  layoutHotBubbles,
  type HotBubbleLayoutNode,
} from "@/utils/hotBubbleLayout";

const props = defineProps<{
  reloadToken?: number;
}>();

const periods: Array<{ key: CommunityHotPeriod; label: string }> = [
  { key: "day", label: "今日" },
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
];

const period = ref<CommunityHotPeriod>("day");
const busy = ref(false);
const err = ref("");
const data = ref<CommunityCorpusHotData | null>(null);
const selectedKeywords = ref<string | null>(null);
const cloudHost = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;
let resizeTimer: number | null = null;
let renderToken = 0;

const periodLabel = computed(() => periods.find((row) => row.key === period.value)?.label || "今日");

const items = computed((): HotCorpusItem[] => data.value?.items || []);

const selectedItem = computed(() =>
  items.value.find((item) => item.keywords === selectedKeywords.value) || null,
);

function syncSelectionState() {
  const host = cloudHost.value;
  if (!host) return;
  host.querySelectorAll<SVGGElement>("g.hot-bubble-node").forEach((el) => {
    const key = el.getAttribute("data-keywords");
    const active = key !== null && key === selectedKeywords.value;
    el.classList.toggle("hot-bubble-node--active", active);
    el.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function toggleKeyword(keywords: string) {
  selectedKeywords.value = selectedKeywords.value === keywords ? null : keywords;
  syncSelectionState();
}

function clearSelection() {
  selectedKeywords.value = null;
  syncSelectionState();
}

async function loadHot(bypassCache = false) {
  busy.value = true;
  err.value = "";
  try {
    data.value = await fetchCommunityCorpusHot(period.value, { bypassCache });
    if (selectedKeywords.value && !data.value.items.some((item) => item.keywords === selectedKeywords.value)) {
      selectedKeywords.value = null;
    }
    await nextTick();
    await renderBubbleChart();
  } catch (e) {
    data.value = null;
    selectedKeywords.value = null;
    err.value = e instanceof Error ? e.message : String(e);
    if (cloudHost.value) cloudHost.value.innerHTML = "";
  } finally {
    busy.value = false;
  }
}

function selectPeriod(next: CommunityHotPeriod) {
  if (next === period.value || busy.value) return;
  period.value = next;
  selectedKeywords.value = null;
  void loadHot();
}

async function renderBubbleChart() {
  const host = cloudHost.value;
  if (!host) return;
  const token = ++renderToken;
  host.innerHTML = "";
  if (!items.value.length) return;

  const width = host.clientWidth || 640;
  if (width < 48) return;
  const { nodes, height } = layoutHotBubbles(items.value, width);

  const svg = d3
    .select(host)
    .append("svg")
    .attr("class", "hot-bubble-svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height)
    .attr("role", "img")
    .attr("aria-label", "共享语料热词气泡图");

  const node = svg
    .selectAll<SVGGElement, HotBubbleLayoutNode>("g.hot-bubble-node")
    .data(nodes)
    .join("g")
    .attr("class", (d) => {
      const active = d.item.keywords === selectedKeywords.value ? " hot-bubble-node--active" : "";
      return `hot-bubble-node${active}`;
    })
    .attr("data-keywords", (d) => d.item.keywords)
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-pressed", (d) => (d.item.keywords === selectedKeywords.value ? "true" : "false"))
    .on("click", (_, d) => {
      toggleKeyword(d.item.keywords);
    })
    .on("keydown", (event, d) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleKeyword(d.item.keywords);
    });

  const body = node
    .append("g")
    .attr("class", "hot-bubble-node__body")
    .style("--hot-delay", (_, i) => `${Math.min(i * 35, 640)}ms`);

  body
    .append("circle")
    .attr("r", (d) => d.r)
    .attr("class", "hot-bubble-node__disk")
    .attr("fill", (d) => hotBubbleFill(d.scoreRatio));

  body
    .append("text")
    .attr("class", "hot-bubble-node__label")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .attr("font-size", (d) => hotBubbleFontSize(d.r))
    .text((d) => hotBubbleLabel(d.item.keywords, d.r));

  node.append("title").text((d) => `${d.item.keywords}\n热度 ${d.item.score}`);

  if (token !== renderToken) return;
}

onMounted(() => {
  void loadHot();
  if (!cloudHost.value) return;
  resizeObserver = new ResizeObserver(() => {
    if (resizeTimer != null) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      void renderBubbleChart();
    }, 120);
  });
  resizeObserver.observe(cloudHost.value);
});

onBeforeUnmount(() => {
  if (resizeTimer != null) window.clearTimeout(resizeTimer);
  resizeTimer = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
});

watch(
  () => props.reloadToken,
  () => {
    void loadHot(true);
  },
);
</script>

<template>
  <div class="corpus-hot">
    <div
      class="corpus-hot__tabs"
      role="tablist"
      aria-label="热词时间范围"
    >
      <button
        v-for="row in periods"
        :key="row.key"
        type="button"
        class="corpus-hot__tab"
        :class="{ 'corpus-hot__tab--active': period === row.key }"
        role="tab"
        :aria-selected="period === row.key ? 'true' : 'false'"
        :disabled="busy"
        @click="selectPeriod(row.key)"
      >
        {{ row.label }}
      </button>
    </div>

    <p
      v-if="busy && !items.length"
      class="muted corpus-hot__status"
    >
      加载{{ periodLabel }}热词…
    </p>
    <p
      v-else-if="err"
      class="alert alert--warn corpus-hot__status"
    >
      热词加载失败：{{ err }}
    </p>
    <p
      v-else-if="!items.length"
      class="muted corpus-hot__status"
    >
      该时段暂无共享语料热词。接入并贡献语料后，这里会以气泡图展示社区最热触发词。
    </p>
    <p
      v-else
      class="muted corpus-hot__status"
    >
      {{ periodLabel }}最热触发词 · 气泡越大越热 · 点击查看代表回复
    </p>

    <div
      v-show="items.length"
      ref="cloudHost"
      class="corpus-hot__canvas"
      aria-label="热词气泡图"
    />

    <div
      v-if="selectedItem"
      class="corpus-hot__detail"
      aria-live="polite"
    >
      <div class="corpus-hot__detail-hd">
        <div class="corpus-hot__detail-heading">
          <h3 class="corpus-hot__detail-title">
            {{ selectedItem.keywords }}
          </h3>
          <p class="corpus-hot__detail-meta muted">
            {{ periodLabel }}热度 {{ selectedItem.score }}
          </p>
        </div>
        <button
          type="button"
          class="corpus-hot__detail-close"
          aria-label="收起代表回复"
          @click="clearSelection"
        >
          收起
        </button>
      </div>
      <ul class="corpus-hot__reply-list">
        <li
          v-if="!selectedItem.answers.length"
          class="corpus-hot__reply corpus-hot__reply--empty muted"
        >
          暂无代表回复
        </li>
        <li
          v-for="(answer, idx) in selectedItem.answers"
          v-else
          :key="`${selectedItem.keywords}-${idx}`"
          class="corpus-hot__reply"
        >
          <p class="corpus-hot__reply-text">
            {{ answer.message || answer.answer_keywords || "（无文案）" }}
          </p>
          <p class="corpus-hot__reply-hint muted">
            引用 {{ answer.count }} 次
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>
