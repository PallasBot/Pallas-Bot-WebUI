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
  cellClass?: (row: R) => string | undefined;
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
              :class="[
                col.key === columns[0]?.key ? 'tbl__cell--name' : '',
                col.align === 'right' ? 'tbl__cell--num' : '',
              ]"
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
              :class="[
                col.key === columns[0]?.key ? 'tbl__cell--name' : '',
                col.align === 'right' ? 'tbl__cell--num' : '',
                col.cellClass?.(row),
              ]"
            >
              <div class="tbl__cell-main">{{ col.value(row) }}</div>
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
  border: none;
  border-radius: var(--radius-control, 8px);
  background: transparent;
}

.tbl {
  width: 100%;
  table-layout: auto;
  border-collapse: collapse;
}

.tbl td,
.tbl th {
  padding: 12px 14px;
  vertical-align: middle;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
}

.tbl__cell--name {
  min-width: 7.5rem;
  max-width: 14rem;
  word-break: break-word;
}

.tbl__cell--num {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  min-width: 4.5rem;
}

.tbl__cell-main {
  font-weight: 500;
}

.tbl__cell--name .tbl__cell-main {
  font-weight: 600;
}

.tbl thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  font-size: 0.76rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-muted) 70%, var(--bg-card));
}

.tbl tbody tr:last-child td {
  border-bottom: 0;
}

.tbl tbody tr:hover td {
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}

.ai-subcell {
  margin-top: 6px;
  padding: 2px 6px;
  display: inline-block;
  max-width: 100%;
  font-size: 0.72rem;
  line-height: 1.35;
  color: color-mix(in srgb, var(--danger, #fb7185) 82%, var(--text));
  background: color-mix(in srgb, var(--danger, #fb7185) 10%, transparent);
  border-radius: 4px;
  white-space: normal;
  word-break: break-word;
}

.stat-cell--ok {
  color: var(--ok, #22c55e);
}

.stat-cell--warn {
  color: var(--warn, #f59e0b);
}

.stat-cell--danger {
  color: var(--danger, #fb7185);
}

.stat-cell--muted {
  color: var(--text-muted);
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

  .tbl__cell--name {
    min-width: 6rem;
    max-width: 9rem;
  }

  .tbl__cell--num {
    min-width: 3.5rem;
    font-size: 0.8125rem;
  }
}
</style>
