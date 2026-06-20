<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref, watch } from "vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";

export type StatColumn<R> = {
  key: string;
  label: string;
  value: (row: R) => string;
  sub?: (row: R) => string;
  align?: "left" | "right";
};

const props = withDefaults(
  defineProps<{
    title: string;
    hint?: string;
    rows: T[];
    columns: StatColumn<T>[];
    pageSize?: number;
    rowKey?: (row: T) => string;
    emptyText?: string;
    emptyHint?: string;
  }>(),
  {
    hint: "",
    pageSize: 8,
    emptyText: "暂无数据",
    emptyHint: "",
  },
);

const page = ref(1);

const totalPages = computed(() => Math.max(1, Math.ceil(props.rows.length / props.pageSize)));

watch(
  () => props.rows.length,
  () => {
    if (page.value > totalPages.value) page.value = totalPages.value;
  },
);

const pagedRows = computed(() => {
  const startIdx = (page.value - 1) * props.pageSize;
  return props.rows.slice(startIdx, startIdx + props.pageSize);
});

function keyOf(row: T, index: number): string {
  return props.rowKey ? props.rowKey(row) : String(index);
}
</script>

<template>
  <UiCard class="ai-stats-page__panel">
    <div class="ai-head">
      <h3 class="ai-head__title">{{ title }}</h3>
      <span v-if="hint" class="ai-head__hint">{{ hint }}</span>
    </div>
    <div v-if="rows.length" class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :class="{ 'tbl__cell--right': col.align === 'right' }"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in pagedRows" :key="keyOf(row, index)">
            <td
              v-for="col in columns"
              :key="col.key"
              :class="{ 'tbl__cell--right': col.align === 'right' }"
            >
              <div>{{ col.value(row) }}</div>
              <div v-if="col.sub && col.sub(row)" class="ai-subcell">{{ col.sub(row) }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="ai-empty">
      <span>{{ emptyText }}</span>
      <span v-if="emptyHint" class="ai-empty__hint">{{ emptyHint }}</span>
    </div>

    <div v-if="totalPages > 1" class="stat-table__pager">
      <UiButton size="sm" variant="ghost" :disabled="page <= 1" @click="page -= 1">上一页</UiButton>
      <span class="stat-table__pager-label">{{ page }} / {{ totalPages }}</span>
      <UiButton size="sm" variant="ghost" :disabled="page >= totalPages" @click="page += 1">下一页</UiButton>
    </div>
  </UiCard>
</template>

<style scoped>
.table-wrap {
  min-width: 0;
  overflow: auto;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--text) 2%, transparent);
}

.tbl {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.tbl td,
.tbl th {
  word-break: break-word;
  padding: 12px 14px;
  vertical-align: top;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
}

.tbl td:first-child,
.tbl th:first-child {
  width: 34%;
}

.tbl thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-card) 94%, var(--text) 6%);
}

.tbl tbody tr:last-child td {
  border-bottom: 0;
}

.tbl tbody tr:hover td {
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}

.tbl__cell--right {
  text-align: right;
}

.ai-subcell {
  margin-top: 4px;
  font-size: 0.76rem;
  color: var(--text-muted);
  white-space: normal;
  word-break: break-word;
}

.stat-table__pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}

.stat-table__pager-label {
  font-size: 0.8rem;
  color: var(--muted, #94a3b8);
}

@media (max-width: 560px) {
  .tbl td,
  .tbl th {
    padding: 10px 11px;
  }

  .tbl td:first-child,
  .tbl th:first-child {
    width: 44%;
  }
}
</style>
