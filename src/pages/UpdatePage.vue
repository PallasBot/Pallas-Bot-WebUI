<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  fetchBotUpdateCheck,
  fetchPluginConfig,
  fetchUpdateCheck,
  fetchUpdateCheckAll,
  postBotUpdateApply,
  postUpdateApply,
  putPluginConfig,
} from "@/api/consoleApi";
import type { BotUpdateCheckData, UpdateCheckData } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import GitMirrorDialog from "@/components/GitMirrorDialog.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import UiBadge from "@/components/ui/UiBadge.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { useBotSystemRestart } from "@/composables/useBotSystemRestart";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import { axiosErrorDetail } from "@/api/http";
import { releaseNotesToSafeHtml } from "@/utils/releaseNotesHtml";
import { setupReadmeCodeCopyButtons } from "@/utils/readmeCodeCopy";
import {
  PALLAS_BOT_DOC,
  PALLAS_BOT_RELEASES,
  PALLAS_BOT_REPO,
  PALLAS_WEBUI_RELEASES,
  PALLAS_WEBUI_REPO,
} from "@/utils/pallasExternalLinks";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";
import { pallasBotVersionLabel, updateCheckCurrentTagLabel } from "@/utils/versionDisplay";

const WEBUI_RELEASES_PAGE = PALLAS_WEBUI_RELEASES;
const BOT_RELEASES_PAGE = PALLAS_BOT_RELEASES;
const BOT_DOC = PALLAS_BOT_DOC;

/** 协议端插件配置（GitHub 令牌等） */
const PB_PROTOCOL_PLUGIN = "pb_protocol";
const GITHUB_TOKEN_FIELD = "pallas_protocol_github_token";

const panelNavIcon = usePanelNavIcon();
const route = useRoute();
const err = ref("");
const pageReady = ref(false);
const web = ref<UpdateCheckData | null>(null);
const bot = ref<BotUpdateCheckData | null>(null);

const webReleaseNotesHtml = computed(() => releaseNotesToSafeHtml(web.value?.release_notes));
const botReleaseNotesHtml = computed(() => releaseNotesToSafeHtml(bot.value?.release_notes));
const webReleaseNotesEl = ref<HTMLElement | null>(null);
const botReleaseNotesEl = ref<HTMLElement | null>(null);

/** v-html 注入后挂载复制按钮（与 ReadmeMarkdown 同路，不向 HTML 塞 onclick） */
function bindReleaseNotesCodeCopy(el: Ref<HTMLElement | null>, html: Ref<string>) {
  let teardown: (() => void) | null = null;
  watch(
    html,
    async (value) => {
      teardown?.();
      teardown = null;
      if (!value.trim()) return;
      await nextTick();
      if (!el.value) return;
      teardown = setupReadmeCodeCopyButtons(el.value);
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    teardown?.();
  });
}

bindReleaseNotesCodeCopy(webReleaseNotesEl, webReleaseNotesHtml);
bindReleaseNotesCodeCopy(botReleaseNotesEl, botReleaseNotesHtml);

const webCurrentDisplay = computed(() => updateCheckCurrentTagLabel(web.value?.current_tag));
const botCurrentDisplay = computed(() => pallasBotVersionLabel(undefined, bot.value));

function releaseNotesFoldSummary(
  currentTag: string | null | undefined,
  latestTag: string | null | undefined,
  hasUpdate: boolean | null | undefined,
): string {
  const latest = (latestTag || "").trim();
  const current = (currentTag || "").trim();
  if (hasUpdate && current && latest) {
    return `${current} → ${latest} 更新说明`;
  }
  if (latest) return `「${latest}」发行说明`;
  return "发行说明";
}

const webReleaseNotesSummary = computed(() =>
  releaseNotesFoldSummary(web.value?.current_tag, web.value?.latest_tag, web.value?.has_update),
);
const botReleaseNotesSummary = computed(() =>
  releaseNotesFoldSummary(bot.value?.current_tag, bot.value?.latest_tag, bot.value?.has_update),
);

