<script setup lang="ts">
import { ref } from "vue";
import {
  protocolApiErrorMessage,
  protocolDownloadRuntime,
  protocolFetchRuntimeOverview,
  protocolFetchRuntimeProfile,
} from "@/api/protocolApi";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { useProtocolMount } from "@/composables/useProtocolMount";
import { pushConsoleToast } from "@/utils/consoleToast";

const { err, pageReady, mountUrl, protocolNotInstalled, reload } = useProtocolMount();

const overview = ref<Record<string, unknown> | null>(null);
const profile = ref<Record<string, unknown> | null>(null);
const loadBusy = ref(false);
const downloadBusy = ref(false);
const downloadTag = ref("");

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
    profile.value = pf;
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

async function downloadRuntime() {
  const mount = mountUrl.value;
  if (!mount) return;
  downloadBusy.value = true;
  try {
    await protocolDownloadRuntime(mount, {
      tag: downloadTag.value.trim() || undefined,
    });
    pushConsoleToast("已触发运行时下载", "ok");
    await loadAssets();
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "下载失败"), "err");
  } finally {
    downloadBusy.value = false;
  }
}

void onMountedLoad();
</script>

<template>
  <div class="console-hub-page protocol-sub-page">
    <ConsolePageSkeleton v-if="!pageReady" :panels="1" />
    <template v-else>
      <div
        v-if="err"
        class="alert alert--err"
      >
        {{ err }}
      </div>
      <div
        v-if="protocolNotInstalled"
        class="alert alert--warn"
      >
        尚未安装 pallas-plugin-protocol 扩展。
      </div>
      <UiCard
        tag="div"
        glass
        class="protocol-sub-page__panel"
      >
        <div class="panel__hd panel__hd--split inst-db-panel__hd">
          <h2 class="panel__title">
            协议资产
          </h2>
          <div class="inst-db-panel__hd-side">
            <RouterLink
              class="btn secondary"
              to="/protocol"
            >
              返回实例列表
            </RouterLink>
            <UiButton
              variant="outline"
              :busy="loadBusy"
              @click="loadAssets"
            >
              刷新
            </UiButton>
          </div>
        </div>
        <div class="panel__bd">
          <p class="muted">
            NapCat / SnowLuma 运行时与 Docker 镜像管理。复杂操作仍可使用
            <a
              v-if="mountUrl"
              class="link-quiet"
              :href="mountUrl + '/assets'"
              target="_blank"
              rel="noopener noreferrer"
            >内置协议资产页</a>。
          </p>
          <div
            v-if="profile"
            class="protocol-assets-kv"
          >
            <div><span class="muted">NapCat 运行模式</span> {{ profile.napcat_runtime_mode ?? profile.runtime_mode ?? "—" }}</div>
            <div><span class="muted">SnowLuma 运行模式</span> {{ profile.snowluma_runtime_mode ?? "—" }}</div>
            <div><span class="muted">Docker 镜像</span> {{ profile.docker_image ?? "—" }}</div>
            <div><span class="muted">随 Bot 启停</span> {{ profile.follow_bot_lifecycle ? "是" : "否" }}</div>
          </div>
          <pre
            v-if="overview"
            class="protocol-assets-pre"
          >{{ JSON.stringify(overview, null, 2) }}</pre>
          <div class="row-actions protocol-assets-download">
            <input
              v-model="downloadTag"
              class="inp grow"
              placeholder="版本 tag（可选）"
            >
            <UiButton
              variant="primary"
              :disabled="!mountUrl"
              :busy="downloadBusy"
              @click="downloadRuntime"
            >
              下载 NapCat 运行时
            </UiButton>
          </div>
        </div>
      </UiCard>
    </template>
  </div>
</template>

<style scoped>
.protocol-assets-kv {
  display: grid;
  gap: 8px;
  margin: 12px 0;
  font-size: 0.88rem;
}
.protocol-assets-pre {
  max-height: 280px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  font-size: 0.75rem;
  line-height: 1.4;
}
.protocol-assets-download {
  margin-top: 12px;
  flex-wrap: wrap;
}
@media (max-width: 560px) {
  .protocol-assets-download > .btn,
  .protocol-assets-download > .inp {
    width: 100%;
  }
}
</style>
