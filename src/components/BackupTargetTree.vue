<script setup lang="ts">
import { computed, ref, watch } from "vue";

type TreeGroup = {
  id: string;
  label: string;
  items: { value: string; label: string }[];
};

const props = withDefaults(
  defineProps<{
    options: string[];
    modelValue: string[];
    disabled?: boolean;
    backend?: "postgres" | "mongodb" | null;
  }>(),
  {
    disabled: false,
    backend: null,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const expanded = ref<Record<string, boolean>>({});

function splitTarget(value: string): { groupId: string; groupLabel: string; itemLabel: string } {
  const dot = value.indexOf(".");
  if (dot > 0) {
    const groupId = value.slice(0, dot);
    return { groupId, groupLabel: groupId, itemLabel: value.slice(dot + 1) || value };
  }
  if (props.backend === "postgres") {
    return { groupId: "public", groupLabel: "public", itemLabel: value };
  }
  return { groupId: "__root__", groupLabel: "集合", itemLabel: value };
}

const groups = computed<TreeGroup[]>(() => {
  const map = new Map<string, TreeGroup>();
  for (const value of props.options) {
    const { groupId, groupLabel, itemLabel } = splitTarget(value);
    let group = map.get(groupId);
    if (!group) {
      group = { id: groupId, label: groupLabel, items: [] };
      map.set(groupId, group);
    }
    group.items.push({ value, label: itemLabel });
  }
  return [...map.values()]
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => a.label.localeCompare(b.label, "zh-CN")) }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
});

watch(
  groups,
  (next) => {
    const open = { ...expanded.value };
    for (const g of next) {
      if (!(g.id in open)) open[g.id] = true;
    }
    expanded.value = open;
  },
  { immediate: true },
);

function isExpanded(groupId: string): boolean {
  return expanded.value[groupId] !== false;
}

function toggleExpanded(groupId: string) {
  expanded.value = { ...expanded.value, [groupId]: !isExpanded(groupId) };
}

function groupSelectedCount(group: TreeGroup): number {
  return group.items.filter((item) => props.modelValue.includes(item.value)).length;
}

function groupCheckState(group: TreeGroup): "all" | "none" | "partial" {
  const n = groupSelectedCount(group);
  if (n === 0) return "none";
  if (n === group.items.length) return "all";
  return "partial";
}

function setGroup(group: TreeGroup, checked: boolean) {
  const next = new Set(props.modelValue);
  for (const item of group.items) {
    if (checked) next.add(item.value);
    else next.delete(item.value);
  }
  emit("update:modelValue", [...next]);
}

function toggleItem(value: string, checked: boolean) {
  const next = new Set(props.modelValue);
  if (checked) next.add(value);
  else next.delete(value);
  emit("update:modelValue", [...next]);
}
</script>

<template>
  <div
    class="backup-target-tree"
    role="tree"
    :aria-label="backend === 'postgres' ? '选择表' : '选择集合'"
  >
    <p
      v-if="!options.length"
      class="backup-target-tree__empty muted"
    >
      暂无可选{{ backend === "postgres" ? "表" : "集合" }}
    </p>
    <ul
      v-else
      class="backup-target-tree__list"
    >
      <li
        v-for="group in groups"
        :key="group.id"
        class="backup-target-tree__group"
        role="treeitem"
        :aria-expanded="isExpanded(group.id)"
      >
        <div class="backup-target-tree__group-hd">
          <button
            type="button"
            class="backup-target-tree__expand"
            :aria-label="isExpanded(group.id) ? `收起 ${group.label}` : `展开 ${group.label}`"
            :disabled="disabled"
            @click="toggleExpanded(group.id)"
          >
            <span
              class="backup-target-tree__expand-ico"
              aria-hidden="true"
            >{{ isExpanded(group.id) ? "▾" : "▸" }}</span>
          </button>
          <span
            class="backup-target-tree__folder"
            aria-hidden="true"
          >📁</span>
          <label class="backup-target-tree__group-label">
            <input
              type="checkbox"
              :checked="groupCheckState(group) === 'all'"
              :disabled="disabled"
              :aria-checked="groupCheckState(group) === 'partial' ? 'mixed' : groupCheckState(group) === 'all'"
              @change="setGroup(group, ($event.target as HTMLInputElement).checked)"
            >
            <span>{{ group.label }}</span>
            <span class="backup-target-tree__count muted">{{ groupSelectedCount(group) }}/{{ group.items.length }}</span>
          </label>
        </div>
        <ul
          v-show="isExpanded(group.id)"
          class="backup-target-tree__children"
          role="group"
        >
          <li
            v-for="item in group.items"
            :key="item.value"
            class="backup-target-tree__leaf"
            role="treeitem"
          >
            <label class="backup-target-tree__leaf-label">
              <input
                type="checkbox"
                :checked="modelValue.includes(item.value)"
                :disabled="disabled"
                @change="toggleItem(item.value, ($event.target as HTMLInputElement).checked)"
              >
              <span
                class="backup-target-tree__leaf-name"
                :title="item.value"
              >{{ item.label }}</span>
            </label>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>
