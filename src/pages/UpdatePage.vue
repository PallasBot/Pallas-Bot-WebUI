<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  fetchBotUpdateCheck,
  fetchUpdateCheck,
  postBotUpdateApply,
  postUpdateApply,
} from "@/api/consoleApi";
import type { BotUpdateCheckData, UpdateCheckData } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const route = useRoute();
const err = ref("");
const pageReady = ref(false);
const web = ref<UpdateCheckData | null>(null);
const bot = ref<BotUpdateCheckData | null>(null);
const busy = ref(false);
const msg = ref("");

function scrollUpdateHashIntoView() {
  const raw = (route.hash || "").replace(/^#/, "").trim();
  if (!raw) return;
  nextTick(() => {
    requestAnimationFrame(() => {
      document.getElementById(raw)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function load() {
  err.value = "";
  msg.value = "";
  try {
    web.value = await fetchUpdateCheck();
    bot.value = await fetchBotUpdateCheck();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    pageReady.value = true;
  }
  scrollUpdateHashIntoView();
}

async function applyWeb() {
  if (!web.value?.latest_tag) return;
  if (!confirm(`将 WebUI 更新到 ${web.value.latest_tag}？`)) return;
  busy.value = true;
  try {
    const r = await postUpdateApply();
    msg.value = r.message ? `${r.message} · 正在刷新页面以载入新版本…` : "WebUI 已更新，正在刷新页面…";
    await nextTick();
    window.location.reload();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function applyBot() {
  if (!bot.value?.latest_tag) return;
  if (!confirm(`将 Bot 更新到 ${bot.value.latest_tag}？`)) return;
  busy.value = true;
  try {
    const r = await postBotUpdateApply();
    msg.value = r.message || "已触发。";
    await load();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

watch(
  () => route.hash,
  () => {
    if (pageReady.value) scrollUpdateHashIntoView();
  },
);

onMounted(() => {
  void load();
});
</script>

<template>
  <div>
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>
    <div
      v-if="msg"
      class="alert alert--ok"
    >
      {{ msg }}
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="2"
    />
    <template v-else>
    <div class="row-actions" style="margin-bottom: 24px">
      <button
        type="button"
        class="btn btn--primary"
        :disabled="busy"
        @click="load"
      >
        重新检查
      </button>
    </div>

    <div
      id="console-update-webui"
      class="panel"
    >
      <div class="panel__hd">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>WebUI
        </h2>
        <span
          v-if="web?.has_update"
          class="badge badge--warn"
        >有更新</span>
        <span
          v-else
          class="badge badge--ok"
        >已是最新或不可比对</span>
      </div>
      <div class="panel__bd muted">
        <p>当前：<strong style="color: var(--text)">{{ web?.current_tag }}</strong></p>
        <p>远端：<strong style="color: var(--text)">{{ web?.latest_tag ?? "—" }}</strong></p>
        <p v-if="web?.error">错误：{{ web.error }}</p>
        <button
          type="button"
          class="btn btn--primary"
          style="margin-top: 12px"
          :disabled="busy || !web?.has_update || !web?.latest_tag"
          @click="applyWeb"
        >
          应用 WebUI 更新
        </button>
      </div>
    </div>

    <div
      id="console-update-bot"
      class="panel"
    >
      <div class="panel__hd">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>Bot 本体
        </h2>
        <span
          v-if="bot?.has_update"
          class="badge badge--warn"
        >有更新</span>
        <span
          v-else
          class="badge badge--ok"
        >已是最新或不可比对</span>
      </div>
      <div class="panel__bd muted">
        <p>当前 tag：<strong style="color: var(--text)">{{ bot?.current_tag }}</strong> · commit {{ bot?.current_commit }}</p>
        <p>远端 tag：<strong style="color: var(--text)">{{ bot?.latest_tag ?? "—" }}</strong></p>
        <p v-if="bot?.error">错误：{{ bot.error }}</p>
        <p class="update-page__bot-note">
          说明：「应用 Bot 更新」在<strong>运行中的 Bot 源码根目录</strong>执行 <code>git fetch</code> / <code>checkout</code> 或 <code>pull --ff-only</code>。
          使用官方 Docker 镜像时，容器内通常没有 git 工作副本，该操作会失败；请改用下方镜像方式更新。
        </p>
        <button
          type="button"
          class="btn btn--primary"
          style="margin-top: 12px"
          :disabled="busy || !bot?.has_update || !bot?.latest_tag"
          @click="applyBot"
        >
          应用 Bot 更新
        </button>
        <div class="update-page__docker-hint muted">
          <h3 class="update-page__docker-hint-title">Docker 部署时更新 Bot</h3>
          <p>在存放 <code>docker-compose.yml</code> 的目录执行（服务名以 compose 为准，仓库默认服务名为 <code>pallasbot</code>）：</p>
          <ol class="update-page__docker-steps">
            <li>拉取新镜像：<code>docker compose pull pallasbot</code></li>
            <li>用新镜像重建并启动：<code>docker compose up -d pallasbot</code>；若容器未换镜像可加 <code>--force-recreate</code>。</li>
            <li>若未使用 <code>:latest</code>，请先把 compose 里 <code>image: pallasbot/pallas-bot:…</code> 的 tag 改成目标版本，再执行以上两条。</li>
          </ol>
          <p>
            数据与配置一般通过卷挂载（如 <code>./pallas-bot/data</code>、<code>.env</code>）保留；完整变量与排障见主仓
            <a
              href="https://github.com/PallasBot/Pallas-Bot/blob/master/docs/DockerDeployment.md"
              target="_blank"
              rel="noopener noreferrer"
            >DockerDeployment.md</a>。
          </p>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.update-page__bot-note {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-muted);
}

.update-page__docker-hint {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  line-height: 1.55;
}

.update-page__docker-hint-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.update-page__docker-steps {
  margin: 8px 0 12px;
  padding-left: 1.25rem;
}

.update-page__docker-steps li {
  margin-bottom: 6px;
}

.update-page__docker-hint a {
  color: var(--accent);
}
</style>
