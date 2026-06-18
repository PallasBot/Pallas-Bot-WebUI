<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import {
  protocolApiErrorMessage,
  protocolFetchQrcodeMeta,
  protocolQrcodeImageUrl,
} from "@/api/protocolApi";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";

const props = defineProps<{
  open: boolean;
  mountUrl: string | null;
  accountId: string | null;
  accountTitle: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const hint = ref("加载中…");
const updatedAt = ref(0);
const exists = ref(false);
const refreshBusy = ref(false);
const imageErr = ref(false);

const imageUrl = computed(() => {
  if (!props.mountUrl || !props.accountId || !exists.value) return "";
  return protocolQrcodeImageUrl(props.mountUrl, props.accountId, updatedAt.value || undefined);
});

const updatedLabel = computed(() => {
  if (!updatedAt.value) return "";
  try {
    return `更新于 ${new Date(updatedAt.value * 1000).toLocaleString()} · 可直接扫码`;
  } catch {
    return "";
  }
});

let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopPoll() {
  if (pollTimer == null) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

async function refreshMeta(force = false) {
  const mount = props.mountUrl;
  const id = props.accountId;
  if (!mount || !id) return;
  if (refreshBusy.value && !force) return;
  refreshBusy.value = true;
  try {
    const meta = await protocolFetchQrcodeMeta(mount, id);
    const nowExists = meta.exists === true;
    const ts = meta.updated_at ?? 0;
    if (nowExists && (force || ts !== updatedAt.value)) {
      updatedAt.value = ts;
      imageErr.value = false;
    }
    exists.value = nowExists;
    if (nowExists) {
      hint.value = updatedLabel.value || "可直接扫码登录";
    } else {
      hint.value = "暂无二维码；请先启动协议进程并等待登录页生成。";
    }
  } catch (e) {
    if (force) {
      exists.value = false;
      hint.value = protocolApiErrorMessage(e, "二维码加载失败");
    }
  } finally {
    refreshBusy.value = false;
  }
}

function onImageError() {
  imageErr.value = true;
  hint.value = "二维码加载失败，请点「刷新」重试";
}

watch(
  () => props.open,
  (open) => {
    stopPoll();
    if (!open) {
      hint.value = "加载中…";
      updatedAt.value = 0;
      exists.value = false;
      imageErr.value = false;
      return;
    }
    void refreshMeta(true);
    pollTimer = setInterval(() => {
      void refreshMeta(false);
    }, 3000);
  },
);

watch(updatedAt, () => {
  if (exists.value && updatedLabel.value) hint.value = updatedLabel.value;
});

onUnmounted(() => {
  stopPoll();
});
</script>

<template>
  <UiDialog
    :open="open"
    title="登录二维码"
    :subtitle="accountTitle"
    title-id="protocol-qrcode-modal-title"
    root-class="protocol-qrcode-modal"
    panel-class="protocol-qrcode-modal__dialog"
    body-class="protocol-qrcode-modal__bd"
    @close="emit('close')"
  >
    <p class="muted protocol-qrcode-modal__hint">
      {{ hint }}
    </p>
    <div
      v-if="exists && imageUrl && !imageErr"
      class="protocol-qrcode-modal__frame"
    >
      <img
        class="protocol-qrcode-modal__img"
        :src="imageUrl"
        alt="协议端登录二维码"
        @error="onImageError"
      >
    </div>
    <div class="row-actions protocol-qrcode-modal__actions">
      <UiButton
        :disabled="refreshBusy"
        @click="refreshMeta(true)"
      >
        {{ refreshBusy ? "刷新中…" : "刷新" }}
      </UiButton>
      <UiButton
        variant="primary"
        @click="emit('close')"
      >
        关闭
      </UiButton>
    </div>
  </UiDialog>
</template>
