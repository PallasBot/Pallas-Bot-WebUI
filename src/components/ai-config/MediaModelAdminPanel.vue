<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  fetchMediaAssetsDownloadJob,
  fetchMediaAssetsStatus,
  fetchSingBackends,
  fetchSingSpeakers,
  fetchTtsVoices,
  postMediaAssetsDelete,
  postMediaAssetsDownload,
  putSingDefaults,
  putTtsDefaults,
  type MediaAssetsStatus,
  type SingBackendsPayload,
  type SingSpeakersPayload,
  type TtsVoicesPayload,
} from "@/api/consoleApi";
import UiButton from "@/components/ui/UiButton.vue";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { pushConsoleToast } from "@/utils/consoleToast";
import { toastApiError } from "@/utils/consoleToastFeedback";

const ASSET_LABELS: Record<string, string> = {
  chat: "遗留 RWKV chat",
  sing_pallas: "唱歌 · pallas",
  sing_pretrain: "唱歌 · 预训练",
  tts: "TTS 权重",
};

const err = ref("");
const modelsErr = ref("");
const loading = ref(false);
const assets = ref<MediaAssetsStatus | null>(null);
const speakers = ref<SingSpeakersPayload | null>(null);
const backends = ref<SingBackendsPayload | null>(null);
const voices = ref<TtsVoicesPayload | null>(null);
const downloadBusy = ref(false);
const deleteBusy = ref("");
const saveBusy = ref(false);
const downloadProgress = ref("");
const promptOpen = ref(false);
const promptText = ref("");
const promptLang = ref("ja");
const textLang = ref("zh");
let pollTimer: ReturnType<typeof setInterval> | null = null;

const deployMode = computed(() => assets.value?.deploy_mode || "unknown");
const downloadAllowed = computed(() => Boolean(assets.value?.download_allowed));
const deleteAllowed = computed(() => Boolean(assets.value?.delete_allowed));
const dockerGuide = computed(
  () => deployMode.value === "docker" || (assets.value?.hints ?? []).includes("docker_use_latest_image"),
);
const assetRows = computed(() => {
  const map = assets.value?.assets || {};
  return Object.keys(ASSET_LABELS).map((id) => {
    const row = map[id] || {};
    return {
      id,
      label: ASSET_LABELS[id] || id,
      ready: Boolean(row.ready),
      path: row.path || "",
      sizeBytes: Number(row.size_bytes || 0),
    };
  });
});
const packages = computed(() => assets.value?.media_packages_enabled ?? {});
const speakersWritable = computed(() => Boolean(speakers.value?.writable));
const backendsWritable = computed(() => Boolean(backends.value?.writable ?? speakers.value?.writable));
const voicesWritable = computed(() => Boolean(voices.value?.writable));
const defaultSpeaker = computed(() => speakers.value?.default_speaker || "");
const preferredBackend = computed(() => backends.value?.preferred_backend || speakers.value?.preferred_backend || "");
const defaultVoicePath = computed(() => voices.value?.defaults?.ref_audio_path || "");

const selectedSpeakerId = ref("");
const selectedBackendId = ref("");
const selectedVoicePath = ref("");

const selectedSpeaker = computed(() =>
  (speakers.value?.speakers || []).find((sp) => sp.id === selectedSpeakerId.value) || null,
);
const selectedBackend = computed(() => {
  if (!selectedBackendId.value) return null;
  return (backends.value?.backends || []).find((be) => be.id === selectedBackendId.value) || null;
});
const selectedVoice = computed(() =>
  (voices.value?.voices || []).find((voice) => voice.path === selectedVoicePath.value) || null,
);

function syncSelectModels() {
  const speakerRows = speakers.value?.speakers || [];
  const defaultId = speakers.value?.default_speaker || "";
  selectedSpeakerId.value =
    defaultId || (speakerRows.find((sp) => sp.ready)?.id ?? speakerRows[0]?.id ?? "");
  selectedBackendId.value = preferredBackend.value;
  const voiceRows = voices.value?.voices || [];
  const defaultPath = voices.value?.defaults?.ref_audio_path || "";
  selectedVoicePath.value = defaultPath || voiceRows[0]?.path || "";
}

