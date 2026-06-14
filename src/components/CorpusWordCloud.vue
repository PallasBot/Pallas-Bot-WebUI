<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { fetchCommunityCorpusHot, fetchLocalCorpusHot } from "@/api/consoleApi";
import type { CommunityCorpusHotData, CommunityHotTab, HotCorpusItem } from "@/api/pallasTypes";
import { layoutHotTags, rankHotItems, type HotTagLayoutNode } from "@/utils/hotBubbleLayout";

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
const layoutNodes = ref<HotTagLayoutNode[]>([]);
const cloudHeight = ref(280);
let resizeObserver: ResizeObserver | null = null;
let resizeTimer: number | null = null;

const tabLabel = computed(() => communityTabs.find((row) => row.key === tab.value)?.label || "机群");

const scopeLabel = computed(() => {
  if (props.source === "local") return "本机累计";
  if (tab.value === "fleet") return "近24h机群叠加";
  return tab.value === "pool" ? "社区高频池" : `${tabLabel.value}近期活跃`;
});

const statusHint = computed(() =>
  props.source === "local" || tab.value === "fleet"
    ? "标签越大越热 · 点击查看热度"
    : "标签越大越热 · 点击查看代表回复",
);

const items = computed((): HotCorpusItem[] => data.value?.items || []);

const selectedItem = computed(() =>
  items.value.find((item) => item.keywords === selectedKeywords.value) || null,
);

const selectedRank = computed(() => {
  if (!selectedKeywords.value) return null;
  return rankHotItems(items.value).find((node) => node.item.keywords === selectedKeywords.value)?.rank ?? null;
});

function pillClasses(node: HotTagLayoutNode): string[] {
  const classes = ["corpus-hot__pill", `corpus-hot__pill--${node.sizeClass}`];
  if (node.rank <= 3) classes.push(`corpus-hot__pill--top${node.rank}`);
  if (node.item.keywords === selectedKeywords.value) classes.push("corpus-hot__pill--active");
  return classes;
}

function toggleKeyword(keywords: string) {
  selectedKeywords.value = selectedKeywords.value === keywords ? null : keywords;
}

function clearSelection() {
  selectedKeywords.value = null;
}

function updateLayout() {
  const host = cloudHost.value;
  if (!host || !items.value.length) {
    layoutNodes.value = [];
    cloudHeight.value = 280;
    return;
  }
  const width = host.clientWidth || 640;
  if (width < 48) return;
  const { nodes, height } = layoutHotTags(items.value, width);
  layoutNodes.value = nodes;
  cloudHeight.value = height;
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
    updateLayout();
  } catch (e) {
    data.value = null;
    selectedKeywords.value = null;
    layoutNodes.value = [];
    err.value = e instanceof Error ? e.message : String(e);
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

onMounted(() => {
  void loadHot();
  if (!cloudHost.value) return;
  resizeObserver = new ResizeObserver(() => {
    if (resizeTimer != null) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      updateLayout();
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
      aria-label="共享语料热词云"
    >
      <div
        v-if="layoutNodes.length"
        class="corpus-hot__cloud"
        :class="{ 'corpus-hot__cloud--selected': selectedKeywords }"
        :style="{ height: `${cloudHeight}px` }"
        role="list"
      >
        <button
          v-for="(node, index) in layoutNodes"
          :key="node.item.keywords"
          type="button"
          :class="pillClasses(node)"
          :style="{
            '--heat': node.scoreRatio.toFixed(3),
            '--pill-i': String(index),
            left: `${node.x}px`,
            top: `${node.y}px`,
          }"
          role="listitem"
          :aria-pressed="node.item.keywords === selectedKeywords ? 'true' : 'false'"
          :title="`${node.item.keywords} · 热度 ${node.item.score}`"
          @click="toggleKeyword(node.item.keywords)"
        >
          <span
            v-if="node.rank <= 3"
            class="corpus-hot__pill-rank"
            aria-hidden="true"
          >{{ node.rank }}</span>
          <span class="corpus-hot__pill-word">{{ node.item.keywords }}</span>
          <span class="corpus-hot__pill-score">{{ node.item.score }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="selectedItem"
      class="corpus-hot__detail"
      aria-live="polite"
    >
      <div class="corpus-hot__detail-panel">
        <div class="corpus-hot__detail-hd">
          <div class="corpus-hot__detail-heading">
            <span
              v-if="selectedRank !== null && selectedRank <= 3"
              class="corpus-hot__detail-rank"
            >#{{ selectedRank }}</span>
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
            aria-label="收起详情"
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
  </div>
</template>
