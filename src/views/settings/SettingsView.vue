<script setup lang="ts">
import { changeConsoleLogin, fetchPluginConfig, fetchSystem, putPluginConfig } from "@/api/consoleApi";
import { fetchHealth } from "@/api/health";
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import {
  AdjustmentIcon,
  CheckCircleFilledIcon,
  DesktopIcon,
  LinkIcon,
  LockOnIcon,
  MoonIcon,
  SunnyIcon,
  TimeIcon,
} from "tdesign-icons-vue-next";
import { computed, onMounted, ref } from "vue";
import {
  ACCENT_SWATCHES,
  POLL_OPTIONS,
  RADIUS_PRESETS,
  getAccentHex,
  getDashboardPollMs,
  getDensity,
  getRadiusRem,
  setAccentHex,
  setDashboardPollMs,
  setDensity,
  setRadiusRem,
  type DensityPref,
} from "@/utils/pallasUiPrefs";
import { setThemeDisplayMode, themeDisplayMode, type ThemeDisplayMode } from "@/utils/theme";

type Section = "accessAuth" | "appearance" | "behavior" | "baseline" | "ops";

const section = ref<Section>("accessAuth");
const webuiDevMode = ref(false);
const loading = ref(false);
const healthOk = ref<boolean | null>(null);
const driverHost = ref<string>("-");
const driverPort = ref<number | null>(null);

const base = (import.meta.env.BASE_URL as string) || "/pallas/";
const apiBase = `${base.replace(/\/$/, "")}/api`;
const healthPath = `${apiBase}/health`;
const protocolPath = "/protocol/console";
const protocolHint = protocolPath;

const sectionTitle: Record<Section, string> = {
  accessAuth: "访问与鉴权",
  appearance: "外观",
  behavior: "数据刷新",
  baseline: "连接与端点",
  ops: "生产与自检",
};

const sectionSub: Record<Section, string> = {
  accessAuth: "口令与 GitHub Token。",
  appearance: "主题与布局（浏览器本地）。",
  behavior: "仪表盘轮询间隔。",
  baseline: "健康检查与驱动地址。",
  ops: "部署与自检。",
};

const navItems = [
  { index: "accessAuth" as const, label: "访问与鉴权", icon: LockOnIcon },
  { index: "appearance" as const, label: "外观", icon: AdjustmentIcon },
  { index: "behavior" as const, label: "数据刷新", icon: TimeIcon },
  { index: "baseline" as const, label: "连接与端点", icon: LinkIcon },
  { index: "ops" as const, label: "生产与自检", icon: CheckCircleFilledIcon },
];

const accentHex = ref(getAccentHex());
const radiusRem = ref(getRadiusRem());
const densityPref = ref<DensityPref>(getDensity());
const dashPollMs = ref(getDashboardPollMs());

function pickThemeMode(m: ThemeDisplayMode): void {
  setThemeDisplayMode(m);
}

function pickAccent(hex: string): void {
  accentHex.value = hex;
  setAccentHex(hex);
}

function pickRadius(r: number): void {
  radiusRem.value = r;
  setRadiusRem(r);
}

function pickDensity(d: DensityPref): void {
  densityPref.value = d;
  setDensity(d);
}

function pickPoll(ms: number): void {
  dashPollMs.value = ms;
  setDashboardPollMs(ms);
}

const driverAddr = computed(() => {
  if (!driverHost.value || driverHost.value === "-" || !driverPort.value) return "-";
  return `${driverHost.value}:${driverPort.value}`;
});

const consolePw1 = ref("");
const consolePw2 = ref("");
const consolePwSaving = ref(false);
const consolePwMsg = ref<{ type: "success" | "error"; text: string } | null>(null);

const githubToken = ref("");
const githubTokenLoading = ref(false);
const githubTokenSaving = ref(false);
const githubTokenSaveMsg = ref<{ type: "success" | "error"; text: string } | null>(null);

async function loadGithubToken() {
  githubTokenLoading.value = true;
  githubTokenSaveMsg.value = null;
  try {
    const cfg = await fetchPluginConfig("pallas_protocol");
    const field = cfg.fields.find((f) => f.name === "pallas_protocol_github_token");
    githubToken.value = field ? String(field.current ?? "") : "";
  } catch {
    githubToken.value = "";
  } finally {
    githubTokenLoading.value = false;
  }
}

