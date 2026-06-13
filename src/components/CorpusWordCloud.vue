<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchCommunityCorpusHot } from "@/api/consoleApi";
import type { CommunityCorpusHotData, CommunityHotPeriod, HotCorpusItem } from "@/api/pallasTypes";

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

const periodLabel = computed(() => periods.find((row) => row.key === period.value)?.label || "今日");

const items = computed((): HotCorpusItem[] => data.value?.items || []);

const maxScore = computed(() => Math.max(...items.value.map((item) => item.score), 1));

const selectedItem = computed(() =>
  items.value.find((item) => item.keywords === selectedKeywords.value) || null,
);

function wordFontSize(score: number): string {
  const ratio = 0.35 + score / maxScore.value;
  const rem = Math.max(0.78, Math.min(1.65, 0.78 + ratio * 0.9));
  return `${rem}rem`;
}

function toggleKeyword(keywords: string) {
  selectedKeywords.value = selectedKeywords.value === keywords ? null : keywords;
}

async function loadHot(bypassCache = false) {
  busy.value = true;
  err.value = "";
  try {
    data.value = await fetchCommunityCorpusHot(period.value, { bypassCache });
    if (selectedKeywords.value && !data.value.items.some((item) => item.keywords === selectedKeywords.value)) {
      selectedKeywords.value = null;
    }
  } catch (e) {
    data.value = null;
    selectedKeywords.value = null;
    err.value = e instanceof Error ? e.message : String(e);
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

onMounted(() => {
  void loadHot();
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
      该时段暂无共享语料热词。接入并贡献语料后，这里会展示社区最热触发词。
    </p>

    <div
      v-if="items.length"
      class="corpus-hot__cloud"
      aria-label="热词云"
    >
      <button
        v-for="item in items"
        :key="item.keywords"
        type="button"
        class="corpus-hot__word"
        :class="{ 'corpus-hot__word--active': selectedKeywords === item.keywords }"
        :style="{ fontSize: wordFontSize(item.score) }"
        :title="`热度 ${item.score}`"
        @click="toggleKeyword(item.keywords)"
      >
        {{ item.keywords }}
      </button>
    </div>

    <div
      v-if="selectedItem"
      class="corpus-hot__detail"
      aria-live="polite"
    >
      <h3 class="corpus-hot__detail-title">
        {{ selectedItem.keywords }}
      </h3>
      <p class="corpus-hot__detail-meta muted">
        {{ periodLabel }}热度 {{ selectedItem.score }}
      </p>
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
