<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    placeholder?: string;
    disabled?: boolean;
    /** stacked：芯片在上；embedded：单框嵌入（配置表单） */
    variant?: "stacked" | "embedded";
    options?: string[];
  }>(),
  {
    placeholder: "输入后回车添加…",
    disabled: false,
    variant: "stacked",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const draft = ref("");
const searchQuery = ref("");
const moreOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const shellRef = ref<HTMLElement | null>(null);
const shellWidth = ref(240);
const popoverInputRef = ref<HTMLInputElement | null>(null);

const isEmbedded = computed(() => props.variant === "embedded");

const TAG_SLOT = 88;
const MORE_SLOT = 88;
const PAD = 20;

const maxVisibleTags = computed(() => {
  if (!isEmbedded.value) return props.modelValue.length;
  const available = Math.max(0, shellWidth.value - MORE_SLOT - PAD);
  return Math.max(0, Math.floor(available / TAG_SLOT));
});

const visibleTags = computed(() => {
  if (!isEmbedded.value) return props.modelValue;
  return props.modelValue.slice(0, maxVisibleTags.value);
});

const hiddenCount = computed(() => {
  if (!isEmbedded.value) return 0;
  return Math.max(0, props.modelValue.length - maxVisibleTags.value);
});

const filteredAdded = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.modelValue;
  return props.modelValue.filter((tag) => tag.toLowerCase().includes(q));
});

const filteredOptions = computed(() => {
  const opts = props.options ?? [];
  const q = searchQuery.value.trim().toLowerCase();
  return opts.filter(
    (opt) => !props.modelValue.includes(opt) && (!q || opt.toLowerCase().includes(q)),
  );
});

const canAddFromSearch = computed(() => {
  const trimmed = searchQuery.value.trim();
  return Boolean(trimmed) && !props.modelValue.includes(trimmed);
});

function commitTag(raw: string) {
  const value = raw.trim();
  if (!value || props.modelValue.includes(value)) return;
  emit("update:modelValue", [...props.modelValue, value]);
}

function commitDraft() {
  commitTag(draft.value);
  draft.value = "";
}

function removeAt(index: number) {
  const next = props.modelValue.slice();
  next.splice(index, 1);
  emit("update:modelValue", next);
}

function removeTag(tag: string) {
  const index = props.modelValue.indexOf(tag);
  if (index >= 0) removeAt(index);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    commitDraft();
    return;
  }
  if (event.key === "Backspace" && !draft.value && props.modelValue.length) {
    removeAt(props.modelValue.length - 1);
  }
}

function onPopoverKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && canAddFromSearch.value) {
    event.preventDefault();
    commitTag(searchQuery.value);
    searchQuery.value = "";
  }
  if (event.key === "Escape") {
    moreOpen.value = false;
  }
}

async function setMoreOpen(open: boolean) {
  moreOpen.value = open;
  if (open) {
    searchQuery.value = "";
    await nextTick();
    popoverInputRef.value?.focus();
  }
}

function onDocPointerDown(event: PointerEvent) {
  if (!moreOpen.value || !rootRef.value) return;
  if (!rootRef.value.contains(event.target as Node)) {
    moreOpen.value = false;
  }
}

function measureShell() {
  if (shellRef.value) shellWidth.value = shellRef.value.offsetWidth;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  document.addEventListener("pointerdown", onDocPointerDown);
  measureShell();
  if (typeof ResizeObserver !== "undefined" && shellRef.value) {
    resizeObserver = new ResizeObserver(() => measureShell());
    resizeObserver.observe(shellRef.value);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointerDown);
  resizeObserver?.disconnect();
});

watch(
  () => props.modelValue.length,
  () => {
    if (isEmbedded.value) measureShell();
  },
);
</script>