async function saveConsoleLogin() {
  const p1 = consolePw1.value.trim();
  const p2 = consolePw2.value.trim();
  consolePwMsg.value = null;
  if (!p1) {
    return;
  }
  if (p1 !== p2) {
    consolePwMsg.value = { type: "error", text: "两次输入不一致。" };
    return;
  }
  consolePwSaving.value = true;
  try {
    const r = await changeConsoleLogin(p1);
    consolePw1.value = "";
    consolePw2.value = "";
    consolePwMsg.value = { type: "success", text: r.message || "已保存" };
    const root = base.replace(/\/$/, "");
    window.setTimeout(() => {
      window.location.href = `${root}/login?reason=password_changed`;
    }, 800);
  } catch (e) {
    consolePwMsg.value = { type: "error", text: String(e) };
  } finally {
    consolePwSaving.value = false;
  }
}

async function saveGithubToken() {
  githubTokenSaving.value = true;
  githubTokenSaveMsg.value = null;
  try {
    await putPluginConfig("pallas_protocol", {
      pallas_protocol_github_token: githubToken.value.trim(),
    });
    githubTokenSaveMsg.value = { type: "success", text: "已保存，重启 Bot 后生效。" };
  } catch (e) {
    githubTokenSaveMsg.value = { type: "error", text: String(e) };
  } finally {
    githubTokenSaving.value = false;
  }
}

async function loadRuntimeMeta() {
  loading.value = true;
  try {
    const [h, s] = await Promise.all([fetchHealth(), fetchSystem()]);
    healthOk.value = !!h.ok;
    driverHost.value = s.nonebot2_driver?.host || "-";
    driverPort.value = s.nonebot2_driver?.port ?? null;
    webuiDevMode.value = Boolean(s.console?.pallas_webui_dev_mode);
  } catch {
    healthOk.value = false;
    driverHost.value = "-";
    driverPort.value = null;
    webuiDevMode.value = false;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  accentHex.value = getAccentHex();
  radiusRem.value = getRadiusRem();
  densityPref.value = getDensity();
  dashPollMs.value = getDashboardPollMs();
  void loadRuntimeMeta();
  void loadGithubToken();
});

async function logoutConsole() {
  const logoutUrl = `${base.replace(/\/$/, "")}/logout`;
  try {
    await fetch(logoutUrl, { method: "POST", credentials: "same-origin" });
  } finally {
    window.location.href = `${base.replace(/\/$/, "")}/login`;
  }
}
</script>

