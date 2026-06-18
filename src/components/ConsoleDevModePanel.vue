<script setup lang="ts">
import { computed, ref } from "vue";
import { putCommonConfig } from "@/api/consoleApi";
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import { PALLAS_WEBUI_SECTION_ID } from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

const DEV_MODE_TOOLTIP =
  "联调时可跳过登录与 API token；保存后立即生效，无需重启 Bot。CORS 等中间件变更仍需重启 hub。";

const props = withDefaults(
  defineProps<{
    active: boolean;
    compact?: boolean;
    toolbar?: boolean;
    showBanner?: boolean;
    showPanel?: boolean;
  }>(),
  {
    compact: false,
    toolbar: false,
    showBanner: true,
    showPanel: true,
  },
);

const emit = defineEmits<{
  updated: [active: boolean];
}>();

const busy = ref(false);
const err = ref("");

const enableConfirmText =
  "开启开发模式将跳过控制台 JSON API 与静态页登录鉴权，任何能访问该地址的人均可读写控制台。\n\n仅在受信任的本机/内网联调时使用，生产环境务必保持关闭。\n\n确定开启？";

const switchLabel = computed(() => (props.active ? "开发模式已开启" : "开发模式已关闭"));

const showDevBanner = computed(() => props.showBanner && props.active && !props.toolbar);

async function applyDevMode(next: boolean) {
  if (busy.value) return;
  if (next && !window.confirm(enableConfirmText)) return;
  if (!next && !window.confirm("关闭后将恢复控制台 API 与页面登录鉴权。确定关闭开发模式？")) return;
  busy.value = true;
  err.value = "";
  try {
    await putCommonConfig(PALLAS_WEBUI_SECTION_ID, { pallas_webui_dev_mode: next });
    emit("updated", next);
    toastSaveSuccess(next ? "开发模式已开启（鉴权已跳过，立即生效）" : "开发模式已关闭（鉴权已恢复）");
  } catch (e) {
    err.value = axiosErrorDetail(e) || "保存失败";
    toastApiError(e, "保存开发模式失败");
  } finally {
    busy.value = false;
  }
}

function onToggleInput(want: boolean) {
  if (want === props.active) return;
  void applyDevMode(want);
}
</script>

<template>
  <div
    v-if="showDevBanner"
    class="console-dev-mode-banner alert alert--warn"
    role="status"
  >
    <strong>开发模式已开启</strong>
    <span>
      控制台 API 与页面鉴权已跳过；请勿在公网或生产环境长期开启。
      <RouterLink :to="{ path: '/common-config', query: { section: PALLAS_WEBUI_SECTION_ID } }">通用配置</RouterLink>
    </span>
  </div>

  <div
    v-else-if="showPanel && toolbar"
    class="shell__topbar-dev"
    :class="{ 'shell__topbar-dev--active': active }"
    :title="DEV_MODE_TOOLTIP"
  >
    <span class="shell__topbar-dev__label">开发模式</span>
    <ConsoleSwitch
      :model-value="active"
      :disabled="busy"
      tone="amber"
      :show-label="false"
      :aria-label="active ? '关闭开发模式' : '开启开发模式'"
      @update:model-value="onToggleInput"
    />
  </div>

  <div
    v-else-if="showPanel"
    class="console-dev-mode-panel"
    :class="{ 'console-dev-mode-panel--compact': compact, 'console-dev-mode-panel--active': active }"
  >
    <div
      v-if="err"
      class="alert alert--err"
    >{{ err }}</div>
    <div class="console-dev-mode-panel__row">
      <div>
        <div class="console-dev-mode-panel__title">{{ switchLabel }}</div>
        <p class="console-dev-mode-panel__desc muted">
          联调时可跳过登录与 API token；保存后立即生效，无需重启 Bot。
          <template v-if="!compact"> CORS 等中间件变更仍需重启 hub。</template>
        </p>
      </div>
      <ConsoleSwitch
        :model-value="active"
        :disabled="busy"
        tone="amber"
        :show-label="false"
        :aria-label="active ? '关闭开发模式' : '开启开发模式'"
        @update:model-value="onToggleInput"
      />
    </div>
  </div>
</template>