function formatSize(bytes: number): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function refresh() {
  loading.value = true;
  err.value = "";
  modelsErr.value = "";
  try {
    const results = await Promise.allSettled([
      fetchMediaAssetsStatus(),
      fetchSingSpeakers(),
      fetchSingBackends(),
      fetchTtsVoices(),
    ]);
    const media = results[0].status === "fulfilled" ? results[0].value : null;
    const sing = results[1].status === "fulfilled" ? results[1].value : null;
    const svc = results[2].status === "fulfilled" ? results[2].value : null;
    const tts = results[3].status === "fulfilled" ? results[3].value : null;

    if (results[0].status === "rejected") {
      throw results[0].reason;
    }
    assets.value = media;
    if (media && media.ok === false && media.error) {
      err.value = media.error;
    }
    speakers.value = sing;
    backends.value = svc;
    voices.value = tts;
    if (tts?.defaults) {
      promptText.value = String(tts.defaults.prompt_text || "");
      promptLang.value = String(tts.defaults.prompt_lang || "ja");
      textLang.value = String(tts.defaults.text_lang || "zh");
    }

    const modelFails = [results[1], results[2], results[3]]
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
    if (modelFails.length) {
      modelsErr.value = modelFails[0] || "无法读取唱歌音色 / backend / TTS 清单";
    }
    syncSelectModels();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    assets.value = null;
  } finally {
    loading.value = false;
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
          pushConsoleToast(job.message || "下载完成", "ok");
        } else {
          pushConsoleToast(job.error || job.message || "下载失败", "warn");
        }
        await refresh();
      }
    } catch (e) {
      stopPoll();
      downloadBusy.value = false;
      toastApiError(e, "轮询下载任务失败");
    }
  }, 1500);
}

async function startDownload(ids?: string[]) {
  downloadBusy.value = true;
  downloadProgress.value = "启动下载…";
  try {
    const job = await postMediaAssetsDownload(ids);
    downloadProgress.value = job.message || job.state;
    if (job.state === "done") {
      downloadBusy.value = false;
      pushConsoleToast(job.message || "已就绪", "ok");
      await refresh();
      return;
    }
    await pollJob(job.job_id);
  } catch (e) {
    downloadBusy.value = false;
    downloadProgress.value = "";
    toastApiError(e, "启动下载失败");
  }
}

async function deleteAsset(id: string) {
  if (!deleteAllowed.value) return;
  if (!window.confirm(`确认删除资源包「${ASSET_LABELS[id] || id}」？将移除本地权重文件。`)) {
    return;
  }
  deleteBusy.value = id;
  try {
    await postMediaAssetsDelete([id]);
    pushConsoleToast(`已删除 ${id}`, "ok");
    await refresh();
  } catch (e) {
    toastApiError(e, "删除失败");
  } finally {
    deleteBusy.value = "";
  }
}

async function selectSpeaker(id: string): Promise<boolean> {
  if (!speakersWritable.value || saveBusy.value) return false;
  saveBusy.value = true;
  try {
    await putSingDefaults({ default_speaker: id });
    pushConsoleToast(`默认唱歌音色：${id}`, "ok");
    await refresh();
    return true;
  } catch (e) {
    toastApiError(e, "保存唱歌音色失败");
    return false;
  } finally {
    saveBusy.value = false;
  }
}

async function selectBackend(id: string): Promise<boolean> {
  if (!backendsWritable.value || saveBusy.value) return false;
  saveBusy.value = true;
  try {
    await putSingDefaults({ preferred_backend: id });
    pushConsoleToast(id ? `优先 backend：${id}` : "已恢复自动 fallback", "ok");
    await refresh();
    return true;
  } catch (e) {
    toastApiError(e, "保存 SVC backend 失败");
    return false;
  } finally {
    saveBusy.value = false;
  }
}

