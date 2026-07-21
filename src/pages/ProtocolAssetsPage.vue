<script setup lang="ts">
import { computed, ref } from "vue";
import {
  protocolApiErrorMessage,
  protocolCleanupRuntimeDist,
  protocolDownloadRuntime,
  protocolDownloadSnowlumaRuntime,
  protocolFetchRuntimeOverview,
  protocolFetchRuntimeProfile,
  protocolListDockerImages,
  protocolPullDockerImage,
  protocolUpdateRuntimeProfile,
  type ProtocolRuntimeJob,
  type ProtocolRuntimeProfile,
} from "@/api/protocolApi";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PageChrome from "@/components/PageChrome.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { useProtocolMount } from "@/composables/useProtocolMount";
import { pushConsoleToast } from "@/utils/consoleToast";

const panelNavIcon = usePanelNavIcon();
const { err, pageReady, mountUrl, reload } = useProtocolMount();

const overview = ref<Record<string, unknown> | null>(null);
const profileForm = ref<ProtocolRuntimeProfile>({});
const loadBusy = ref(false);
const saveBusy = ref(false);
const cleanupBusy = ref(false);
const napcatDownloadBusy = ref(false);
const snowlumaDownloadBusy = ref(false);
const napcatTag = ref("");
const snowlumaTag = ref("");
const napcatPullBusy = ref(false);
const snowlumaPullBusy = ref(false);
const napcatListBusy = ref(false);
const snowlumaListBusy = ref(false);
const napcatImages = ref<string[]>([]);
const snowlumaImages = ref<string[]>([]);
const dockerPullLog = ref("");

const runtimeModes = [
  { value: "docker", label: "Docker" },
  { value: "appimage", label: "AppImage" },
  { value: "shell", label: "Shell" },
];

const targetPlatforms = [
  { value: "auto", label: "auto（跟随当前平台）" },
  { value: "linux-amd64", label: "linux-amd64" },
  { value: "linux-arm64", label: "linux-arm64" },
  { value: "windows-amd64", label: "windows-amd64" },
];

const napcatJob = computed(() => jobFromOverview(overview.value, "job"));
const snowlumaJob = computed(() => {
  const sl = overview.value?.snowluma;
  if (sl && typeof sl === "object" && "job" in sl) {
    return (sl as { job?: ProtocolRuntimeJob }).job ?? null;
  }
  return null;
});

const showDockerSection = computed(() => {
  const p = profileForm.value;
  return p.napcat_runtime_mode === "docker" || p.snowluma_runtime_mode === "docker";
});

function jobFromOverview(
  ov: Record<string, unknown> | null,
  key: string,
): ProtocolRuntimeJob | null {
  if (!ov || typeof ov[key] !== "object" || ov[key] === null) return null;
  return ov[key] as ProtocolRuntimeJob;
}

function jobStatusLabel(job: ProtocolRuntimeJob | null): string {
  if (!job?.status) return "空闲";
  const msg = job.message?.trim();
  return msg ? `${job.status}：${msg}` : String(job.status);
}

async function loadAssets() {
  const mount = mountUrl.value;
  if (!mount) return;
  loadBusy.value = true;
  try {
    const [ov, pf] = await Promise.all([
      protocolFetchRuntimeOverview(mount),
      protocolFetchRuntimeProfile(mount),
    ]);
    overview.value = ov;
    profileForm.value = { ...pf };
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "加载失败"), "err");
  } finally {
    loadBusy.value = false;
  }
}

async function onMountedLoad() {
  await reload();
  await loadAssets();
}

async function saveProfile() {
  const mount = mountUrl.value;
  if (!mount) return;
  saveBusy.value = true;
  try {
    profileForm.value = await protocolUpdateRuntimeProfile(mount, profileForm.value);
    pushConsoleToast("全局运行配置已保存", "ok");
    await loadAssets();
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "保存失败"), "err");
  } finally {
    saveBusy.value = false;
  }
}

async function cleanupDist() {
  const mount = mountUrl.value;
  if (!mount) return;
  cleanupBusy.value = true;
  try {
    await protocolCleanupRuntimeDist(mount);
    pushConsoleToast("已清理下载缓存", "ok");
    await loadAssets();
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "清理失败"), "err");
  } finally {
    cleanupBusy.value = false;
  }
}

async function downloadNapcat() {
  const mount = mountUrl.value;
  if (!mount) return;
  napcatDownloadBusy.value = true;
  try {
    await protocolDownloadRuntime(mount, {
      tag: napcatTag.value.trim() || undefined,
      target_platform: profileForm.value.target_platform || undefined,
    });
    pushConsoleToast("已触发 NapCat 运行时下载", "ok");
    await loadAssets();
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "下载失败"), "err");
  } finally {
    napcatDownloadBusy.value = false;
  }
}

async function downloadSnowluma() {
  const mount = mountUrl.value;
  if (!mount) return;
  snowlumaDownloadBusy.value = true;
  try {
    await protocolDownloadSnowlumaRuntime(mount, {
      tag: snowlumaTag.value.trim() || undefined,
    });
    pushConsoleToast("已触发 SnowLuma 运行时下载", "ok");
    await loadAssets();
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "下载失败"), "err");
  } finally {
    snowlumaDownloadBusy.value = false;
  }
}

