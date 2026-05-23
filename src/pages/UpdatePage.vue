<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  fetchBotUpdateCheck,
  fetchCommonConfig,
  fetchUpdateCheck,
  postBotUpdateApply,
  postUpdateApply,
  putCommonConfig,
} from "@/api/consoleApi";
import type { BotUpdateCheckData, UpdateCheckData } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import { axiosErrorDetail } from "@/api/http";
import { releaseNotesToSafeHtml } from "@/utils/releaseNotesHtml";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

const WEBUI_RELEASES_PAGE = "https://github.com/PallasBot/Pallas-Bot-WebUI/releases";
const BOT_RELEASES_PAGE = "https://github.com/PallasBot/Pallas-Bot/releases";

/** 与 `common-config/pallas_protocol` 一致，经通用配置落盘 */
const PALLAS_PROTOCOL_SECTION_ID = "pallas_protocol";
const GITHUB_TOKEN_FIELD = "pallas_protocol_github_token";

const panelNavIcon = usePanelNavIcon();
const route = useRoute();
const err = ref("");
const pageReady = ref(false);
const web = ref<UpdateCheckData | null>(null);
const bot = ref<BotUpdateCheckData | null>(null);

const webReleaseNotesHtml = computed(() => releaseNotesToSafeHtml(web.value?.release_notes));
const botReleaseNotesHtml = computed(() => releaseNotesToSafeHtml(bot.value?.release_notes));

const botDeployLabel = computed(() => {
  const mode = bot.value?.deployment_mode;
  if (mode === "docker") return "Docker / 非 git 工作副本";
  if (mode === "release_tag") return "发布 tag（工作区干净）";
  if (mode === "release_tag_dirty") return "发布 tag（含本地改动）";
  if (mode === "dev_clone") return "开发克隆 / 分支";
  return "—";
});

const botApplyDisabled = computed(
  () =>
    busy.value
    || !bot.value?.has_update
    || !bot.value?.latest_tag
    || bot.value?.deployment_mode === "docker",
);

const busy = ref(false);
const msg = ref("");
const refreshWebBusy = ref(false);
const refreshBotBusy = ref(false);

const ghTokenInput = ref("");
const ghTokenHadValue = ref(false);
const ghTokenBusy = ref(false);
const ghTokenErr = ref("");
const ghTokenOk = ref("");

async function loadGithubTokenHint() {
  ghTokenErr.value = "";
  ghTokenOk.value = "";
  try {
    const data = await fetchCommonConfig(PALLAS_PROTOCOL_SECTION_ID);
    const f = data.fields.find((x) => x.name === GITHUB_TOKEN_FIELD);
    const cur = f?.current;
    const s = cur === null || cur === undefined ? "" : String(cur).trim();
    ghTokenHadValue.value = s.length > 0;
    ghTokenInput.value = "";
  } catch (e) {
    ghTokenErr.value = e instanceof Error ? e.message : String(e);
    ghTokenHadValue.value = false;
  }
}

async function saveGithubToken() {
  const next = ghTokenInput.value.trim();
  if (!next) {
    ghTokenErr.value = "请输入新令牌，或使用下方「清除」移除已保存的令牌。";
    return;
  }
  ghTokenBusy.value = true;
  ghTokenErr.value = "";
  ghTokenOk.value = "";
  try {
    await putCommonConfig(PALLAS_PROTOCOL_SECTION_ID, { [GITHUB_TOKEN_FIELD]: next });
    ghTokenHadValue.value = true;
    ghTokenInput.value = "";
    ghTokenOk.value = "配置已保存；若未立即生效可重启 Bot。";
    toastSaveSuccess("GitHub 令牌已保存");
  } catch (e) {
    ghTokenErr.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "保存失败");
  } finally {
    ghTokenBusy.value = false;
  }
}

useSaveHotkey(() => !ghTokenBusy.value && ghTokenInput.value.trim().length > 0, () => saveGithubToken());