async function selectVoice(path: string): Promise<boolean> {
  if (!voicesWritable.value || saveBusy.value) return false;
  saveBusy.value = true;
  try {
    await putTtsDefaults({
      ref_audio_path: path,
      prompt_text: promptText.value,
      prompt_lang: promptLang.value,
      text_lang: textLang.value,
    });
    pushConsoleToast("默认 TTS 音色已更新", "ok");
    await refresh();
    return true;
  } catch (e) {
    toastApiError(e, "保存音色失败");
    return false;
  } finally {
    saveBusy.value = false;
  }
}

async function onSpeakerChange() {
  const id = selectedSpeakerId.value;
  if (id === defaultSpeaker.value) return;
  const prev = defaultSpeaker.value;
  if (!(await selectSpeaker(id))) {
    selectedSpeakerId.value = prev;
  }
}

async function onBackendChange() {
  const id = selectedBackendId.value;
  if (id === preferredBackend.value) return;
  const prev = preferredBackend.value;
  if (!(await selectBackend(id))) {
    selectedBackendId.value = prev;
  }
}

async function onVoiceChange() {
  const path = selectedVoicePath.value;
  if (path === defaultVoicePath.value) return;
  const prev = defaultVoicePath.value;
  if (!(await selectVoice(path))) {
    selectedVoicePath.value = prev;
  }
}

async function savePrompt() {
  if (!voicesWritable.value || !defaultVoicePath.value) return;
  await selectVoice(defaultVoicePath.value);
}

onMounted(() => {
  void refresh();
});

onUnmounted(() => {
  stopPoll();
});

defineExpose({ refresh, assets, downloadAllowed, dockerGuide, packages });
</script>