<template>
  <PallasSidebarShell
    v-model="section"
    aside-title="偏好与连接"
    menu-aria-label="设置分节"
    :nav-items="navItems"
  >
    <template #header="{ section: s }">
      <h1 class="main-title">{{ sectionTitle[s as Section] }}</h1>
      <p class="main-sub">{{ sectionSub[s as Section] }}</p>
    </template>

    <div v-show="section === 'accessAuth'" class="panel auth-stack">
      <t-alert
        v-if="webuiDevMode"
        theme="warning"
        class="sl-alert"
        style="margin-bottom: 12px"
        title="开发模式：API 不校验会话，仅本机。"
      />
      <t-card :bordered="true" class="cardx sl-card">
        <header class="sl-hd">
          <h3 class="sl-title">修改统一控制台口令</h3>
          <p class="sl-desc">与协议端同口令；保存后重新登录。</p>
        </header>
        <t-input
          v-model="consolePw1"
          type="password"
          clearable
          placeholder="新口令"
          class="api-tok pallas-form-quiet"
        />
        <t-input
          v-model="consolePw2"
          type="password"
          clearable
          placeholder="再次输入"
          class="api-tok pallas-form-quiet"
          style="margin-top: 10px"
        />
        <div class="token-save-row" style="margin-top: 12px">
          <t-button theme="primary" class="sl-btn-primary" :loading="consolePwSaving" @click="saveConsoleLogin">
            保存新口令
          </t-button>
          <t-button variant="outline" class="sl-btn-ghost" :disabled="consolePwSaving" @click="logoutConsole">
            退出登录
          </t-button>
          <t-alert
            v-if="consolePwMsg"
            :theme="consolePwMsg.type === 'success' ? 'success' : 'error'"
            :title="consolePwMsg.text"
            class="token-save-alert sl-alert"
          />
        </div>
      </t-card>

      <t-card :bordered="true" class="cardx sl-card">
        <header class="sl-hd sl-hd-row">
          <div>
            <h3 class="sl-title">GitHub 访问令牌</h3>
            <p class="sl-desc">写入 pallas_protocol；保存后重启 Bot。</p>
          </div>
          <t-button class="sl-btn-ghost" size="small" variant="outline" :loading="githubTokenLoading" @click="loadGithubToken">
            刷新
          </t-button>
        </header>
        <t-input
          v-model="githubToken"
          type="password"
          clearable
          placeholder="ghp_… 或 Fine-grained token（留空则不使用）"
          class="api-tok pallas-form-quiet"
          :disabled="githubTokenLoading"
        />
        <p class="sl-foot">
          <t-link href="https://github.com/settings/tokens" target="_blank" theme="primary" class="sl-link">
            生成 token
          </t-link>
          （只读即可）
        </p>
        <div class="token-save-row">
          <t-button theme="primary" class="sl-btn-primary" :loading="githubTokenSaving" @click="saveGithubToken">
            保存
          </t-button>
          <t-alert
            v-if="githubTokenSaveMsg"
            :theme="githubTokenSaveMsg.type === 'success' ? 'success' : 'error'"
            :title="githubTokenSaveMsg.text"
            class="token-save-alert sl-alert"
          />
        </div>
      </t-card>
    </div>

    <div v-show="section === 'appearance'" class="panel auth-stack">
      <t-card :bordered="true" class="cardx sl-card">
        <header class="sl-hd">
          <h3 class="sl-title">显示模式</h3>
          <p class="sl-desc">浅色 / 深色 / 跟随系统。</p>
        </header>
        <div class="sl-chip-row">
          <button
            type="button"
            class="sl-chip"
            :class="{ active: themeDisplayMode === 'light' }"
            @click="pickThemeMode('light')"
          >
            <SunnyIcon class="sl-chip-ico" />
            浅色
          </button>
          <button
            type="button"
            class="sl-chip"
            :class="{ active: themeDisplayMode === 'dark' }"
            @click="pickThemeMode('dark')"
          >
            <MoonIcon class="sl-chip-ico" />
            深色
          </button>
          <button
            type="button"
            class="sl-chip"
            :class="{ active: themeDisplayMode === 'system' }"
            @click="pickThemeMode('system')"
          >
            <DesktopIcon class="sl-chip-ico" />
            跟随系统
          </button>
        </div>
      </t-card>

      <t-card :bordered="true" class="cardx sl-card">
        <header class="sl-hd">
          <h3 class="sl-title">强调色</h3>
        </header>
        <div class="sl-accent-row">
          <button
            v-for="a in ACCENT_SWATCHES"
            :key="a.id"
            type="button"
            class="sl-swatch"
            :class="{ active: accentHex === a.hex }"
            :title="a.label"
            :style="{ backgroundColor: a.hex }"
            @click="pickAccent(a.hex)"
          />
        </div>
        <p class="sl-foot">当前：{{ ACCENT_SWATCHES.find((x) => x.hex === accentHex)?.label ?? "自定义" }}（{{ accentHex }}）</p>
      </t-card>

      <t-card :bordered="true" class="cardx sl-card">
        <header class="sl-hd">
          <h3 class="sl-title">圆角</h3>
        </header>
        <div class="sl-chip-row">
          <button
            v-for="r in RADIUS_PRESETS"
            :key="r.value"
            type="button"
            class="sl-chip"
            :class="{ active: Math.abs(radiusRem - r.value) < 0.01 }"
            @click="pickRadius(r.value)"
          >
            {{ r.label }}（{{ r.value }}rem）
          </button>
        </div>
      </t-card>

      <t-card :bordered="true" class="cardx sl-card">
        <header class="sl-hd">
          <h3 class="sl-title">显示密度</h3>
        </header>
        <div class="sl-dens-grid">
          <button
            type="button"
            class="sl-dens-card"
            :class="{ active: densityPref === 'cozy' }"
            @click="pickDensity('cozy')"
          >
            <span class="sl-dens-title">舒适</span>
            <span class="sl-dens-desc">默认</span>
          </button>
          <button
            type="button"
            class="sl-dens-card"
            :class="{ active: densityPref === 'compact' }"
            @click="pickDensity('compact')"
          >
            <span class="sl-dens-title">紧凑</span>
            <span class="sl-dens-desc">更紧凑</span>
          </button>
        </div>
      </t-card>
    </div>

    <div v-show="section === 'behavior'" class="panel">
      <t-card :bordered="true" class="cardx sl-card">
        <header class="sl-hd">
          <h3 class="sl-title">仪表盘轮询</h3>
          <p class="sl-desc">仪表盘日志等轮询间隔；0 为暂停。</p>
        </header>
        <div class="sl-chip-row sl-chip-row-wrap">
          <button
            v-for="p in POLL_OPTIONS"
            :key="p.value"
            type="button"
            class="sl-chip"
            :class="{ active: dashPollMs === p.value }"
            @click="pickPoll(p.value)"
          >
            {{ p.label }}
          </button>
        </div>
        <p class="sl-foot">
          当前：{{ dashPollMs === 0 ? "已暂停轮询" : `${dashPollMs} 毫秒` }}
        </p>
      </t-card>
    </div>

    <div
      v-show="section === 'baseline'"
      class="panel"
    >
      <t-card :bordered="true" class="cardx sl-card">
        <header class="sl-hd sl-hd-row">
          <div>
            <h3 class="sl-title">连接状态</h3>
            <p class="sl-desc">本页所连后端的根路径与健康检查。</p>
          </div>
          <t-button class="sl-btn-ghost" size="small" variant="outline" :loading="loading" @click="loadRuntimeMeta">
            刷新
          </t-button>
        </header>
        <t-descriptions :column="1" bordered class="desc">
          <t-descriptions-item label="连通状态">
            <t-tag v-if="healthOk === true" theme="success" variant="light" size="small">正常</t-tag>
            <t-tag v-else-if="healthOk === false" theme="danger" variant="light" size="small">不可用</t-tag>
            <t-tag v-else variant="light" size="small">检查中</t-tag>
          </t-descriptions-item>
          <t-descriptions-item label="控制台根路径"><code>{{ base }}</code></t-descriptions-item>
          <t-descriptions-item label="API 根路径"><code>{{ apiBase }}</code></t-descriptions-item>
          <t-descriptions-item label="健康检查路径"><code>{{ healthPath }}</code></t-descriptions-item>
          <t-descriptions-item label="协议管理入口"><code>{{ protocolHint }}</code></t-descriptions-item>
          <t-descriptions-item label="驱动监听"><code>{{ driverAddr }}</code></t-descriptions-item>
        </t-descriptions>
      </t-card>
    </div>

    <div
      v-show="section === 'ops'"
      class="panel auth-stack"
    >
      <t-card :bordered="true" class="cardx sl-card">
        <header class="sl-hd">
          <h3 class="sl-title">生产部署</h3>
          <p class="sl-desc">静态、HTTPS 与开发代理。</p>
        </header>
        <ul class="list sl-list">
          <li>静态放到 <code class="sl-code">data/pallas_webui/public</code>。</li>
          <li>公网 HTTPS；生产勿开 <code class="sl-code">pallas_webui_dev_mode</code>。</li>
          <li>本地开发：<code class="sl-code">VITE_PROXY_TARGET</code> 指向 Bot。</li>
        </ul>
      </t-card>

      <t-card :bordered="true" class="cardx sl-card">
        <header class="sl-hd">
          <h3 class="sl-title">上线前自检</h3>
        </header>
        <ol class="sl-timeline">
          <li class="sl-timeline-item">
            <p class="tl-p"><code class="sl-code">/pallas/</code>、<code class="sl-code">/pallas/api/health</code> 通。</p>
          </li>
          <li class="sl-timeline-item">
            <p class="tl-p">写接口需登录（否则 401）。</p>
          </li>
          <li class="sl-timeline-item">
            <p class="tl-p"><code class="sl-code">/protocol/console</code> 可达且 token 有效。</p>
          </li>
          <li class="sl-timeline-item">
            <p class="tl-p">HTTPS / 反代就绪。</p>
          </li>
        </ol>
      </t-card>
    </div>
  </PallasSidebarShell>