const webApplyDisabled = computed(
  () => busy.value || !web.value?.has_update || !web.value?.latest_tag,
);

const webCallout = computed((): { kind: "info"; text: string } | null => {
  if (web.value?.has_update) {
    return { kind: "info", text: "更新完成后页面会自动刷新。" };
  }
  return null;
});

const botDeployLabel = computed(() => {
  const mode = bot.value?.deployment_mode;
  if (mode === "docker") return "Docker";
  if (mode === "release_tag") return "正式版";
  if (mode === "release_tag_dirty") return "正式版 · 有本地改动";
  if (mode === "dev_clone") return "开发克隆";
  return "—";
});

const botCallout = computed((): { kind: "warn" | "info"; text: string } | null => {
  const b = bot.value;
  if (!b) return null;
  if (b.deployment_mode === "docker") {
    return {
      kind: "warn",
      text: "控制台不能 git 拉代码；请按下方步骤拉新镜像并重启容器。",
    };
  }
  if (b.deployment_mode === "release_tag_dirty") {
    return {
      kind: "warn",
      text: `更新前会自动 stash ${b.dirty_file_count ?? 0} 项本地改动；冲突时需 git stash pop。建议插件放 local/plugins/。`,
    };
  }
  if (b.deployment_mode === "dev_clone") {
    return { kind: "info", text: "更新时执行 git pull --ff-only --autostash。" };
  }
  return null;
});

const botMetaParts = computed(() => {
  const b = bot.value;
  if (!b) return [];
  const parts: string[] = [botDeployLabel.value];
  if (b.git_available && b.current_branch) parts.push(`分支 ${b.current_branch}`);
  if (b.dirty && (b.dirty_file_count ?? 0) > 0) parts.push(`改动 ${b.dirty_file_count} 项`);
  return parts;
});

const updateMastheadLead = computed(() => {
  const parts: string[] = [];
  if (web.value) {
    const tag = web.value.has_update ? " · 有更新" : "";
    parts.push(`WebUI ${webCurrentDisplay.value}${tag}`);
  }
  if (bot.value) {
    const tag = bot.value.has_update ? " · 有更新" : "";
    parts.push(`Bot ${botCurrentDisplay.value}${tag}`);
  }
  return parts.length ? parts.join(" · ") : "检查 WebUI 与 Bot 版本并应用更新。";
});

const updateRefreshBusy = computed(() => refreshWebBusy.value || refreshBotBusy.value);

const updateCheckedAt = ref<number | null>(null);

