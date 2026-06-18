<script setup lang="ts">
import { ref, watch } from "vue";
import { fetchDbBackupBrowse } from "@/api/consoleApi";
import { axiosErrorDetail, catchAllApiHint, isCatchAllApiError } from "@/api/http";
import type { DbBackupBrowseData } from "@/api/pallasTypes";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";

const props = defineProps<{
  open: boolean;
  initialPath?: string;
}>();

const emit = defineEmits<{
  close: [];
  select: [path: string];
}>();

const busy = ref(false);
const err = ref("");
const browse = ref<DbBackupBrowseData | null>(null);

async function loadBrowse(path?: string) {
  busy.value = true;
  err.value = "";
  try {
    browse.value = await fetchDbBackupBrowse(path?.trim() || null);
  } catch (e) {
    err.value = isCatchAllApiError(e) ? catchAllApiHint() : axiosErrorDetail(e);
    browse.value = null;
  } finally {
    busy.value = false;
  }
}

function openFolder(path: string) {
  void loadBrowse(path);
}

function goParent() {
  const parent = browse.value?.parent;
  if (!parent) return;
  void loadBrowse(parent);
}

function chooseCurrent() {
  const current = browse.value?.current;
  if (!current) return;
  emit("select", current);
  emit("close");
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    void loadBrowse(props.initialPath);
  },
);
</script>

<template>
  <UiDialog
    :open="open"
    title="选择备份父目录"
    subtitle="在允许的目录范围内浏览并选择输出位置"
    title-id="backup-dir-picker-title"
    panel-class="backup-dir-picker__dialog"
    body-class="backup-dir-picker__bd"
    :busy="busy"
    @close="emit('close')"
  >
    <div
      v-if="err"
      class="alert alert--err backup-dir-picker__alert"
    >
      {{ err }}
    </div>

    <div
      class="backup-dir-picker__path muted backup-dir-picker__path-hover"
      :title="browse?.current || ''"
    >
      {{ browse?.current ? browse.current.split(/[/\\]/).filter(Boolean).pop() || browse.current : "加载中…" }}
    </div>

    <div class="backup-dir-picker__toolbar row-actions">
      <UiButton
        variant="outline"
        :disabled="busy || !browse?.parent"
        @click="goParent"
      >
        上一级
      </UiButton>
      <UiButton
        variant="outline"
        :disabled="busy || !browse?.default_path"
        @click="openFolder(browse?.default_path || '')"
      >
        默认目录
      </UiButton>
    </div>

    <ul
      class="backup-dir-picker__list"
      aria-label="子目录"
    >
      <li
        v-if="busy && !browse?.entries?.length"
        class="backup-dir-picker__empty muted"
      >
        正在读取目录…
      </li>
      <li
        v-else-if="!browse?.entries?.length"
        class="backup-dir-picker__empty muted"
      >
        当前目录下没有可进入的子文件夹
      </li>
      <li
        v-for="entry in browse?.entries || []"
        :key="entry.path"
      >
        <button
          type="button"
          class="backup-dir-picker__item"
          :disabled="busy"
          :title="entry.path"
          @click="openFolder(entry.path)"
        >
          <span class="backup-dir-picker__item-ico" aria-hidden="true">📁</span>
          <span class="backup-dir-picker__item-name">{{ entry.name }}</span>
        </button>
      </li>
    </ul>

    <div class="row-actions backup-dir-picker__actions">
      <UiButton
        variant="outline"
        :disabled="busy"
        @click="emit('close')"
      >
        取消
      </UiButton>
      <UiButton
        variant="primary"
        :disabled="busy || !browse?.current"
        @click="chooseCurrent"
      >
        选择此目录
      </UiButton>
    </div>
  </UiDialog>
</template>