async function pullDocker(which: "napcat" | "snowluma") {
  const mount = mountUrl.value;
  if (!mount) return;
  const image =
    which === "napcat"
      ? String(profileForm.value.docker_image ?? "").trim()
      : String(profileForm.value.snowluma_docker_image ?? "").trim();
  if (which === "napcat") napcatPullBusy.value = true;
  else snowlumaPullBusy.value = true;
  try {
    const res = await protocolPullDockerImage(mount, image || undefined);
    dockerPullLog.value = res.output?.trim() || (res.ok ? "拉取完成" : "拉取失败");
    pushConsoleToast(res.ok ? "Docker 镜像拉取完成" : "Docker 镜像拉取失败", res.ok ? "ok" : "err");
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "拉取失败"), "err");
  } finally {
    if (which === "napcat") napcatPullBusy.value = false;
    else snowlumaPullBusy.value = false;
  }
}

async function listDocker(which: "napcat" | "snowluma") {
  const mount = mountUrl.value;
  if (!mount) return;
  if (which === "napcat") napcatListBusy.value = true;
  else snowlumaListBusy.value = true;
  try {
    const res = await protocolListDockerImages(mount, which);
    const imgs = Array.isArray(res.images) ? res.images : [];
    if (which === "napcat") napcatImages.value = imgs;
    else snowlumaImages.value = imgs;
    if (!res.ok && res.detail) {
      pushConsoleToast(res.detail, "err");
    }
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "查询镜像失败"), "err");
  } finally {
    if (which === "napcat") napcatListBusy.value = false;
    else snowlumaListBusy.value = false;
  }
}

void onMountedLoad();
</script>