<template>
  <div class="media-model-admin">
    <p class="muted media-model-admin__lead">
      唱歌 / TTS 依赖 AI Runtime 本地权重。默认 LLM 聊天不走这里。
      Runtime 地址见
      <RouterLink :to="aiConfigSectionPath('connection')">媒体服务</RouterLink>。
    </p>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
      <span class="muted"> · 请先确认媒体服务可达后再管理权重。</span>
    </div>
    <div
      v-else-if="modelsErr"
      class="alert alert--warn"
    >
      {{ modelsErr }}
    </div>

    <section class="media-model-admin__block">
      <div class="media-model-admin__block-hd">
        <h3 class="media-model-admin__title">资源包</h3>
        <span class="muted">模式 {{ deployMode }}</span>
      </div>
      <ul class="media-model-admin__meta muted">
        <li>
          任务包：sing={{ packages.sing ? "开" : "关" }}
          · tts={{ packages.tts ? "开" : "关" }}
          · chat={{ packages.chat ? "开" : "关" }}
        </li>
      </ul>

      <div class="media-model-admin__cards">
        <article
          v-for="row in assetRows"
          :key="row.id"
          class="media-model-admin__card"
        >
          <div class="media-model-admin__card-main">
            <strong>{{ row.label }}</strong>
            <span
              class="tag"
              :class="row.ready ? 'tag--ok' : 'tag--warn'"
            >{{ row.ready ? "就绪" : "缺失" }}</span>
          </div>
          <p class="muted media-model-admin__card-meta">
            <code>{{ row.path || row.id }}</code>
            · {{ formatSize(row.sizeBytes) }}
          </p>
          <div class="row-actions media-model-admin__card-actions">
            <UiButton
              size="sm"
              variant="outline"
              :disabled="!downloadAllowed || downloadBusy || loading || row.ready"
              :busy="downloadBusy"
              @click="startDownload([row.id])"
            >
              下载
            </UiButton>
            <UiButton
              size="sm"
              variant="destructive"
              :disabled="!deleteAllowed || !!deleteBusy || loading || !row.ready"
              :busy="deleteBusy === row.id"
              @click="deleteAsset(row.id)"
            >
              删除
            </UiButton>
          </div>
        </article>
      </div>

      <div
        v-if="dockerGuide"
        class="media-model-admin__docker muted"
      >
        Docker 不代跑下载/删除。请换
        <code>pallas-bot-ai:latest</code>
        并由启动脚本拉取；本页可查看就绪状态，默认可写卷时仍可切换唱歌/TTS 音色。
      </div>
      <div
        v-else
        class="row-actions media-model-admin__bulk"
      >
        <UiButton
          variant="primary"
          :busy="downloadBusy"
          :disabled="!downloadAllowed || downloadBusy || loading"
          @click="startDownload()"
        >
          下载全部缺失
        </UiButton>
        <UiButton
          :disabled="loading || downloadBusy"
          @click="refresh"
        >
          {{ loading ? "刷新中…" : "刷新" }}
        </UiButton>
      </div>
      <p
        v-if="downloadProgress"
        class="muted"
      >
        {{ downloadProgress }}
      </p>
    </section>

    <section class="media-model-admin__block">
      <div class="media-model-admin__block-hd">
        <h3 class="media-model-admin__title">唱歌音色</h3>
        <span class="muted">默认 {{ defaultSpeaker || "—" }}</span>
      </div>
      <p
        v-if="!speakers?.speakers?.length"
        class="muted"
      >
        未扫描到唱歌音色目录。请先下载 <code>sing_pallas</code> 等资源包。
      </p>
      <div
        v-else
        class="media-model-admin__select-row"
      >
        <label class="form-field media-model-admin__select">
          <span class="form-field__label">默认音色</span>
          <select
            v-model="selectedSpeakerId"
            class="sel"
            :disabled="!speakersWritable || saveBusy || loading"
            @change="onSpeakerChange"
          >
            <option
              v-for="sp in speakers.speakers"
              :key="sp.id"
              :value="sp.id"
              :disabled="!sp.ready"
            >
              {{ sp.id }}{{ sp.ready ? "" : "（缺模型）" }}
            </option>
          </select>
        </label>
        <p
          v-if="selectedSpeaker"
          class="muted media-model-admin__select-meta"
        >
          backend: {{ (selectedSpeaker.backends || []).join(", ") || "—" }}
          · files: {{ (selectedSpeaker.model_files || []).slice(0, 3).join(", ") || "—" }}
        </p>
      </div>
      <p
        v-if="speakers && !speakersWritable"
        class="muted"
      >
        当前部署不可写入默认唱歌音色。
      </p>
    </section>

    <section class="media-model-admin__block">
      <div class="media-model-admin__block-hd">
        <h3 class="media-model-admin__title">SVC Backend</h3>
        <span class="muted">{{ preferredBackend || "自动 fallback" }}</span>
      </div>
      <p class="muted media-model-admin__select-meta">
        优先尝试所选 backend；失败仍按 registry 顺序回退。选「自动」即完全跟随
        <code>fallback_order</code>。
      </p>
      <div
        v-if="(backends?.backends || []).length"
        class="media-model-admin__select-row"
      >
        <label class="form-field media-model-admin__select">
          <span class="form-field__label">优先 backend</span>
          <select
            v-model="selectedBackendId"
            class="sel"
            :disabled="!backendsWritable || saveBusy || loading"
            @change="onBackendChange"
          >
            <option value="">
              自动（registry 顺序）
            </option>
            <option
              v-for="be in backends?.backends || []"
              :key="be.id"
              :value="be.id"
              :disabled="be.enabled === false"
            >
              {{ be.id }}{{ be.enabled === false ? "（已禁用）" : "" }}
            </option>
          </select>
        </label>
        <p class="muted media-model-admin__select-meta">
          <template v-if="selectedBackend">
            glob: {{ selectedBackend.model_glob || "—" }}
            · suffix: {{ selectedBackend.output_suffix || "—" }}
          </template>
          <template v-else>
            fallback: {{ (backends?.fallback_order || []).join(" → ") || "—" }}
          </template>
        </p>
      </div>
      <p
        v-if="backends && !backendsWritable"
        class="muted"
      >
        当前部署不可写入 preferred backend。
      </p>
      <p
        v-else-if="!(backends?.backends || []).length"
        class="muted"
      >
        未加载到 registry（可能未启用 sing 包或 AI Runtime 不可达）。
      </p>
    </section>

    <section class="media-model-admin__block">
      <div class="media-model-admin__block-hd">
        <h3 class="media-model-admin__title">TTS 音色</h3>
        <span class="muted">{{ defaultVoicePath || "未设置" }}</span>
      </div>
      <p
        v-if="!voices?.voices?.length"
        class="muted"
      >
        未找到 <code>resource/tts/ref_audio</code> 下的参考音频。请先下载 TTS 资源包。
      </p>
      <div
        v-else
        class="media-model-admin__select-row"
      >
        <label class="form-field media-model-admin__select">
          <span class="form-field__label">默认参考音频</span>
          <select
            v-model="selectedVoicePath"
            class="sel"
            :disabled="!voicesWritable || saveBusy || loading"
            @change="onVoiceChange"
          >
            <option
              v-for="voice in voices.voices"
              :key="voice.path"
              :value="voice.path"
            >
              {{ voice.name || voice.id }}
            </option>
          </select>
        </label>
        <p
          v-if="selectedVoice"
          class="muted media-model-admin__select-meta"
        >
          <code>{{ selectedVoice.path }}</code>
          · {{ formatSize(Number(selectedVoice.size_bytes || 0)) }}
        </p>
      </div>

      <details
        v-if="voices?.voices?.length"
        class="media-model-admin__prompt"
        :open="promptOpen"
        @toggle="promptOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary>参考文本 / 语言（专家）</summary>
        <div class="media-model-admin__prompt-form">
          <label class="form-field">
            <span class="form-field__label">prompt_text</span>
            <textarea
              v-model="promptText"
              class="textarea"
              rows="2"
              :disabled="!voicesWritable || saveBusy"
            />
          </label>
          <div class="media-model-admin__prompt-row">
            <label class="form-field">
              <span class="form-field__label">prompt_lang</span>
              <input
                v-model="promptLang"
                class="inp"
                :disabled="!voicesWritable || saveBusy"
              >
            </label>
            <label class="form-field">
              <span class="form-field__label">text_lang</span>
              <input
                v-model="textLang"
                class="inp"
                :disabled="!voicesWritable || saveBusy"
              >
            </label>
          </div>
          <UiButton
            size="sm"
            variant="primary"
            :disabled="!voicesWritable || saveBusy || !defaultVoicePath"
            :busy="saveBusy"
            @click="savePrompt"
          >
            保存 prompt
          </UiButton>
        </div>
      </details>
    </section>
  </div>
