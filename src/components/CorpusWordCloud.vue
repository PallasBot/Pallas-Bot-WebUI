<script setup lang="ts">
import * as d3 from "d3";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { fetchCommunityCorpusHot, fetchLocalCorpusHot } from "@/api/consoleApi";
import type { CommunityCorpusHotData, CommunityHotTab, HotCorpusItem } from "@/api/pallasTypes";
import {
  hotBubbleFill,
  hotBubbleFontSize,
  hotBubbleLabel,
  layoutHotBubbles,
  type HotBubbleLayoutNode,
} from "@/utils/hotBubbleLayout";

const props = withDefaults(
  defineProps<{
    reloadToken?: number;
    source?: "community" | "local";
  }>(),
  {
    source: "community",
  },
);

const communityTabs: Array<{ key: CommunityHotTab; label: string }> = [
  { key: "fleet", label: "机群" },
  { key: "pool", label: "高频池" },
  { key: "day", label: "今日" },
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
];

const tab = ref<CommunityHotTab>("fleet");
const busy = ref(false);
const err = ref("");
const data = ref<CommunityCorpusHotData | null>(null);
const selectedKeywords = ref<string | null>(null);
const cloudHost = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;
let resizeTimer: number | null = null;
let renderToken = 0;

const tabLabel = computed(() => communityTabs.find((row) => row.key === tab.value)?.label || "机群");

const scopeLabel = computed(() => {
  if (props.source === "local") return "本机累计";
  if (tab.value === "fleet") return "近24h机群叠加";
  return tab.value === "pool" ? "社区高频池" : `${tabLabel.value}近期活跃`;
});

const statusHint = computed(() =>
  props.source === "local" || tab.value === "fleet"
    ? "气泡越大越热 · 点击查看热度"
    : "气泡越大越热 · 点击查看代表回复",
);

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
    data.value =
      props.source === "local"
        ? await fetchLocalCorpusHot({ bypassCache })
        : await fetchCommunityCorpusHot(tab.value, { bypassCache });
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

function selectTab(next: CommunityHotTab) {
  if (next === tab.value || busy.value) return;
  tab.value = next;
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
    .attr("aria-label", props.source === "local" ? "本机语料热词气泡图" : "共享语料热词气泡图");

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
      v-if="source === 'community'"
      class="corpus-hot__tabs"
      role="tablist"
      aria-label="热词统计范围"
    >
      <button
        v-for="row in communityTabs"
        :key="row.key"
        type="button"
        class="corpus-hot__tab"
        :class="{ 'corpus-hot__tab--active': tab === row.key }"
        role="tab"
        :aria-selected="tab === row.key ? 'true' : 'false'"
        :disabled="busy"
        @click="selectTab(row.key)"
      >
        {{ row.label }}
      </button>
    </div>

    <p
      v-if="busy && !items.length"
      class="muted corpus-hot__status"
    >
      加载{{ scopeLabel }}热词…
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
      <template v-if="source === 'local'">
        暂无本机语料热词。日常接话学习后，这里会展示本部署累计最热触发词。
      </template>
      <template v-else-if="tab === 'fleet'">
        暂无机群热词。各部署开启语料贡献并上报心跳后，这里会展示近24h热词叠加榜。
      </template>
      <template v-else-if="tab === 'pool'">
        暂无共享语料高频词。接入并贡献语料后，这里会展示社区累计最热触发词。
      </template>
      <template v-else>
        该时段暂无近期活跃热词。可切换到「机群」或「高频池」查看。
      </template>
    </p>
    <p
      v-else
      class="muted corpus-hot__status"
    >
      {{ scopeLabel }} · {{ statusHint }}
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
            <template v-if="source === 'local' || tab === 'pool'">
              累计热度 {{ selectedItem.score }}
            </template>
            <template v-else-if="tab === 'fleet'">
              机群叠加热度 {{ selectedItem.score }}
            </template>
            <template v-else>
              {{ tabLabel }}热度 {{ selectedItem.score }}
            </template>
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
          {{ tab === 'fleet' ? '机群榜不含代表回复' : '暂无代表回复' }}
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
