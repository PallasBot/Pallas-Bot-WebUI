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
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const WEBUI_RELEASES_PAGE = "https://github.com/PallasBot/Pallas-Bot-WebUI/releases";
const BOT_RELEASES_PAGE = "https://github.com/PallasBot/Pallas-Bot/releases";

const panelNavIcon = usePanelNavIcon();
const route = useRoute();
const err = ref("");
const pageReady = ref(false);
const web = ref<UpdateCheckData | null>(null);
const bot = ref<BotUpdateCheckData | null>(null);
const busy = ref(false);
const msg = ref("");
const refreshWebBusy = ref(false);
const refreshBotBusy = ref(false);

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

/** 与原先「重新检查」一致：仅重新拉取 WebUI 远端比对结果 */
async function refreshWeb() {
  err.value = "";
  refreshWebBusy.value = true;
  try {
    web.value = await fetchUpdateCheck();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    refreshWebBusy.value = false;
  }
}

/** 与原先「重新检查」一致：仅重新拉取 Bot 远端比对结果 */
async function refreshBot() {
  err.value = "";
  refreshBotBusy.value = true;
  try {
    bot.value = await fetchBotUpdateCheck();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    refreshBotBusy.value = false;
  }
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
  <div class="update-page">
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
      <div
        id="console-update-webui"
        class="panel update-page__panel"
      >
        <div class="panel__hd panel__hd--split update-page__panel-hd-nowrap">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>WebUI
          </h2>
          <div class="update-page__hd-tail">
            <RefreshIconButton
              :busy="refreshWebBusy"
              :disabled="busy"
              label="刷新 WebUI 更新检查"
              @click="refreshWeb"
            />
            <span
              v-if="web?.has_update"
              class="badge badge--warn update-page__status-pill"
            >有更新</span>
            <span
              v-else
              class="badge badge--ok update-page__status-pill"
            >已是最新或不可比对</span>
          </div>
        </div>
        <div class="panel__bd muted update-page__bd">
          <p>当前：<strong class="update-page__strong">{{ web?.current_tag }}</strong></p>
          <p>远端：<strong class="update-page__strong">{{ web?.latest_tag ?? "—" }}</strong></p>
          <p class="update-page__changelog-row">
            <a
              class="update-page__link"
              :href="(web?.release_url || '').trim() || WEBUI_RELEASES_PAGE"
              target="_blank"
              rel="noopener noreferrer"
            >查看变更</a>
            <span class="muted">（GitHub Release）</span>
          </p>
          <details
            v-if="(web?.release_notes || '').trim()"
            class="update-page__release-notes"
          >
            <summary class="update-page__release-notes-summary">
              {{ web?.latest_tag ? `「${web.latest_tag}」发行说明` : "最新发行说明" }}
            </summary>
            <pre class="update-page__release-notes-body">{{ web?.release_notes }}</pre>
          </details>
          <p v-if="web?.error">错误：{{ web.error }}</p>
          <button
            type="button"
            class="btn btn--primary update-page__apply"
            :disabled="busy || !web?.has_update || !web?.latest_tag"
            @click="applyWeb"
          >
            应用 WebUI 更新
          </button>
        </div>
      </div>

      <div
        id="console-update-bot"
        class="panel update-page__panel"
      >
        <div class="panel__hd panel__hd--split update-page__panel-hd-nowrap">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>Bot 本体
          </h2>
          <div class="update-page__hd-tail">
            <RefreshIconButton
              :busy="refreshBotBusy"
              :disabled="busy"
              label="刷新 Bot 更新检查"
              @click="refreshBot"
            />
            <span
              v-if="bot?.has_update"
              class="badge badge--warn update-page__status-pill"
            >有更新</span>
            <span
              v-else
              class="badge badge--ok update-page__status-pill"
            >已是最新或不可比对</span>
          </div>
        </div>
        <div class="panel__bd muted update-page__bd">
          <p>当前 tag：<strong class="update-page__strong">{{ bot?.current_tag }}</strong> · commit {{ bot?.current_commit }}</p>
          <p>远端 tag：<strong class="update-page__strong">{{ bot?.latest_tag ?? "—" }}</strong></p>
          <p class="update-page__changelog-row">
            <a
              class="update-page__link"
              :href="(bot?.release_url || '').trim() || BOT_RELEASES_PAGE"
              target="_blank"
              rel="noopener noreferrer"
            >查看变更</a>
            <span class="muted">（GitHub Release）</span>
          </p>
          <details
            v-if="(bot?.release_notes || '').trim()"
            class="update-page__release-notes"
          >
            <summary class="update-page__release-notes-summary">
              {{ bot?.latest_tag ? `「${bot.latest_tag}」发行说明` : "最新发行说明" }}
            </summary>
            <pre class="update-page__release-notes-body">{{ bot?.release_notes }}</pre>
          </details>
          <p v-if="bot?.error">错误：{{ bot.error }}</p>
          <p class="update-page__bot-note">
            说明：「应用 Bot 更新」在<strong>运行中的 Bot 源码根目录</strong>执行 <code>git fetch</code> / <code>checkout</code> 或 <code>pull --ff-only</code>。
            使用官方 Docker 镜像时，容器内通常没有 git 工作副本，该操作会失败；请改用下方镜像方式更新。
          </p>
          <button
            type="button"
            class="btn btn--primary update-page__apply"
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
                href="https://github.com/PallasBot/Pallas-Bot/blob/main/docs/DockerDeployment.md"
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
.update-page__panel + .update-page__panel {
  margin-top: 14px;
}

.update-page__hd-tail {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-width: 0;
}

.update-page__status-pill {
  font-size: 10px;
  font-weight: 650;
  padding: 2px 7px;
  line-height: 1.3;
  letter-spacing: 0.02em;
  max-width: min(11.5rem, 46vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.update-page__bd p {
  margin: 0 0 6px;
}

.update-page__bd p:last-of-type {
  margin-bottom: 0;
}

.update-page__strong {
  color: var(--text);
  font-weight: 650;
}

.update-page__changelog-row {
  margin: 2px 0 8px;
  font-size: 13px;
}

.update-page__link {
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
}

.update-page__link:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.update-page__release-notes {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  background: color-mix(in srgb, var(--bg-muted) 50%, transparent);
}

.update-page__release-notes-summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  color: var(--text);
  user-select: none;
}

.update-page__release-notes-body {
  margin: 8px 0 0;
  padding: 0;
  max-height: min(42vh, 320px);
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-muted);
}

.update-page__apply {
  margin-top: 14px;
}

.update-page__bot-note {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-muted);
}

.update-page__docker-hint {
  margin-top: 22px;
  padding: 16px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--border) 92%, transparent);
  background: color-mix(in srgb, var(--bg-muted) 55%, transparent);
  font-size: 13px;
  line-height: 1.55;
}

.update-page__docker-hint-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.02em;
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
  font-weight: 600;
}
</style>
