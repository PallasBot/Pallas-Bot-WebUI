<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  fetchLlmModelAdminStatus,
  fetchLlmProviderModels,
  fetchMediaAssetsDownloadJob,
  fetchMediaAssetsStatus,
  openAiInstallJobEventSource,
  postAiInstall,
  postMediaAssetsDownload,
  type MediaAssetsStatus,
} from "@/api/consoleApi";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { pushConsoleToast } from "@/utils/consoleToast";
import { toastApiError } from "@/utils/consoleToastFeedback";
import { InstallJobFailedError, waitForInstallJob } from "@/utils/installJobStream";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const loading = ref(false);
const modelName = ref("");
const modelCount = ref(0);
const aiReachable = ref(false);
const assets = ref<MediaAssetsStatus | null>(null);
const downloadBusy = ref(false);
const downloadProgress = ref("");
const installBusy = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const mediaReady = computed(() => Boolean(assets.value?.all_media_assets_ready));
const packages = computed(() => assets.value?.media_packages_enabled ?? {});
const anyMediaPackage = computed(
  () => Boolean(packages.value.sing || packages.value.tts || packages.value.chat),
);
const deployMode = computed(() => assets.value?.deploy_mode || "unknown");
const downloadAllowed = computed(() => Boolean(assets.value?.download_allowed));
const dockerGuide = computed(
  () => deployMode.value === "docker" || (assets.value?.hints ?? []).includes("docker_use_latest_image"),
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
    assets.value = media;
    if (media && media.ok === false && media.error) {
      err.value = media.error;
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollJob(jobId: string) {
  stopPoll();
  pollTimer = setInterval(async () => {
    try {
      const job = await fetchMediaAssetsDownloadJob(jobId);
      downloadProgress.value = job.message || job.state;
      if (job.state === "done" || job.state === "failed") {
        stopPoll();
        downloadBusy.value = false;
        if (job.state === "done") {
          pushConsoleToast("媒体权重已就绪", "ok");
        } else {
          pushConsoleToast(job.error || "媒体权重下载失败", "err");
        }
        await refresh();
      }
    } catch (e) {
      stopPoll();
      downloadBusy.value = false;
      toastApiError(e, "轮询下载任务失败");
    }
  }, 2000);
}

async function startDownload() {
  downloadBusy.value = true;
  downloadProgress.value = "启动下载…";
  err.value = "";
  try {
    const job = await postMediaAssetsDownload();
    downloadProgress.value = job.message || "下载中…";
    if (job.state === "done") {
      downloadBusy.value = false;
      pushConsoleToast(job.message || "已就绪", "ok");
      await refresh();
      return;
    }
    await pollJob(job.job_id);
  } catch (e) {
    downloadBusy.value = false;
    toastApiError(e, "无法启动媒体权重下载");
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
      downloadProgress.value = message;
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

onUnmounted(() => {
  stopPoll();
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
            :disabled="loading || downloadBusy || installBusy"
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
          <h3 class="ai-capabilities__card-title">对话模型（Ollama / 本地）</h3>
          <p class="muted ai-capabilities__card-lead">
            闲聊与接话用的是对话模型，不是唱歌权重。全栈默认不预拉，请在「接入」拉取（如 <code>qwen2.5:7b</code>）。
          </p>
          <ul class="ai-capabilities__status-list">
            <li>AI 服务：{{ aiReachable ? "可达" : "不可达" }}</li>
            <li>当前模型：{{ modelName || "未配置" }}</li>
            <li>本地模型数：{{ modelCount }}</li>
          </ul>
          <div class="row-actions ai-capabilities__card-actions">
            <RouterLink :to="aiConfigSectionPath('provider')">
              <UiButton variant="primary">去拉取默认模型</UiButton>
            </RouterLink>
            <RouterLink :to="aiConfigSectionPath('strategy')">
              <UiButton variant="outline">打开对话总闸</UiButton>
            </RouterLink>
          </div>
        </section>

        <section class="ai-capabilities__card">
          <h3 class="ai-capabilities__card-title">唱歌 · TTS · 媒体权重</h3>
          <p class="muted ai-capabilities__card-lead">
            唱歌 / TTS / 醉聊 RWKV 依赖媒体栈与本地 zip 权重（与 Ollama 无关）。
          </p>
          <ul class="ai-capabilities__status-list">
            <li>部署模式：{{ deployMode }}</li>
            <li>
              任务包：sing={{ packages.sing ? "开" : "关" }}
              · tts={{ packages.tts ? "开" : "关" }}
              · chat={{ packages.chat ? "开" : "关" }}
            </li>
            <li
              v-for="(row, id) in assets?.assets || {}"
              :key="id"
            >
              {{ id }}：{{ row.ready ? "就绪" : "缺失" }}
            </li>
          </ul>

          <div
            v-if="mediaReady && anyMediaPackage"
            class="alert alert--ok"
          >
            媒体权重与任务包已就绪。群内唱歌还需安装插件
            <RouterLink to="/plugins/store">pallas-plugin-ai-media</RouterLink>。
          </div>

          <div
            v-else-if="dockerGuide"
            class="ai-capabilities__docker"
          >
            <p class="muted">
              Docker / slim 镜像不代跑下载。请在宿主机改 compose 后重启 AI：
            </p>
            <pre class="ai-capabilities__pre"># compose.env
PALLAS_AI_IMAGE=pallasbot/pallas-bot-ai:latest
# 可选 GPU：叠加 docker-compose.full.gpu.yml
docker compose -f docker-compose.full.yml --env-file ./pallas-bot/config/compose.env up -d
# 启动日志应出现模型下载/解压</pre>
            <p class="muted">
              对话模型仍用 WebUI「接入」拉取，或 compose 加 <code>--profile pull-models</code>。
            </p>
          </div>

          <div
            v-else
            class="row-actions ai-capabilities__card-actions"
          >
            <UiButton
              v-if="!anyMediaPackage"
              variant="primary"
              :busy="installBusy"
              :disabled="installBusy || downloadBusy"
              @click="reinstallWithMedia"
            >
              重新安装（含媒体）
            </UiButton>
            <UiButton
              v-if="downloadAllowed && !mediaReady"
              variant="primary"
              :busy="downloadBusy"
              :disabled="downloadBusy || installBusy"
              @click="startDownload"
            >
              下载默认媒体权重
            </UiButton>
            <RouterLink :to="aiConfigSectionPath('connection')">
              <UiButton variant="outline">AI 服务安装选项</UiButton>
            </RouterLink>
          </div>
          <p
            v-if="downloadProgress"
            class="muted"
          >
            {{ downloadProgress }}
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

.ai-capabilities__pre {
  margin: 8px 0;
  padding: 10px 12px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.45;
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg) 88%, var(--border));
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