async function clearGithubToken() {
  if (!confirm("确定清除已保存的 GitHub 令牌？")) return;
  ghTokenBusy.value = true;
  ghTokenErr.value = "";
  ghTokenOk.value = "";
  try {
    await putCommonConfig(PALLAS_PROTOCOL_SECTION_ID, { [GITHUB_TOKEN_FIELD]: "" });
    ghTokenHadValue.value = false;
    ghTokenInput.value = "";
    ghTokenOk.value = "已清除；重启 Bot 后生效。";
    toastSaveSuccess("GitHub 令牌已清除");
  } catch (e) {
    ghTokenErr.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "清除失败");
  } finally {
    ghTokenBusy.value = false;
  }
}

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
    await Promise.all([fetchUpdateCheck().then((r) => (web.value = r)), fetchBotUpdateCheck().then((r) => (bot.value = r))]);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    pageReady.value = true;
  }
  scrollUpdateHashIntoView();
  void loadGithubTokenHint();
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
    err.value = axiosErrorDetail(e);
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
    err.value = axiosErrorDetail(e);
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
        id="console-update-github"
        class="panel update-page__panel"
      >
        <div class="panel__hd panel__hd--split update-page__panel-hd-nowrap">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span><span class="update-page__title-keep">GitHub 令牌</span>
          </h2>
          <div class="row-actions">
            <PanelSidebarAdd main-path="/update" />
          </div>
        </div>
        <div class="panel__bd muted update-page__bd">
          <p>
            可选。用于 Release 检查与下载、协议端在线拉包等。也可在侧边栏
            <RouterLink to="/common-config/pallas_protocol">通用配置 → 协议端</RouterLink>
            中填写，键名 <code>PALLAS_PROTOCOL_GITHUB_TOKEN</code>；下方保存与此处等效。
          </p>
          <p>
            当前：<strong class="update-page__strong">{{ ghTokenHadValue ? "已配置" : "未配置" }}</strong>
            <span v-if="ghTokenHadValue">（不显示内容；输入新值覆盖）</span>
          </p>
          <div class="update-page__gh-row">
            <input
              v-model="ghTokenInput"
              class="inp update-page__gh-inp"
              type="password"
              autocomplete="off"
              placeholder="粘贴 fine-grained 或 classic PAT"
              :disabled="ghTokenBusy"
            >
            <button
              type="button"
              class="btn btn--primary"
              :disabled="ghTokenBusy"
              @click="saveGithubToken"
            >
              {{ ghTokenBusy ? "保存中…" : "保存" }}
            </button>
            <button
              v-if="ghTokenHadValue"
              type="button"
              class="btn"
              :disabled="ghTokenBusy"
              @click="clearGithubToken"
            >
              清除
            </button>
          </div>
          <div
            v-if="ghTokenErr"
            class="alert alert--err update-page__gh-alert"
          >
            {{ ghTokenErr }}
          </div>
          <div
            v-if="ghTokenOk"
            class="alert alert--ok update-page__gh-alert"
          >
            {{ ghTokenOk }}
          </div>
          <p class="update-page__gh-more">
            更多协议相关项见
            <RouterLink
              class="update-page__link"
              to="/common-config"
            >通用配置</RouterLink>
            → 选择「协议端 / Pallas Protocol」。
          </p>
        </div>
      </div>

      <div
        id="console-update-webui"
        class="panel update-page__panel"
      >
        <div class="panel__hd panel__hd--split update-page__panel-hd-nowrap">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>WebUI
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
            >已是最新</span>
          </h2>
          <div class="row-actions">
            <PanelSidebarAdd main-path="/update" />
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
            <div
              class="update-page__release-notes-body update-page__release-notes-body--md"
              v-html="webReleaseNotesHtml"
            />
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
              v-else-if="bot?.development_build"
              class="badge badge--dev update-page__status-pill"
              title="当前 commit 超前于 GitHub 最新发行版，无需执行「应用 Bot 更新」"
            >开发构建</span>
            <span
              v-else
              class="badge badge--ok update-page__status-pill"
            >已是最新</span>
          </h2>
          <div class="row-actions">
            <PanelSidebarAdd main-path="/update" />
          </div>
        </div>
        <div class="panel__bd muted update-page__bd">
          <p>
            部署形态：<strong class="update-page__strong">{{ botDeployLabel }}</strong>
            <span v-if="bot?.git_available && bot?.current_branch"> · 分支 {{ bot.current_branch }}</span>
            <span v-if="bot?.dirty && (bot?.dirty_file_count ?? 0) > 0">
              · 本地改动 {{ bot.dirty_file_count }} 项
            </span>
          </p>
          <p>当前 tag：<strong class="update-page__strong">{{ bot?.current_tag || "—" }}</strong> · commit {{ bot?.current_commit }}</p>
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
            <div
              class="update-page__release-notes-body update-page__release-notes-body--md"
              v-html="botReleaseNotesHtml"
            />
          </details>
          <p v-if="bot?.error">错误：{{ bot.error }}</p>
          <p
            v-if="bot?.deployment_mode === 'docker'"
            class="update-page__deploy-hint alert alert--warn"
          >
            当前为 Docker / 非 git 工作副本，无法在此页执行 git 更新。请使用下方「Docker 部署时更新 Bot」步骤（<code>docker compose pull</code>）。
          </p>
          <p
            v-else-if="bot?.deployment_mode === 'release_tag_dirty'"
            class="update-page__deploy-hint"
          >
            检测到 {{ bot?.dirty_file_count ?? 0 }} 项本地改动。更新时将自动 stash 并在切换 tag 后尝试恢复；若与新版冲突，请在仓库根目录执行
            <code>git stash pop</code>。建议长期将站点插件迁至 <code>local/plugins/</code>（见主仓
            <a
              href="https://github.com/PallasBot/Pallas-Bot/blob/main/docs/architecture/site-customization-and-updates.md"
              target="_blank"
              rel="noopener noreferrer"
            >站点定制与更新</a>）。
          </p>
          <p
            v-else-if="bot?.deployment_mode === 'dev_clone'"
            class="update-page__deploy-hint"
          >
            当前为开发克隆（非精确 release tag），更新时将执行 <code>git pull --ff-only --autostash</code>。
          </p>
          <p
            v-else-if="bot?.deployment_mode === 'release_tag'"
            class="update-page__deploy-hint"
          >
            当前处于 release tag 且工作区干净，可直接应用 Bot 更新。
          </p>
          <p class="update-page__bot-note">
            说明：「应用 Bot 更新」在<strong>运行中的 Bot 源码根目录</strong>执行 <code>git fetch</code> / <code>checkout</code> 或 <code>pull --ff-only</code>。
            站点定制请优先使用 <code>local/plugins/</code> 与 <code>pallas.toml</code> 的 <code>extra_plugin_dirs</code>。
          </p>
          <button
            type="button"
            class="btn btn--primary update-page__apply"
            :disabled="botApplyDisabled"
            @click="applyBot"
          >
            应用 Bot 更新
          </button>
          <div
            v-if="bot?.deployment_mode === 'docker' || bot?.git_available === false"
            class="update-page__docker-hint muted"
          >
            <h3 class="update-page__docker-hint-title">Docker 部署时更新 Bot</h3>
            <p>在存放 <code>docker-compose.yml</code> 的目录执行（服务名以 compose 为准，仓库默认服务名为 <code>pallasbot</code>）：</p>
            <ol class="update-page__docker-steps">
              <li>拉取新镜像：<code>docker compose pull pallasbot</code></li>
              <li>用新镜像重建并启动：<code>docker compose up -d pallasbot</code>；若容器未换镜像可加 <code>--force-recreate</code>。</li>
              <li>若未使用 <code>:latest</code>，请先把 compose 里 <code>image: pallasbot/pallas-bot:…</code> 的 tag 改成目标版本，再执行以上两条。</li>
            </ol>
            <p>
              数据与配置一般通过卷挂载（如 <code>./pallas-bot/data</code>、<code>config/pallas.toml</code>）保留；完整变量与排障见主仓
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

.update-page__deploy-hint {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.45;
}

.update-page__deploy-hint.alert--warn {
  padding: 8px 10px;
  border-radius: var(--radius-md);
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

.update-page__release-notes-body--md {
  white-space: normal;
}

.update-page__release-notes-body--md :deep(a.update-page__commit-link) {
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.update-page__release-notes-body--md :deep(a.update-page__commit-link:hover) {
  text-decoration: underline;
  text-underline-offset: 2px;
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

.update-page__gh-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.update-page__gh-inp {
  flex: 1 1 220px;
  min-width: 0;
  max-width: 520px;
}

.update-page__gh-alert {
  margin-top: 12px;
}

.update-page__gh-more {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.5;
}

.update-page__title-keep {
  white-space: nowrap;
}

@media (max-width: 560px) {
  .update-page__gh-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .update-page__gh-inp {
    flex: 1 1 auto;
    max-width: none;
  }

  .update-page__gh-row .btn {
    padding: 7px 12px;
    font-size: 13px;
    line-height: 1.25;
    min-height: 0;
  }
}
</style>
