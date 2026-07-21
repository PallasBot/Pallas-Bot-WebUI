<script setup lang="ts">
import { computed, ref, watch } from "vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
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
    <div class="console-pager__bar">
      <div class="console-pager__meta">
        <span class="muted console-pager__total">共 {{ total }} {{ unit }}</span>
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
      </div>
      <div class="console-pager__nav">
        <UiButton
          variant="outline"
          size="sm"
          class="console-pager__btn-prev"
          :disabled="page <= 1"
          @click="onPrev"
        >
          上一页
        </UiButton>
        <span class="muted console-pager__jump">
          第
          <UiInput
            v-model="jumpStr"
            class="console-pager__jump-inp"
            type="number"
            min="1"
            :max="maxPage"
            @change="goJump"
            @keyup.enter="goJump"
          />
          / {{ maxPage }} 页
        </span>
        <UiButton
          variant="outline"
          size="sm"
          class="console-pager__btn-next"
          :disabled="page >= maxPage"
          @click="onNext"
        >
          下一页
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.console-pager {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.console-pager__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  width: 100%;
}

.console-pager__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  min-width: 0;
}

.console-pager__total {
  font-size: 13px;
  white-space: nowrap;
}

.console-pager__size {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.console-pager__size .sel {
  min-width: 4.5rem;
  font-size: var(--ui-ctrl-font);
}

.console-pager__nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin-left: auto;
}

.console-pager__jump {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.console-pager__jump .inp,
.console-pager__jump .console-pager__jump-inp {
  width: 4rem;
  min-height: var(--ui-ctrl-height);
}

.console-pager--embedded {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}

@media (max-width: 720px) {
  .console-pager__bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .console-pager__meta {
    width: 100%;
    justify-content: space-between;
    gap: 10px 14px;
  }

  .console-pager__nav {
    margin-left: 0;
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    column-gap: 8px;
    row-gap: 8px;
    align-items: center;
  }

  .console-pager__btn-prev {
    grid-column: 1;
    grid-row: 1;
    width: 100%;
    min-width: 0;
    padding-left: 8px;
    padding-right: 8px;
  }

  .console-pager__jump {
    grid-column: 2;
    grid-row: 1;
    justify-self: center;
    flex-wrap: wrap;
    justify-content: center;
    max-width: 100%;
  }

  .console-pager__btn-next {
    grid-column: 3;
    grid-row: 1;
    width: 100%;
    min-width: 0;
    padding-left: 8px;
    padding-right: 8px;
  }
}
</style>