function formatCheckedAt(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return "—";
  try {
    return new Date(ts * 1000).toLocaleString(undefined, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const updateCheckedAtDisplay = computed(() => formatCheckedAt(updateCheckedAt.value));

function applyUpdateCheckAll(data: {
  webui: UpdateCheckData;
  bot: BotUpdateCheckData;
  checked_at: number;
}) {
  web.value = data.webui;
  bot.value = data.bot;
  updateCheckedAt.value = data.checked_at;
}

async function loadUpdateChecks() {
  try {
    const all = await fetchUpdateCheckAll();
    applyUpdateCheckAll(all);
    return;
  } catch {
    /* 旧版 Bot 无聚合接口时回退 */
  }
  const [webRes, botRes] = await Promise.all([fetchUpdateCheck(), fetchBotUpdateCheck()]);
  web.value = webRes;
  bot.value = botRes;
  updateCheckedAt.value = Math.max(webRes.checked_at ?? 0, botRes.checked_at ?? 0) || null;
}

const botDocLinks = computed(() => {
  const isDocker = bot.value?.deployment_mode === "docker";
  const links: { href: string; label: string }[] = [
    { href: BOT_DOC.home, label: "在线文档" },
    { href: PALLAS_BOT_REPO, label: "Pallas-Bot 仓库" },
    { href: BOT_DOC.siteCustomization, label: "站点定制与更新" },
    { href: BOT_DOC.localReadme, label: "local 目录说明" },
  ];
  if (isDocker) {
    links.unshift({ href: BOT_DOC.dockerDeployment, label: "Docker 部署" });
  } else {
    links.push({ href: BOT_DOC.deployment, label: "标准部署" });
  }
  links.push({ href: BOT_DOC.faqUpdates, label: "FAQ · 更新与版本" });
  return links;
});

const webDocLinks = computed(() => [
  { href: (web.value?.release_url || "").trim() || WEBUI_RELEASES_PAGE, label: "GitHub Release" },
  { href: PALLAS_WEBUI_REPO, label: "Pallas-Bot-WebUI 仓库" },
  { href: BOT_DOC.siteCustomization, label: "站点定制与更新" },
  { href: BOT_DOC.faqUpdates, label: "FAQ · 更新与版本" },
]);

const botApplyDisabled = computed(
  () =>
    busy.value
    || !bot.value?.has_update
    || !bot.value?.latest_tag
    || bot.value?.deployment_mode === "docker",
);

const busy = ref(false);
const msg = ref("");
const {
  restartBusy,
  restartErr,
  restartMsg,
  restartProgressLabel,
  restartInProgress,
  restartAvailable,
  shardedRuntime,
  ensureRestartContext,
  restartBot,
} = useBotSystemRestart({ botUpdateCheck: bot });
const refreshWebBusy = ref(false);
const refreshBotBusy = ref(false);

const ghTokenInput = ref("");
const ghTokenHadValue = ref(false);
const ghTokenBusy = ref(false);
const ghTokenErr = ref("");
const ghTokenOk = ref("");
const gitMirrorOpen = ref(false);

async function loadGithubTokenHint() {
  ghTokenErr.value = "";
  ghTokenOk.value = "";
  try {
    const data = await fetchPluginConfig(PB_PROTOCOL_PLUGIN);
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
    await putPluginConfig(PB_PROTOCOL_PLUGIN, { [GITHUB_TOKEN_FIELD]: next });
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
    await putPluginConfig(PB_PROTOCOL_PLUGIN, { [GITHUB_TOKEN_FIELD]: "" });
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
    await loadUpdateChecks();
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

async function refreshAllUpdates() {
  err.value = "";
  refreshWebBusy.value = true;
  refreshBotBusy.value = true;
  try {
    await loadUpdateChecks();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    refreshWebBusy.value = false;
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

async function applyBot(restart = false) {
  if (!bot.value?.latest_tag) return;
  const prompt = restart
    ? `将 Bot 更新到 ${bot.value.latest_tag} 并重启进程？`
    : `将 Bot 更新到 ${bot.value.latest_tag}？`;
  if (!confirm(prompt)) return;
  busy.value = true;
  try {
    const r = await postBotUpdateApply({ restart });
    msg.value = r.message || (restart ? "已触发更新与重启。" : "已触发。");
    if (!restart) {
      await load();
    }
  } catch (e) {
    err.value = axiosErrorDetail(e);
  } finally {
    busy.value = false;
  }
}

async function triggerBotRestart(workersOnly = false) {
  err.value = "";
  msg.value = "";
  const ok = await restartBot(workersOnly);
  if (ok) msg.value = restartProgressLabel.value || restartMsg.value || "Bot 已恢复在线。";
  else if (restartErr.value) err.value = restartErr.value;
}

watch(
  () => route.hash,
  () => {
    if (pageReady.value) scrollUpdateHashIntoView();
  },
);

onMounted(() => {
  void load().then(() => ensureRestartContext());
});
</script>

<template>
  <div class="update-page console-hub-page">
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
      <ConsoleHubMasthead :icon="panelNavIcon">
        <template #title>
          更新
        </template>
        <template #lead>
          {{ updateMastheadLead }}
          <span
            v-if="updateCheckedAtDisplay !== '—'"
            class="update-page__checked-at muted"
          > · 检查于 {{ updateCheckedAtDisplay }}</span>
        </template>
        <template #actions>
          <div class="console-hub-toolbar-strip__masthead-actions">
            <UiButton
              variant="outline"
              @click="gitMirrorOpen = true"
            >
              镜像源
            </UiButton>
            <RefreshIconButton
              embedded
              class="hub-refresh-wide-only"
              :busy="updateRefreshBusy"
              label="重新检查"
              @click="refreshAllUpdates"
            />
          </div>
        </template>
      </ConsoleHubMasthead>

      <div class="update-page__overview">
        <a
          href="#console-update-webui"
          class="update-page__overview-card"
          :class="{ 'update-page__overview-card--warn': web?.has_update }"
        >
          <span class="update-page__overview-k">WebUI</span>
          <span class="update-page__overview-v">{{ webCurrentDisplay }}</span>
          <span class="update-page__overview-meta muted">
            {{ web?.has_update ? `→ ${web?.latest_tag ?? "?"}` : "已是最新" }}
          </span>
        </a>
        <a
          href="#console-update-bot"
          class="update-page__overview-card"
          :class="{ 'update-page__overview-card--warn': bot?.has_update }"
        >
          <span class="update-page__overview-k">Bot</span>
          <span class="update-page__overview-v">{{ botCurrentDisplay }}</span>
          <span class="update-page__overview-meta muted">
            {{ bot?.has_update ? `→ ${bot?.latest_tag ?? "?"}` : botDeployLabel }}
          </span>
        </a>
      </div>

      <UiCard
        id="console-update-webui"
        tag="div"
        glass
        class="update-page__panel"
      >
        <div class="panel__hd panel__hd--split update-page__panel-hd-nowrap">
          <h2 class="panel__title">
            <ConsoleNavIcon class="panel__title-ico" :name="panelNavIcon" />WebUI
            <RefreshIconButton
              embedded
              :show-label="false"
              :busy="refreshWebBusy"
              :disabled="busy"
              label="刷新 WebUI 更新检查"
              @click="refreshWeb"
            />
            <UiBadge
              v-if="web?.has_update"
              class="update-page__status-pill"
              variant="warn"
            >
              有更新
            </UiBadge>
            <UiBadge
              v-else
              class="update-page__status-pill"
              variant="ok"
            >
              已是最新
            </UiBadge>
          </h2>
          <div class="row-actions">
          </div>
        </div>
        <div class="panel__bd update-page__bd update-page__bd--release">
          <div class="update-page__release-summary">
            <div class="update-page__release-stat">
              <span class="update-page__release-stat-label">当前</span>
              <span class="update-page__release-stat-value">{{ webCurrentDisplay }}</span>
            </div>
            <span
              class="update-page__release-stat-arrow muted"
              aria-hidden="true"
            >→</span>
            <div class="update-page__release-stat">
              <span class="update-page__release-stat-label">远端</span>
              <span class="update-page__release-stat-value">{{ web?.latest_tag ?? "—" }}</span>
            </div>
          </div>

          <div class="update-page__release-primary">
            <UiButton
              variant="primary"
              :disabled="webApplyDisabled"
              :busy="busy"
              @click="applyWeb"
            >
              应用 WebUI 更新
            </UiButton>
            <a
              class="update-page__link update-page__release-ext-link"
              :href="(web?.release_url || '').trim() || WEBUI_RELEASES_PAGE"
              target="_blank"
              rel="noopener noreferrer"
            >GitHub Release</a>
          </div>

          <p
            v-if="web?.error"
            class="alert alert--err update-page__release-inline-alert"
          >
            {{ web.error }}
          </p>
          <div
            v-else-if="webCallout"
            class="update-page__release-callout update-page__release-callout--info"
          >
            {{ webCallout.text }}
          </div>

          <details class="update-page__release-fold update-page__release-notes">
            <summary class="update-page__release-fold-summary">
              {{ webReleaseNotesSummary }}
            </summary>
            <div
              v-if="(web?.release_notes || '').trim()"
              ref="webReleaseNotesEl"
              class="update-page__release-notes-body update-page__release-notes-body--md"
              v-html="webReleaseNotesHtml"
            />
            <p
              v-else
              class="update-page__release-notes-empty muted"
            >
              GitHub 未提供发行说明正文，请查看
              <a
                class="update-page__link"
                :href="(web?.release_url || '').trim() || WEBUI_RELEASES_PAGE"
                target="_blank"
                rel="noopener noreferrer"
              >Release 页面</a>。
            </p>
          </details>

          <details class="update-page__release-fold update-page__doc-links">
            <summary class="update-page__release-fold-summary">相关文档</summary>
            <ul class="update-page__doc-links-list">
              <li
                v-for="link in webDocLinks"
                :key="link.href"
              >
                <a
                  class="update-page__link"
                  :href="link.href"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ link.label }}</a>
              </li>
            </ul>
          </details>

          <p class="update-page__release-foot muted">
            由 Bot 从 GitHub 下载 <code>dist.zip</code> 并解压到控制台静态目录。
          </p>
        </div>
      </UiCard>

      <UiCard
        id="console-update-bot"
        tag="div"
        glass
        class="update-page__panel"
      >
        <div class="panel__hd panel__hd--split update-page__panel-hd-nowrap">
          <h2 class="panel__title">
            <ConsoleNavIcon class="panel__title-ico" :name="panelNavIcon" />Bot 本体
            <RefreshIconButton
              embedded
              :show-label="false"
              :busy="refreshBotBusy"
              :disabled="busy"
              label="刷新 Bot 更新检查"
              @click="refreshBot"
            />
            <UiBadge
              v-if="bot?.has_update"
              class="update-page__status-pill"
              variant="warn"
            >
              有更新
            </UiBadge>
            <UiBadge
              v-else-if="bot?.development_build"
              class="update-page__status-pill"
              variant="secondary"
              title="当前 commit 超前于 GitHub 最新发行版，无需执行「应用 Bot 更新」"
            >
              开发构建
            </UiBadge>
            <UiBadge
              v-else
              class="update-page__status-pill"
              variant="ok"
            >
              已是最新
            </UiBadge>
          </h2>
          <div class="row-actions">
          </div>
        </div>
        <div class="panel__bd update-page__bd update-page__bd--release">
          <div class="update-page__release-summary">
            <div class="update-page__release-stat">
              <span class="update-page__release-stat-label">当前</span>
              <span class="update-page__release-stat-value">{{ botCurrentDisplay }}</span>
              <span
                v-if="bot?.current_commit"
                class="update-page__release-stat-sub muted"
              >{{ bot.current_commit.slice(0, 7) }}</span>
            </div>
            <span
              class="update-page__release-stat-arrow muted"
              aria-hidden="true"
            >→</span>
            <div class="update-page__release-stat">
              <span class="update-page__release-stat-label">远端</span>
              <span class="update-page__release-stat-value">{{ bot?.latest_tag ?? "—" }}</span>
            </div>
          </div>

          <p
            v-if="botMetaParts.length"
            class="update-page__release-meta muted"
          >
            {{ botMetaParts.join(" · ") }}
          </p>

          <div class="update-page__release-primary">
            <UiButton
              v-if="bot?.deployment_mode !== 'docker'"
              variant="primary"
              :disabled="botApplyDisabled"
              :busy="busy"
              @click="applyBot(false)"
            >
              应用 Bot 更新
            </UiButton>
            <UiButton
              v-if="bot?.deployment_mode !== 'docker' && bot?.restart_available"
              variant="outline"
              :disabled="botApplyDisabled"
              :busy="busy"
              @click="applyBot(true)"
            >
              更新并重启
            </UiButton>
            <a
              class="update-page__link update-page__release-ext-link"
              :href="(bot?.release_url || '').trim() || BOT_RELEASES_PAGE"
              target="_blank"
              rel="noopener noreferrer"
            >GitHub Release</a>
          </div>

          <p
            v-if="bot?.error"
            class="alert alert--err update-page__release-inline-alert"
          >
            {{ bot.error }}
          </p>
          <div
            v-else-if="botCallout"
            class="update-page__release-callout"
            :class="botCallout.kind === 'warn' ? 'alert alert--warn' : 'update-page__release-callout--info'"
          >
            {{ botCallout.text }}
          </div>

          <section
            v-if="bot?.deployment_mode === 'docker'"
            class="update-page__release-section update-page__docker-hint"
          >
            <h3 class="update-page__release-section-title">Docker 更新步骤</h3>
            <ol class="update-page__docker-steps">
              <li><code>docker compose pull pallasbot</code></li>
              <li><code>docker compose up -d pallasbot</code>（未换镜像时加 <code>--force-recreate</code>）</li>
              <li>未用 <code>:latest</code> 时，先把 compose 里 image tag 改为目标版本</li>
            </ol>
            <p class="muted update-page__docker-foot">
              数据与配置通常在卷中（<code>data/</code>、<code>config/pallas.toml</code>、<code>local/plugins/</code>）。
            </p>
          </section>

          <details class="update-page__release-fold update-page__release-notes">
            <summary class="update-page__release-fold-summary">
              {{ botReleaseNotesSummary }}
            </summary>
            <div
              v-if="(bot?.release_notes || '').trim()"
              ref="botReleaseNotesEl"
              class="update-page__release-notes-body update-page__release-notes-body--md"
              v-html="botReleaseNotesHtml"
            />
            <p
              v-else
              class="update-page__release-notes-empty muted"
            >
              GitHub 未提供发行说明正文，请查看
              <a
                class="update-page__link"
                :href="(bot?.release_url || '').trim() || BOT_RELEASES_PAGE"
                target="_blank"
                rel="noopener noreferrer"
              >Release 页面</a>。
            </p>
          </details>

          <details class="update-page__release-fold update-page__doc-links">
            <summary class="update-page__release-fold-summary">相关文档</summary>
            <ul class="update-page__doc-links-list">
              <li
                v-for="link in botDocLinks"
                :key="link.href"
              >
                <a
                  class="update-page__link"
                  :href="link.href"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ link.label }}</a>
              </li>
            </ul>
          </details>

          <p
            v-if="bot?.deployment_mode !== 'docker'"
            class="update-page__release-foot muted"
          >
            配置与数据请放在 <code>config/pallas.toml</code>、<code>data/</code>，避免改主仓 <code>src/</code>。
          </p>
        </div>
      </UiCard>

      <UiCard
        v-if="restartAvailable"
        id="console-update-restart"
        glass
        class="update-page__panel update-page__panel--ops"
      >
        <div class="panel__hd panel__hd--split update-page__ops-hd">
          <h2 class="panel__title">
            <ConsoleNavIcon
              class="panel__title-ico"
              name="server"
            />运维
          </h2>
        </div>
        <div class="panel__bd update-page__bd">
          <p class="muted update-page__ops-lead">
            安装/更新插件或修改需重启生效的配置后，可在此触发 Bot 进程重启。与「更新并重启」不同，此处不会拉取新代码。
            <template v-if="shardedRuntime">分片部署下可选择仅重启分片节点或重启全部进程。</template>
          </p>
          <p
            v-if="restartInProgress || restartMsg"
            class="muted update-page__ops-lead"
            role="status"
          >
            {{ restartProgressLabel || restartMsg }}
          </p>
          <p
            v-if="restartErr"
            class="alert alert--err update-page__ops-lead"
            role="alert"
          >
            {{ restartErr }}
          </p>
          <div class="row-actions update-page__ops-actions">
            <UiButton
              v-if="shardedRuntime"
              variant="outline"
              :disabled="restartBusy || restartInProgress"
              :busy="restartBusy || restartInProgress"
              @click="triggerBotRestart(true)"
            >
              重启 Worker
            </UiButton>
            <UiButton
              variant="destructive"
              :disabled="restartBusy || restartInProgress"
              :busy="restartBusy || restartInProgress"
              @click="triggerBotRestart(false)"
            >
              {{ restartInProgress ? "重启中…" : shardedRuntime ? "重启全部进程" : "重启 Bot" }}
            </UiButton>
          </div>
        </div>
      </UiCard>

      <details
        id="console-update-github"
        class="update-page__gh-fold"
      >
        <summary class="update-page__gh-fold-summary">
          GitHub 令牌
          <span class="muted"> · {{ ghTokenHadValue ? "已配置" : "未配置" }}</span>
        </summary>
        <UiCard
          tag="div"
          glass
          class="update-page__panel update-page__panel--gh"
        >
          <div class="panel__bd muted update-page__bd">
            <p>
              可选。用于 Release 检查与下载、协议端在线拉包等。也可在
              <RouterLink :to="{ name: 'plugins', params: { name: PB_PROTOCOL_PLUGIN } }">插件配置 → 协议端</RouterLink>
              填写 <code>PALLAS_PROTOCOL_GITHUB_TOKEN</code>。
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
              <UiButton
                variant="primary"
                :disabled="ghTokenBusy"
                :busy="ghTokenBusy"
                @click="saveGithubToken"
              >
                {{ ghTokenBusy ? "保存中…" : "保存" }}
              </UiButton>
              <UiButton
                v-if="ghTokenHadValue"
                variant="outline"
                :disabled="ghTokenBusy"
                @click="clearGithubToken"
              >
                清除
              </UiButton>
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
          </div>
        </UiCard>
      </details>

      <GitMirrorDialog
        :open="gitMirrorOpen"
        @close="gitMirrorOpen = false"
      />
    </template>
  </div>
</template>

<style scoped>
.update-page__overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.update-page__overview-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
  text-decoration: none;
  color: inherit;
  transition:
    border-color 0.16s ease,
    background 0.16s ease;
}

.update-page__overview-card:hover {
  border-color: color-mix(in srgb, var(--foreground) 16%, var(--border));
}

.update-page__overview-card--warn {
  border-color: color-mix(in srgb, var(--warn) 35%, var(--border));
  background: color-mix(in srgb, var(--warn) 8%, var(--bg-card));
}

.update-page__overview-k {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.update-page__overview-v {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.25;
  word-break: break-word;
}

.update-page__overview-meta {
  font-size: 12px;
  line-height: 1.4;
}

.update-page__checked-at {
  font-size: inherit;
}

.update-page__gh-fold {
  margin-top: 14px;
}

.update-page__gh-fold-summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 2px;
  list-style: none;
}

.update-page__gh-fold-summary::-webkit-details-marker {
  display: none;
}

.update-page__panel--gh {
  margin-top: 8px;
}

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

.update-page__bd--release {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.update-page__release-summary {
  display: flex;
  align-items: stretch;
  gap: 10px;
  margin-bottom: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--bg-muted) 45%, transparent);
}

.update-page__release-stat {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.update-page__release-stat-label {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.72;
}

.update-page__release-stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.25;
  word-break: break-word;
}

.update-page__release-stat-sub {
  font-size: 11px;
  font-family: var(--font-mono, ui-monospace, monospace);
}

.update-page__release-stat-arrow {
  flex: 0 0 auto;
  align-self: center;
  font-size: 18px;
  opacity: 0.5;
}

.update-page__release-meta {
  margin: 0 0 12px !important;
  font-size: 12px;
}

.update-page__release-primary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-bottom: 12px;
}

