<script setup lang="ts">
import { fetchPluginConfig, fetchSystem, putPluginConfig } from "@/api/consoleApi";
import { fetchHealth } from "@/api/health";
import { PALLAS_API_TOKEN_KEY } from "@/api/http";
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import { CircleCheck, Connection, Link, Lock } from "@element-plus/icons-vue";
import { computed, onMounted, ref, watch } from "vue";

type Section = "auth" | "baseline" | "deploy" | "checklist";

const section = ref<Section>("auth");
const apiToken = ref("");
const loading = ref(false);
const healthOk = ref<boolean | null>(null);
const driverHost = ref<string>("-");
const driverPort = ref<number | null>(null);

const base = (import.meta.env.BASE_URL as string) || "/pallas/";
const apiBase = `${base.replace(/\/$/, "")}/api`;
const healthPath = `${apiBase}/health`;
const protocolPath = "/protocol/napcat";
const protocolHint = `${protocolPath}（默认，可由 PALLAS_PROTOCOL_WEBUI_PATH 覆盖）`;
const devProxy = "开发模式下，Vite 将 /pallas/api 代理到 VITE_PROXY_TARGET。";

const sectionTitle: Record<Section, string> = {
  auth: "鉴权与 GitHub",
  baseline: "连接基线",
  deploy: "生产部署建议",
  checklist: "上线前检查",
};

const sectionSub: Record<Section, string> = {
  auth: "统一管理控制台写入 Token 与 GitHub Token，降低配置分散带来的维护成本。",
  baseline: "当前控制台约定路径与后端驱动监听信息。",
  deploy: "面向生产环境的发布、反代与访问控制建议。",
  checklist: "发布前做最小闭环自检，降低回滚概率。",
};

const navItems = [
  { index: "auth" as const, label: "鉴权与 GitHub", icon: Lock },
  { index: "baseline" as const, label: "连接基线", icon: Connection },
  { index: "deploy" as const, label: "部署建议", icon: Link },
  { index: "checklist" as const, label: "上线检查", icon: CircleCheck },
];

const driverAddr = computed(() => {
  if (!driverHost.value || driverHost.value === "-" || !driverPort.value) return "-";
  return `${driverHost.value}:${driverPort.value}`;
});

// ── GitHub Token ──────────────────────────────────────────────────────────────
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
  } catch {
    healthOk.value = false;
    driverHost.value = "-";
    driverPort.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (typeof localStorage !== "undefined") {
    apiToken.value = localStorage.getItem(PALLAS_API_TOKEN_KEY) || "";
  }
  void loadRuntimeMeta();
  void loadGithubToken();
});