</template>

<style scoped>
.media-model-admin__lead {
  margin: 0 0 12px;
  font-size: 0.875rem;
  line-height: 1.5;
}

.media-model-admin__block {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
}

.media-model-admin__block:first-of-type {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.media-model-admin__block-hd {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.media-model-admin__title {
  margin: 0;
  font-size: 1rem;
}

.media-model-admin__meta {
  margin: 0 0 10px;
  padding-left: 1.1em;
  font-size: 0.8125rem;
}

.media-model-admin__cards {
  display: grid;
  gap: 10px;
}

.media-model-admin__card {
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg) 92%, transparent);
}

.media-model-admin__card.is-active {
  border-color: color-mix(in srgb, var(--accent, #3d9a5c) 45%, var(--border));
}

.media-model-admin__card-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.media-model-admin__card-meta {
  margin: 6px 0 10px;
  font-size: 0.75rem;
  line-height: 1.45;
  word-break: break-all;
}

.media-model-admin__card-actions {
  flex-wrap: wrap;
  gap: 8px;
}

.media-model-admin__select-row {
  display: grid;
  gap: 6px;
}

.media-model-admin__select {
  margin: 0;
}

.media-model-admin__select-meta {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.45;
  word-break: break-all;
}

.media-model-admin__bulk {
  margin-top: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.media-model-admin__docker {
  margin-top: 10px;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.media-model-admin__prompt {
  margin-top: 12px;
  font-size: 0.875rem;
}

.media-model-admin__prompt-form {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.media-model-admin__prompt-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

@media (max-width: 560px) {
  .media-model-admin__block-hd {
    flex-direction: column;
    align-items: flex-start;
  }

  .media-model-admin__card-actions :deep(.ui-btn),
  .media-model-admin__bulk :deep(.ui-btn) {
    flex: 1 1 calc(50% - 4px);
  }

  .media-model-admin__prompt-row {
    grid-template-columns: 1fr;
  }
}
</style>