.update-page__release-ext-link {
  font-size: 13px;
}

.update-page__release-inline-alert,
.update-page__release-callout {
  margin: 0 0 12px !important;
  font-size: 13px;
  line-height: 1.45;
}

.update-page__release-callout--info {
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  background: color-mix(in srgb, var(--bg-muted) 35%, transparent);
  color: var(--text-muted);
}

.update-page__release-section {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  background: color-mix(in srgb, var(--bg-muted) 30%, transparent);
}

.update-page__release-section-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.update-page__release-section p {
  margin: 0;
}

.update-page__config-migrate-note {
  margin-top: 8px !important;
  font-size: 12px;
  line-height: 1.45;
}

.update-page__config-migrate-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.update-page__config-migrate-feedback {
  margin-top: 8px !important;
  margin-bottom: 0 !important;
}

.update-page__release-fold,
.update-page__release-notes {
  margin: 0 0 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  background: color-mix(in srgb, var(--bg-muted) 25%, transparent);
}

.update-page__release-fold-summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  color: var(--text);
  user-select: none;
}

.update-page__release-foot {
  margin: 4px 0 0 !important;
  font-size: 12px;
}

.update-page__doc-links {
  margin: 0;
  padding: 8px 10px;
  border: none;
  background: transparent;
}

