import { computed, ref, type Ref } from "vue";

/** 卡片多选：与「实例与连接」数据库 Bot 卡片栏行为一致 */
export function useCardBulkSelection<TKey extends string | number>() {
  const selected = ref(new Set<TKey>()) as Ref<Set<TKey>>;

  const selectedCount = computed(() => selected.value.size);

  const sortedSelected = computed(() => {
    const list = [...selected.value];
    list.sort((a, b) => {
      if (typeof a === "number" && typeof b === "number") return a - b;
      return String(a).localeCompare(String(b), "zh-CN", { numeric: true });
    });
    return list;
  });

  function isSelected(key: TKey): boolean {
    return selected.value.has(key);
  }

  function setSelected(key: TKey, on: boolean) {
    const next = new Set(selected.value);
    if (on) next.add(key);
    else next.delete(key);
    selected.value = next;
  }

  function pageAllSelected(pageKeys: readonly TKey[]): boolean {
    if (!pageKeys.length) return false;
    return pageKeys.every((k) => selected.value.has(k));
  }

  function toggleSelectAllOnPage(pageKeys: readonly TKey[]) {
    if (!pageKeys.length) return;
    const next = new Set(selected.value);
    const allOnPage = pageKeys.every((k) => next.has(k));
    if (allOnPage) {
      for (const k of pageKeys) next.delete(k);
    } else {
      for (const k of pageKeys) next.add(k);
    }
    selected.value = next;
  }

  function clearSelection() {
    selected.value = new Set();
  }

  function pruneSelection(knownKeys: ReadonlySet<TKey>) {
    const next = new Set<TKey>();
    for (const k of selected.value) {
      if (knownKeys.has(k)) next.add(k);
    }
    selected.value = next;
  }

  return {
    selected,
    selectedCount,
    sortedSelected,
    isSelected,
    setSelected,
    pageAllSelected,
    toggleSelectAllOnPage,
    clearSelection,
    pruneSelection,
  };
}

export type CardBulkSelection<TKey extends string | number> = ReturnType<typeof useCardBulkSelection<TKey>>;
