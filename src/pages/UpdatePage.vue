<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  fetchBotConfigMigrationCheck,
  fetchBotUpdateCheck,
  fetchCommonConfig,
  fetchUpdateCheck,
  postBotConfigMigrationApply,
  postBotUpdateApply,
  postUpdateApply,
  putCommonConfig,
} from "@/api/consoleApi";
import type { BotConfigMigrationCheckData, BotUpdateCheckData, UpdateCheckData } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import { axiosErrorDetail } from "@/api/http";
import { releaseNotesToSafeHtml } from "@/utils/releaseNotesHtml";
import {
  PALLAS_BOT_DOC,
  PALLAS_BOT_RELEASES,
  PALLAS_BOT_REPO,
  PALLAS_WEBUI_RELEASES,
  PALLAS_WEBUI_REPO,
} from "@/utils/pallasExternalLinks";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

const WEBUI_RELEASES_PAGE = PALLAS_WEBUI_RELEASES;
const BOT_RELEASES_PAGE = PALLAS_BOT_RELEASES;
const BOT_DOC = PALLAS_BOT_DOC;

/** 与通用配置 `?section=pallas_protocol` 一致，经通用配置落盘 */
const PALLAS_PROTOCOL_SECTION_ID = "pallas_protocol";
const GITHUB_TOKEN_FIELD = "pallas_protocol_github_token";

const panelNavIcon = usePanelNavIcon();
const route = useRoute();
const err = ref("");
const pageReady = ref(false);
const web = ref<UpdateCheckData | null>(null);
const bot = ref<BotUpdateCheckData | null>(null);
const configMigration = ref<BotConfigMigrationCheckData | null>(null);

const webReleaseNotesHtml = computed(() => releaseNotesToSafeHtml(web.value?.release_notes));
const botReleaseNotesHtml = computed(() => releaseNotesToSafeHtml(bot.value?.release_notes));

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
  if (configMigration.value?.show) {
    links.push({ href: BOT_DOC.settingsStorage, label: "配置存储" });
  }
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
const refreshWebBusy = ref(false);
const refreshBotBusy = ref(false);
const configMigrationBusy = ref(false);
const configMigrationMsg = ref("");
const configMigrationErr = ref("");
const configMigrationLegacyFiles = computed(() => {
  const files = configMigration.value?.legacy_env_files ?? [];
  return files.length ? files.join("、") : ".env";
});

async function loadConfigMigration() {
  configMigrationErr.value = "";
  try {
    configMigration.value = await fetchBotConfigMigrationCheck();
  } catch (e) {
    configMigrationErr.value = e instanceof Error ? e.message : String(e);
    configMigration.value = null;
  }
}

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
  void loadConfigMigration();
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
    await loadConfigMigration();
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

async function applyConfigMigration(force: boolean) {
  const cm = configMigration.value;
  if (!cm?.show) return;
  const prompt = force
    ? "将覆盖已有的 config/pallas.toml 与 webui.json，是否继续？建议先备份。"
    : "把根目录 .env 迁移到 config/pallas.toml 与 data/pallas_config/webui.json？";
  if (!confirm(prompt)) return;
  configMigrationBusy.value = true;
  configMigrationErr.value = "";
  configMigrationMsg.value = "";
  try {
    const r = await postBotConfigMigrationApply(force);
    configMigrationMsg.value = r.message;
    configMigration.value = r.migration ?? (await fetchBotConfigMigrationCheck());
    toastSaveSuccess("配置已迁移");
  } catch (e) {
    configMigrationErr.value = axiosErrorDetail(e);
    toastApiError(e, "迁移失败");
  } finally {
    configMigrationBusy.value = false;
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
            <RouterLink :to="{ path: '/common-config', query: { section: PALLAS_PROTOCOL_SECTION_ID } }">通用配置 → 协议端</RouterLink>
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
        <div class="panel__bd update-page__bd update-page__bd--release">
          <div class="update-page__release-summary">
            <div class="update-page__release-stat">
              <span class="update-page__release-stat-label">当前</span>
              <span class="update-page__release-stat-value">{{ web?.current_tag || "—" }}</span>
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
            <button
              type="button"
              class="btn btn--primary"
              :disabled="webApplyDisabled"
              @click="applyWeb"
            >
              应用 WebUI 更新
            </button>
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
              {{ web?.latest_tag ? `「${web.latest_tag}」发行说明` : "发行说明" }}
            </summary>
            <div
              v-if="(web?.release_notes || '').trim()"
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
        <div class="panel__bd update-page__bd update-page__bd--release">
          <div class="update-page__release-summary">
            <div class="update-page__release-stat">
              <span class="update-page__release-stat-label">当前</span>
              <span class="update-page__release-stat-value">{{ bot?.current_tag || "—" }}</span>
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
            <button
              v-if="bot?.deployment_mode !== 'docker'"
              type="button"
              class="btn btn--primary"
              :disabled="botApplyDisabled"
              @click="applyBot"
            >
              应用 Bot 更新
            </button>
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
            v-if="configMigration?.show"
            class="update-page__release-section"
          >
            <h3 class="update-page__release-section-title">配置迁移</h3>
            <p class="muted">
              新版本用 <code>pallas.toml</code> + <code>webui.json</code>；检测到
              <strong>{{ configMigration.legacy_env_key_count }}</strong> 项遗留
              <code>{{ configMigrationLegacyFiles }}</code>。
              <span v-if="configMigration.can_migrate">可一键迁移。</span>
              <span v-else-if="configMigration.suggest_cleanup_legacy_env">覆盖迁移请先备份。</span>
            </p>
            <p class="muted update-page__config-migrate-note">
              迁移会把 Pallas 插件/通用配置写入 <code>webui.json</code>；根目录
              <code>.env</code> 仍可保留，专放 nb/pip 插件环境变量（见仓库
              <code>.env.example</code>）。同名键以 <code>webui.json</code> 为准，请勿重复。
              pip 插件须在 <code>pyproject.toml</code> 的 <code>[tool.nonebot.plugins]</code> 注册后才会加载。
            </p>
            <div
              v-if="configMigration.can_migrate || configMigration.needs_force"
              class="update-page__config-migrate-actions"
            >
              <button
                v-if="configMigration.can_migrate"
                type="button"
                class="btn btn--primary"
                :disabled="configMigrationBusy || busy"
                @click="applyConfigMigration(false)"
              >
                一键迁移
              </button>
              <button
                v-if="configMigration.needs_force"
                type="button"
                class="btn"
                :disabled="configMigrationBusy || busy"
                @click="applyConfigMigration(true)"
              >
                覆盖并迁移
              </button>
            </div>
            <p
              v-if="configMigrationMsg"
              class="alert alert--ok update-page__config-migrate-feedback"
            >
              {{ configMigrationMsg }}
            </p>
            <p
              v-if="configMigrationErr"
              class="alert alert--err update-page__config-migrate-feedback"
            >
              {{ configMigrationErr }}
            </p>
          </section>

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
              {{ bot?.latest_tag ? `「${bot.latest_tag}」发行说明` : "发行说明" }}
            </summary>
            <div
              v-if="(bot?.release_notes || '').trim()"
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