<template>
  <div
    ref="rootRef"
    class="tags-input"
    :class="{
      'tags-input--disabled': disabled,
      'tags-input--embedded': isEmbedded,
      'tags-input--stacked': !isEmbedded,
    }"
  >
    <template v-if="!isEmbedded">
      <div
        v-if="modelValue.length"
        class="tags-input__chips"
      >
        <span
          v-for="(tag, index) in modelValue"
          :key="`${tag}-${index}`"
          class="admin-chip tags-input__chip"
        >
          <span class="tags-input__chip-text">{{ tag }}</span>
          <button
            type="button"
            class="admin-chip__rm"
            :aria-label="`移除 ${tag}`"
            :disabled="disabled"
            @click="removeAt(index)"
          >
            ×
          </button>
        </span>
      </div>
      <input
        v-model="draft"
        class="inp tags-input__field"
        type="text"
        :placeholder="placeholder"
        :disabled="disabled"
        @keydown="onKeydown"
        @blur="commitDraft"
      >
    </template>

    <template v-else>
      <div
        ref="shellRef"
        class="tags-input__shell"
      >
        <div class="tags-input__shell-chips">
          <span
            v-for="(tag, index) in visibleTags"
            :key="`${tag}-${index}`"
            class="tags-input__embed-chip"
          >
            <span class="tags-input__embed-chip-text">{{ tag }}</span>
            <button
              type="button"
              class="tags-input__embed-chip-rm"
              :aria-label="`移除 ${tag}`"
              :disabled="disabled"
              @click="removeAt(index)"
            >
              ×
            </button>
          </span>
          <span
            v-if="hiddenCount > 0"
            class="tags-input__embed-more-count"
          >+{{ hiddenCount }}</span>
        </div>
        <button
          type="button"
          class="tags-input__more-btn"
          :disabled="disabled"
          :aria-expanded="moreOpen"
          @click="setMoreOpen(!moreOpen)"
        >
          + 更多
        </button>
      </div>

      <div
        v-if="moreOpen"
        class="tags-input__popover"
        role="dialog"
        aria-label="管理标签"
      >
        <div class="tags-input__popover-search">
          <input
            ref="popoverInputRef"
            v-model="searchQuery"
            class="inp tags-input__popover-input"
            type="text"
            :placeholder="canAddFromSearch ? '回车添加新标签' : '搜索已添加…'"
            :disabled="disabled"
            @keydown="onPopoverKeydown"
          >
        </div>
        <div class="tags-input__popover-section">
          <div class="tags-input__popover-hd">
            已添加（{{ filteredAdded.length }}/{{ modelValue.length }}）
          </div>
          <div
            v-if="!filteredAdded.length"
            class="tags-input__popover-empty"
          >
            {{ searchQuery.trim() ? "无匹配项" : "暂无标签" }}
          </div>
          <ul
            v-else
            class="tags-input__popover-list"
          >
            <li
              v-for="tag in filteredAdded"
              :key="tag"
              class="tags-input__popover-row"
            >
              <span class="tags-input__popover-row-text">{{ tag }}</span>
              <button
                type="button"
                class="tags-input__popover-rm"
                :disabled="disabled"
                :aria-label="`移除 ${tag}`"
                @click="removeTag(tag)"
              >
                删除
              </button>
            </li>
          </ul>
        </div>
        <div
          v-if="(options?.length ?? 0) > 0"
          class="tags-input__popover-section"
        >
          <div class="tags-input__popover-hd">可选</div>
          <div
            v-if="!filteredOptions.length"
            class="tags-input__popover-empty"
          >
            {{ searchQuery.trim() ? "无匹配选项" : "已全部添加" }}
          </div>
          <ul
            v-else
            class="tags-input__popover-list"
          >
            <li
              v-for="opt in filteredOptions"
              :key="opt"
            >
              <button
                type="button"
                class="tags-input__popover-opt"
                :disabled="disabled"
                @click="commitTag(opt); searchQuery = ''"
              >
                {{ opt }}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tags-input {
  position: relative;
  min-width: 0;
}

.tags-input--stacked {
  display: grid;
  gap: 8px;
}

.tags-input__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
}

.tags-input__chip {
  font-weight: 600;
}

.tags-input__chip-text {
  word-break: break-all;
}

.tags-input__field {
  width: 100%;
}

.tags-input--disabled {
  opacity: 0.6;
}

.tags-input__shell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 4px 8px 4px 10px;
  border-radius: 8px;
  border: 1px solid var(--control-border, rgba(15, 23, 42, 0.14));
  background: color-mix(in srgb, var(--control-bg, #fff) 72%, var(--bg-muted, #f2f2f4) 28%);
  overflow: hidden;
}

.tags-input__shell-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.tags-input__embed-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 96px;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted, #64748b) 12%, transparent);
  color: var(--text, #0f172a);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.tags-input__embed-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tags-input__embed-chip-rm {
  border: none;
  background: transparent;
  color: var(--text-muted, #64748b);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.tags-input__embed-chip-rm:hover:not(:disabled) {
  color: var(--danger, #b91c1c);
}

.tags-input__embed-more-count {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent, #0284c7) 16%, transparent);
  color: var(--accent, #0284c7);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.tags-input__more-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent, #0284c7) 14%, transparent);
  color: var(--accent, #0284c7);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.tags-input__more-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent, #0284c7) 22%, transparent);
}

.tags-input__popover {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-width: 360px;
  border-radius: 10px;
  border: 1px solid var(--border-strong, rgba(15, 23, 42, 0.09));
  background: var(--bg-card, #fff);
  overflow: hidden;
}

.tags-input__popover-search {
  padding: 10px;
  border-bottom: 1px solid var(--border, rgba(15, 23, 42, 0.06));
}

.tags-input__popover-input {
  width: 100%;
  min-height: 34px;
}

.tags-input__popover-section {
  padding: 10px;
  border-bottom: 1px solid var(--border, rgba(15, 23, 42, 0.06));
}

.tags-input__popover-section:last-child {
  border-bottom: none;
}

.tags-input__popover-hd {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #64748b);
  margin-bottom: 8px;
}

.tags-input__popover-empty {
  font-size: 13px;
  color: var(--text-dim, #94a3b8);
  padding: 6px 0;
}

.tags-input__popover-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 160px;
  overflow: auto;
  display: grid;
  gap: 2px;
}

.tags-input__popover-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
}

.tags-input__popover-row:hover {
  background: color-mix(in srgb, var(--text, #0f172a) 4%, transparent);
}

.tags-input__popover-row-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.tags-input__popover-rm {
  border: none;
  background: transparent;
  color: var(--text-muted, #64748b);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.tags-input__popover-rm:hover:not(:disabled) {
  color: var(--danger, #b91c1c);
}

.tags-input__popover-opt {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text, #0f172a);
  cursor: pointer;
}

.tags-input__popover-opt:hover:not(:disabled) {
  background: color-mix(in srgb, var(--text, #0f172a) 4%, transparent);
}
</style>