watch(apiToken, (v) => {
  if (typeof localStorage !== "undefined") {
    const t = (v || "").trim();
    if (t) localStorage.setItem(PALLAS_API_TOKEN_KEY, t);
    else localStorage.removeItem(PALLAS_API_TOKEN_KEY);
  }
});
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

    <div v-show="section === 'auth'" class="panel auth-stack">
      <el-card class="cardx" shadow="hover">
        <h3 class="card-title">写操作 Token（本机）</h3>
        <p class="para">
          该值用于浏览器发起写操作时附带 <code>X-Pallas-Token</code>。只有与后端
          <code>pallas_webui_api_token</code> 一致时，才允许更新 Bot/群 配置。
        </p>
        <el-input
          v-model="apiToken"
          type="password"
          show-password
          clearable
          placeholder="留空表示不附带写 Token（推荐只读场景）"
          class="api-tok"
        />
        <p class="hint">仅保存在当前浏览器的 <code>localStorage</code>，不会上报到服务端。</p>
      </el-card>

      <el-card class="cardx" shadow="hover">
        <div class="row-line">
          <h3 class="card-title">GitHub Personal Access Token</h3>
          <el-button size="small" :loading="githubTokenLoading" @click="loadGithubToken">刷新</el-button>
        </div>
        <p class="para">
          设置后，Bot 调用 GitHub API（检查更新、获取 Release 列表等）时将附带此 Token，
          速率限额从 <strong>60 次/小时</strong> 提升至 <strong>5000 次/小时</strong>。
        </p>
        <el-input
          v-model="githubToken"
          type="password"
          show-password
          clearable
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx（留空则不使用 Token）"
          class="api-tok"
          :disabled="githubTokenLoading"
        />
        <p class="hint">
          在
          <el-link href="https://github.com/settings/tokens" target="_blank" type="primary">
            github.com/settings/tokens
          </el-link>
          生成，只需 <code>public_repo</code> 只读权限（或无权限的 Fine-grained token）。
          保存后需重启 Bot 生效。
        </p>
        <div class="token-save-row">
          <el-button type="primary" :loading="githubTokenSaving" @click="saveGithubToken">保存</el-button>
          <el-alert
            v-if="githubTokenSaveMsg"
            :type="githubTokenSaveMsg.type"
            :title="githubTokenSaveMsg.text"
            show-icon
            :closable="false"
            class="token-save-alert"
          />
        </div>
      </el-card>
    </div>

    <div
      v-show="section === 'baseline'"
      class="panel"
    >
      <el-card class="cardx" shadow="hover">
        <div class="row-line">
          <h3 class="card-title">连接状态</h3>
          <el-button size="small" :loading="loading" @click="loadRuntimeMeta">刷新</el-button>
        </div>
        <el-descriptions :column="1" border class="desc">
          <el-descriptions-item label="Health">
            <el-tag v-if="healthOk === true" type="success" size="small">可访问</el-tag>
            <el-tag v-else-if="healthOk === false" type="danger" size="small">不可访问</el-tag>
            <el-tag v-else size="small">检查中</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="WebUI 基址"><code>{{ base }}</code></el-descriptions-item>
          <el-descriptions-item label="API 基址"><code>{{ apiBase }}</code></el-descriptions-item>
          <el-descriptions-item label="健康检查"><code>{{ healthPath }}</code></el-descriptions-item>
          <el-descriptions-item label="协议管理入口"><code>{{ protocolHint }}</code></el-descriptions-item>
          <el-descriptions-item label="驱动监听"><code>{{ driverAddr }}</code></el-descriptions-item>
        </el-descriptions>
      </el-card>
    </div>


    <div
      v-show="section === 'deploy'"
      class="panel"
    >
      <el-card class="cardx" shadow="hover">
        <h3 class="card-title">生产部署建议</h3>
        <ul class="list">
          <li>静态产物统一由 Bot 提供：将前端 <code>dist</code> 发布到 <code>data/pallas_webui/public</code>。</li>
          <li>反向代理只暴露业务入口，建议限制来源与速率，避免直接裸露管理面。</li>
          <li>公网环境必须启用 HTTPS，并结合 Token/网关策略限制写操作能力。</li>
          <li>开发联调使用 <code>VITE_PROXY_TARGET</code>，避免跨域与错误端口导致误判。</li>
        </ul>
        <p class="hint">{{ devProxy }}</p>
      </el-card>
    </div>

    <div
      v-show="section === 'checklist'"
      class="panel"
    >
      <el-card class="cardx" shadow="hover">
        <h3 class="card-title">上线前最小闭环</h3>
        <el-timeline class="timeline-dense">
          <el-timeline-item type="primary" hollow>
            <p class="tl-p">`/pallas/` 与 <code>/pallas/api/health</code> 均可访问。</p>
          </el-timeline-item>
          <el-timeline-item type="primary" hollow>
            <p class="tl-p">写 Token 校验符合预期：错误值 401，正确值可写。</p>
          </el-timeline-item>
          <el-timeline-item type="primary" hollow>
            <p class="tl-p">协议管理页可达（默认 <code>/protocol/napcat</code>），且鉴权有效。</p>
          </el-timeline-item>
          <el-timeline-item type="primary" hollow>
            <p class="tl-p">反代与 HTTPS 生效，管理面不直接暴露到公共网络。</p>
          </el-timeline-item>
        </el-timeline>
      </el-card>
    </div>
  </PallasSidebarShell>
</template>

<style scoped lang="scss">
.main-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.02em;
}
.main-sub {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}
.panel {
  width: 100%;
  max-width: none;
}
.cardx {
  border: 1px solid rgba(22, 100, 196, 0.12);
}
.auth-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}
.para {
  margin: 0 0 10px;
  color: var(--el-text-color-regular);
  line-height: 1.75;
}
.hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.api-tok {
  width: 100%;
  max-width: 520px;
}
.desc {
  :deep(.el-descriptions__label) {
    width: 170px;
  }
  :deep(.el-descriptions__cell) {
    line-height: 1.65;
  }
}
.timeline-dense {
  :deep(.el-timeline-item__content) {
    line-height: 1.5;
  }
  .tl-p {
    margin: 0 0 4px;
    line-height: 1.75;
  }
  :deep(.el-timeline-item__node) {
    top: 6px;
  }
  :deep(.el-timeline-item__tail) {
    top: 10px;
  }
}
.list {
  margin: 0;
  padding-left: 18px;
  line-height: 1.75;
  color: var(--el-text-color-regular);
}
.row-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
code {
  font-size: 0.9em;
}
.token-save-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.token-save-alert {
  flex: 1;
}
.token-save-alert :deep(.el-alert__content) {
  line-height: 1.35;
}
@media (max-width: 768px) {
  .main-title {
    font-size: 1.1rem;
  }
  .main-sub {
    margin-top: 6px;
    font-size: 13px;
  }
  .row-line {
    align-items: flex-start;
    flex-direction: column;
  }
  .api-tok {
    max-width: none;
  }
  .desc {
    :deep(.el-descriptions__label) {
      width: 110px;
    }
  }
  .list {
    padding-left: 16px;
  }
  .token-save-row {
    align-items: stretch;
    flex-direction: column;
  }
  .token-save-alert {
    width: 100%;
  }
}
</style>
