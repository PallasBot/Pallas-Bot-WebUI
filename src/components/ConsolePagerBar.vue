<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { totalPages } from "@/utils/paginate";

const props = withDefaults(
  defineProps<{
    page: number;
    total: number;
    pageSize: number;
    pageSizes?: number[];
    /** 嵌在折叠块等场景：去掉顶部分隔线 */
    embedded?: boolean;
    /** 量词，如「条」「行」 */
    unit?: string;
  }>(),
  { pageSizes: () => [4, 8, 12, 16, 24, 36, 48], embedded: false, unit: "条" },
);

const emit = defineEmits<{
  "update:page": [number];
  "update:pageSize": [number];
}>();

const maxPage = computed(() => totalPages(props.total, props.pageSize));

const sizeOptions = computed(() => {
  const base = [...(props.pageSizes ?? [])];
  if (!base.includes(props.pageSize)) base.push(props.pageSize);
  return [...new Set(base)].sort((a, b) => a - b);
});

const jumpStr = ref(String(props.page));
watch(
  () => props.page,
  (p) => {
    jumpStr.value = String(p);
  },
);

function emitPage(next: number) {
  const mx = maxPage.value;
  emit("update:page", Math.min(mx, Math.max(1, next)));
}

function goJump() {
  const n = parseInt(jumpStr.value.trim(), 10);
  if (!Number.isFinite(n)) return;
  emitPage(n);
}

function onPrev() {
  emitPage(props.page - 1);
}

function onNext() {
  emitPage(props.page + 1);
}

function onSizeChange(ev: Event) {
  const v = parseInt((ev.target as HTMLSelectElement).value, 10);
  if (Number.isFinite(v)) emit("update:pageSize", v);
}
</script>

<template>
  <div
    v-if="total > 0"
    class="console-pager"
    :class="{ 'console-pager--embedded': embedded }"
  >
    <span class="muted">共 {{ total }} {{ unit }}</span>
    <div class="row-actions console-pager__controls">
      <label class="muted console-pager__size">
        每页
        <select
          class="sel"
          :value="pageSize"
          @change="onSizeChange"
        >
          <option
            v-for="s in sizeOptions"
            :key="s"
            :value="s"
          >
            {{ s }}
          </option>
        </select>
      </label>
      <button
        type="button"
        class="btn"
        :disabled="page <= 1"
        @click="onPrev"
      >
        上一页
      </button>
      <span class="muted console-pager__jump">
        第
        <input
          v-model="jumpStr"
          class="inp"
          type="number"
          min="1"
          :max="maxPage"
          @change="goJump"
          @keyup.enter="goJump"
        >
        / {{ maxPage }} 页
      </span>
      <button
        type="button"
        class="btn"
        :disabled="page >= maxPage"
        @click="onNext"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
.console-pager__controls {
  margin-left: auto;
  flex-wrap: wrap;
}
.console-pager__size {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.console-pager__size .sel {
  min-width: 72px;
  padding: 6px 10px;
  font-size: 13px;
}
.console-pager__jump {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.console-pager__jump .inp {
  width: 64px;
  padding: 6px 8px;
}
.console-pager--embedded {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}
</style>