.update-page__doc-links-list {
  margin: 8px 0 0;
  padding-left: 1.2rem;
  font-size: 13px;
  line-height: 1.5;
}

.update-page__doc-links-list li + li {
  margin-top: 4px;
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

.update-page__release-notes-empty {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.45;
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
  font-family: inherit;
}

.update-page__release-notes-body--md :deep(h2),
.update-page__release-notes-body--md :deep(h3),
.update-page__release-notes-body--md :deep(h4) {
  margin: 10px 0 6px;
  color: var(--text);
  font-weight: 600;
  line-height: 1.35;
}

.update-page__release-notes-body--md :deep(h2) {
  font-size: 14px;
}

.update-page__release-notes-body--md :deep(h3) {
  font-size: 13px;
}

.update-page__release-notes-body--md :deep(h4) {
  font-size: 12px;
}

.update-page__release-notes-body--md :deep(p) {
  margin: 4px 0;
}

.update-page__release-notes-body--md :deep(ul),
.update-page__release-notes-body--md :deep(ol) {
  margin: 4px 0 8px;
  padding-left: 1.25rem;
}

.update-page__release-notes-body--md :deep(li) {
  margin-bottom: 4px;
}

.update-page__release-notes-body--md :deep(blockquote) {
  margin: 8px 0;
  padding: 0 0 0 10px;
  border-left: 3px solid var(--border);
  color: var(--text-muted);
}

.update-page__release-notes-body--md :deep(strong) {
  color: var(--text);
  font-weight: 600;
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

.update-page__release-notes-body--md :deep(pre) {
  overflow-x: auto;
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--bg-muted) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  font-size: 12px;
  line-height: 1.45;
}

.update-page__release-notes-body--md :deep(.readme-code-block) {
  margin: 8px 0;
}

.update-page__release-notes-body--md :deep(.readme-code-block pre) {
  margin: 0;
  /* 为右上角「复制」留空；覆盖上方 padding 简写 */
  padding-right: 4.25rem;
}

.update-page__release-notes-body--md :deep(pre code) {
  font-family: var(--font-mono);
  font-size: inherit;
  background: transparent;
  border: none;
  padding: 0;
}

.update-page__release-notes-body--md :deep(:not(pre) > code) {
  font-family: var(--font-mono);
  font-size: 0.92em;
  font-weight: 650;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: color-mix(in srgb, var(--bg-muted) 55%, var(--bg-card) 45%);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
}

.update-page__release-notes-body--md :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12px;
}

.update-page__release-notes-body--md :deep(th),
.update-page__release-notes-body--md :deep(td) {
  border: 1px solid var(--border);
  padding: 5px 8px;
  text-align: left;
  vertical-align: top;
  word-break: break-word;
}

.update-page__release-notes-body--md :deep(th) {
  color: var(--text);
  font-weight: 650;
  background: color-mix(in srgb, var(--bg-muted) 55%, transparent);
}

.update-page__docker-hint {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
}

.update-page__docker-steps {
  margin: 0 0 8px;
  padding-left: 1.25rem;
}

.update-page__docker-steps li {
  margin-bottom: 4px;
}

.update-page__docker-foot {
  margin: 0 !important;
  font-size: 12px;
}

.update-page__apply {
  margin-top: 14px;
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

.update-page__ops-lead {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.55;
}

.update-page__ops-actions {
  justify-content: flex-start;
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

  .update-page__ops-actions {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: stretch;
  }

  .update-page__ops-actions > :deep(.ui-btn) {
    width: auto;
    flex: 1 1 0;
    min-width: 0;
    justify-content: center;
  }
}
</style>