<template>
  <div class="console-hub-page protocol-sub-page">
    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="2"
    />
    <template v-else>
      <div
        v-if="err"
        class="alert alert--err"
      >
        {{ err }}
      </div>

      <PageChrome
        :icon="panelNavIcon"
        title="协议资产"
        lead="管理 NapCat / SnowLuma 发行包、全局运行模式与 Docker 镜像；保存后可能影响已有协议容器。"
      >
        <template #actions>
          <RouterLink
            custom
            v-slot="{ navigate }"
            to="/protocol"
          >
            <UiButton
              variant="outline"
              @click="navigate"
            >
              返回实例列表
            </UiButton>
          </RouterLink>
          <UiButton
            variant="outline"
            :busy="loadBusy"
            @click="loadAssets"
          >
            刷新
          </UiButton>
        </template>
      </PageChrome>

      <UiCard
        tag="div"
        glass
        class="protocol-sub-page__panel"
      >
        <div class="panel__hd">
          <h2 class="panel__title protocol-assets-section-title">
            全局运行配置
          </h2>
        </div>
        <div class="panel__bd">
          <div class="protocol-form-grid">
            <label class="field">
              <span class="field__label">NapCat 运行模式</span>
              <UiSelect
                :model-value="profileForm.napcat_runtime_mode ?? ''"
                @update:model-value="profileForm.napcat_runtime_mode = $event"
              >
                <option
                  v-for="opt in runtimeModes"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </UiSelect>
            </label>
            <label class="field">
              <span class="field__label">SnowLuma 运行模式</span>
              <UiSelect
                :model-value="profileForm.snowluma_runtime_mode ?? ''"
                @update:model-value="profileForm.snowluma_runtime_mode = $event"
              >
                <option
                  v-for="opt in runtimeModes"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </UiSelect>
            </label>
            <label class="field">
              <span class="field__label">下载目标平台（NapCat）</span>
              <UiSelect
                :model-value="profileForm.target_platform ?? ''"
                @update:model-value="profileForm.target_platform = $event"
              >
                <option
                  v-for="opt in targetPlatforms"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </UiSelect>
            </label>
            <label class="field field--check">
              <input
                v-model="profileForm.follow_bot_lifecycle"
                type="checkbox"
              >
              实例随 Bot 启停（全局）
            </label>
          </div>
          <div
            v-if="showDockerSection"
            class="protocol-form-grid protocol-assets-docker-grid"
          >
            <label class="field">
              <span class="field__label">NapCat Docker 镜像</span>
              <UiInput
                v-model="profileForm.docker_image"
                placeholder="mlikiowa/napcat-docker:latest"
                autocomplete="off"
              />
            </label>
            <label class="field">
              <span class="field__label">SnowLuma Docker 镜像</span>
              <UiInput
                v-model="profileForm.snowluma_docker_image"
                placeholder="motricseven7/snowluma:latest"
                autocomplete="off"
              />
            </label>
          </div>
          <div class="row-actions protocol-assets-actions">
            <UiButton
              variant="outline"
              :busy="cleanupBusy"
              :disabled="!mountUrl"
              @click="cleanupDist"
            >
              清理下载缓存
            </UiButton>
            <span style="flex: 1" />
            <UiButton
              variant="primary"
              :busy="saveBusy"
              :disabled="!mountUrl"
              @click="saveProfile"
            >
              保存设置
            </UiButton>
          </div>
        </div>
      </UiCard>

      <UiCard
        tag="div"
        glass
        class="protocol-sub-page__panel"
      >
        <div class="panel__hd">
          <h2 class="panel__title protocol-assets-section-title">
            运行时下载
          </h2>
        </div>
        <div class="panel__bd">
          <div class="protocol-assets-runtime-block">
            <div class="protocol-assets-runtime-block__hd">
              <strong>NapCat</strong>
              <span class="muted protocol-assets-job">{{ jobStatusLabel(napcatJob) }}</span>
            </div>
            <div class="row-actions protocol-assets-download">
              <UiInput
                v-model="napcatTag"
                class="protocol-assets-download__tag"
                placeholder="版本 tag（可选，默认 latest）"
              />
              <UiButton
                variant="primary"
                :disabled="!mountUrl"
                :busy="napcatDownloadBusy"
                @click="downloadNapcat"
              >
                下载 NapCat 运行时
              </UiButton>
            </div>
          </div>
          <div class="protocol-assets-runtime-block">
            <div class="protocol-assets-runtime-block__hd">
              <strong>SnowLuma</strong>
              <span class="muted protocol-assets-job">{{ jobStatusLabel(snowlumaJob) }}</span>
            </div>
            <div class="row-actions protocol-assets-download">
              <UiInput
                v-model="snowlumaTag"
                class="protocol-assets-download__tag"
                placeholder="版本 tag（可选，默认 latest）"
              />
              <UiButton
                variant="primary"
                :disabled="!mountUrl"
                :busy="snowlumaDownloadBusy"
                @click="downloadSnowluma"
              >
                下载 SnowLuma 运行时
              </UiButton>
            </div>
          </div>
        </div>
      </UiCard>

      <UiCard
        v-if="showDockerSection"
        tag="div"
        glass
        class="protocol-sub-page__panel"
      >
        <div class="panel__hd">
          <h2 class="panel__title protocol-assets-section-title">
            Docker 镜像
          </h2>
        </div>
        <div class="panel__bd">
          <p class="muted">
            需在宿主机或已挂载 docker.sock 的环境执行；Bot 容器内无 Docker CLI 时会提示在宿主机手动 pull。
          </p>
          <div class="protocol-assets-docker-row">
            <div class="row-actions protocol-assets-download">
              <UiButton
                variant="outline"
                :disabled="!mountUrl"
                :busy="napcatPullBusy"
                @click="pullDocker('napcat')"
              >
                拉取 NapCat 镜像
              </UiButton>
              <UiButton
                variant="outline"
                :disabled="!mountUrl"
                :busy="napcatListBusy"
                @click="listDocker('napcat')"
              >
                查看 NapCat 本地镜像
              </UiButton>
            </div>
            <ul
              v-if="napcatImages.length"
              class="protocol-assets-image-list muted"
            >
              <li
                v-for="img in napcatImages"
                :key="img"
              >
                {{ img }}
              </li>
            </ul>
          </div>
          <div class="protocol-assets-docker-row">
            <div class="row-actions protocol-assets-download">
              <UiButton
                variant="outline"
                :disabled="!mountUrl"
                :busy="snowlumaPullBusy"
                @click="pullDocker('snowluma')"
              >
                拉取 SnowLuma 镜像
              </UiButton>
              <UiButton
                variant="outline"
                :disabled="!mountUrl"
                :busy="snowlumaListBusy"
                @click="listDocker('snowluma')"
              >
                查看 SnowLuma 本地镜像
              </UiButton>
            </div>
            <ul
              v-if="snowlumaImages.length"
              class="protocol-assets-image-list muted"
            >
              <li
                v-for="img in snowlumaImages"
                :key="img"
              >
                {{ img }}
              </li>
            </ul>
          </div>
          <pre
            v-if="dockerPullLog"
            class="protocol-assets-pre"
          >{{ dockerPullLog }}</pre>
        </div>
      </UiCard>
    </template>
  </div>
</template>

<style scoped>
.protocol-assets-section-title {
  font-size: 1rem;
}
.protocol-assets-pre {
  max-height: 280px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  font-size: 0.75rem;
  line-height: 1.4;
  margin-top: 12px;
}
.protocol-assets-download {
  margin-top: 8px;
  flex-wrap: wrap;
}
.protocol-assets-download__tag {
  flex: 1 1 12rem;
  min-width: 0;
}
.protocol-assets-actions {
  margin-top: 14px;
  flex-wrap: wrap;
}
.protocol-assets-runtime-block + .protocol-assets-runtime-block {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.protocol-assets-runtime-block__hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.protocol-assets-job {
  font-size: 0.82rem;
}
.protocol-assets-docker-grid {
  margin-top: 12px;
}
.protocol-assets-docker-row + .protocol-assets-docker-row {
  margin-top: 14px;
}
.protocol-assets-image-list {
  margin: 8px 0 0;
  padding-left: 1.2rem;
  font-size: 0.82rem;
  word-break: break-all;
}
</style>