</template>

<style scoped lang="scss">
.panel {
  width: 100%;
  max-width: none;
}
.cardx {
  border: 1px solid var(--el-border-color-lighter);
}
.sl-card {
  background: var(--el-bg-color);
  box-shadow: none !important;
  border-radius: 12px !important;
  :deep(.t-card__body) {
    padding: 22px 24px 20px;
  }
}
.sl-hd {
  margin-bottom: 18px;
}
.sl-hd-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.sl-link {
  font-size: inherit;
  vertical-align: baseline;
}
.auth-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.api-tok {
  width: 100%;
  max-width: min(32rem, 100%);
}
.sl-btn-primary {
  border-radius: 8px !important;
  padding: 9px 18px !important;
  font-weight: 600 !important;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06) !important;
}
.sl-btn-ghost {
  border-radius: 8px !important;
  font-weight: 550 !important;
  border-color: var(--el-border-color) !important;
  background: transparent !important;
}
.sl-alert {
  border-radius: 8px !important;
}
.desc {
  :deep(.t-descriptions__label) {
    width: 170px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
  }
  :deep(.t-descriptions__content) {
    line-height: 1.6;
  }
}
.sl-timeline {
  margin: 4px 0 0;
  padding: 0 0 0 1.35rem;
  list-style: none;
}
.sl-timeline-item {
  position: relative;
  padding: 0 0 14px 0.35rem;
  border-left: 2px solid color-mix(in srgb, var(--td-brand-color-7) 28%, var(--el-border-color-lighter));
}
.sl-timeline-item:last-child {
  border-left-color: transparent;
  padding-bottom: 0;
}
.sl-timeline-item::before {
  content: "";
  position: absolute;
  left: -6px;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--td-bg-color-container);
  border: 2px solid var(--td-brand-color-7);
  box-sizing: border-box;
}
.tl-p {
  margin: 0 0 4px;
  line-height: 1.65;
  font-size: 0.875rem;
  color: var(--el-text-color-regular);
}
.list.sl-list {
  margin: 0;
  padding-left: 1.15rem;
  line-height: 1.65;
  font-size: 0.875rem;
  color: var(--el-text-color-regular);
  li {
    margin-bottom: 0.45em;
  }
}
.token-save-row {
  margin-top: 14px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.token-save-alert {
  flex: 1;
  min-width: 200px;
}
.token-save-alert :deep(.t-alert__description),
.token-save-alert :deep(.t-alert__message) {
  line-height: 1.35;
  font-size: 0.8125rem;
}
.sl-chip-ico {
  width: 1.1em;
  height: 1.1em;
  flex-shrink: 0;
}
@media (max-width: 768px) {
  .sl-hd-row {
    flex-direction: column;
    align-items: stretch;
  }
  .api-tok {
    max-width: none;
  }
  .desc {
    :deep(.t-descriptions__label) {
      width: 110px;
    }
  }
  .token-save-row {
    align-items: stretch;
    flex-direction: column;
  }
  .token-save-alert {
    width: 100%;
    min-width: 0;
  }
}
.sl-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sl-chip-row-wrap {
  align-items: flex-start;
}
.sl-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color);
  padding: 9px 14px;
  font-size: 0.8125rem;
  font-weight: 550;
  cursor: pointer;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}
.sl-chip.active {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  color: var(--el-color-primary);
}
.sl-accent-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.sl-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--el-border-color);
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.sl-swatch:hover {
  transform: scale(1.06);
}
.sl-swatch.active {
  border-color: var(--el-text-color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-primary) 35%, transparent);
}
.sl-dens-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}
.sl-dens-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
  border-radius: 12px;
  border: 1px solid var(--el-border-color);
  padding: 14px 16px;
  cursor: pointer;
  background: var(--el-bg-color);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.sl-dens-card.active {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}
.sl-dens-title {
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--el-text-color-primary);
}
.sl-dens-desc {
  font-size: 0.6875rem;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
}
</style>
