<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  fetchLlmModelAdminStatus,
  fetchLlmProviderModels,
  fetchMediaAssetsStatus,
  openAiInstallJobEventSource,
  postAiInstall,
} from "@/api/consoleApi";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import MediaModelAdminPanel from "@/components/ai-config/MediaModelAdminPanel.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { pushConsoleToast } from "@/utils/consoleToast";
import { toastApiError } from "@/utils/consoleToastFeedback";
import { InstallJobFailedError, waitForInstallJob } from "@/utils/installJobStream";

const panelNavIcon = usePanelNavIcon();
const mediaRef = ref<InstanceType<typeof MediaModelAdminPanel> | null>(null);
const err = ref("");
const loading = ref(false);
const modelName = ref("");
const modelCount = ref(0);
const aiReachable = ref(false);
const installBusy = ref(false);
const installProgress = ref("");
const anyMediaPackage = ref(false);

const packagesHint = computed(() =>
  anyMediaPackage.value ? "媒体任务包已启用" : "媒体任务包未开，可重新安装含媒体",
);

async function refresh() {
  loading.value = true;
  err.value = "";
  try {
    const [admin, localModels, media] = await Promise.all([
      fetchLlmModelAdminStatus().catch(() => null),
      fetchLlmProviderModels("local").catch(() => null),
      fetchMediaAssetsStatus().catch(() => null),
    ]);
    aiReachable.value = Boolean(admin?.ai_reachable);
    modelName.value = String(admin?.model || "").trim();
    modelCount.value = Array.isArray(localModels?.models) ? localModels.models.length : 0;
    const pkgs = media?.media_packages_enabled ?? {};
    anyMediaPackage.value = Boolean(pkgs.sing || pkgs.tts || pkgs.chat);
    await mediaRef.value?.refresh?.();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function reinstallWithMedia() {
  installBusy.value = true;
  err.value = "";
  try {
    const job = await postAiInstall({
      action: "bootstrap",
      with_media: true,
      remote_only: false,
      no_start: false,
    });
    await waitForInstallJob(job.job_id, openAiInstallJobEventSource, (message) => {
      installProgress.value = message;
    });
    pushConsoleToast("已重新安装（含媒体）", "ok");
    await refresh();
  } catch (e) {
    if (e instanceof InstallJobFailedError) {
      err.value = e.message;
    }
    toastApiError(e, "含媒体安装失败");
  } finally {
    installBusy.value = false;
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="ai-capabilities">
    <UiCard
      tag="div"
      glass
      class="ai-config-section__panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <ConsoleNavIcon
            class="panel__title-ico"
            :name="panelNavIcon"
          />能力包
        </h2>
        <div class="row-actions ai-capabilities__hd-actions">
          <UiButton
            :disabled="loading || installBusy"
            @click="refresh"
          >
            {{ loading ? "刷新中…" : "刷新" }}
          </UiButton>
        </div>
      </div>
      <div class="panel__bd">
        <div
          v-if="err"
          class="alert alert--err"
        >
          {{ err }}
        </div>

        <section class="ai-capabilities__card">
          <h3 class="ai-capabilities__card-title">对话模型（LLM）</h3>
          <p class="muted ai-capabilities__card-lead">
            默认用 Bot 内核直连 Provider（Ollama / 云端）。请打开
            <code>LLM_CHAT_ENABLED</code>。与下方遗留 RWKV
            <code>chat</code> 资源包不是同一条路径。
          </p>
          <ul class="ai-capabilities__status-list">
            <li>AI Runtime：{{ aiReachable ? "可达" : "不可达（聊天可不依赖）" }}</li>
            <li>当前模型：{{ modelName || "未配置" }}</li>
            <li>本地模型数：{{ modelCount }}</li>
          </ul>
          <div class="row-actions ai-capabilities__card-actions">
            <RouterLink :to="aiConfigSectionPath('provider')">
              <UiButton variant="primary">去拉取 / 接入模型</UiButton>
            </RouterLink>
            <RouterLink :to="aiConfigSectionPath('strategy')">
              <UiButton variant="outline">打开对话总闸</UiButton>
            </RouterLink>
          </div>
        </section>

        <section class="ai-capabilities__card">
          <h3 class="ai-capabilities__card-title">唱歌 · TTS · 媒体模型</h3>
          <p class="muted ai-capabilities__card-lead">
            {{ packagesHint }}。可分项下载/删除资源包，并切换默认唱歌音色与 TTS 参考音色。
          </p>
          <MediaModelAdminPanel ref="mediaRef" />
          <div class="row-actions ai-capabilities__card-actions ai-capabilities__install">
            <UiButton
              v-if="!anyMediaPackage"
              variant="primary"
              :busy="installBusy"
              :disabled="installBusy"
              @click="reinstallWithMedia"
            >
              重新安装（含媒体）
            </UiButton>
            <RouterLink :to="aiConfigSectionPath('connection')">
              <UiButton variant="outline">媒体服务安装选项</UiButton>
            </RouterLink>
          </div>
          <p
            v-if="installProgress"
            class="muted"
          >
            {{ installProgress }}
          </p>
        </section>
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.ai-capabilities__card {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
}

.ai-capabilities__card:first-of-type {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.ai-capabilities__card-title {
  margin: 0 0 6px;
  font-size: 1rem;
}

.ai-capabilities__card-lead {
  margin: 0 0 10px;
  font-size: 0.875rem;
  line-height: 1.5;
}

.ai-capabilities__status-list {
  margin: 0 0 12px;
  padding-left: 1.2em;
  font-size: 0.875rem;
  line-height: 1.55;
}

.ai-capabilities__card-actions {
  flex-wrap: wrap;
  gap: 8px;
}

.ai-capabilities__install {
  margin-top: 12px;
}

@media (max-width: 560px) {
  .ai-capabilities__hd-actions {
    width: 100%;
  }

  .ai-capabilities__hd-actions :deep(.btn) {
    flex: 1;
  }

  .ai-capabilities__card-actions :deep(.btn),
  .ai-capabilities__card-actions a {
    width: 100%;
  }

  .ai-capabilities__card-actions a :deep(.btn) {
    width: 100%;
  }
}
</style>
