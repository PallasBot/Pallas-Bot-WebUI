<script setup lang="ts">
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import { PALLAS_API_TOKEN_KEY } from "@/api/http";
import { isDark, setTheme } from "@/utils/theme";
import { Brush, CircleCheck, Link, List } from "@element-plus/icons-vue";
import { onMounted, ref, watch } from "vue";

type Section = "appearance" | "deploy" | "env" | "checklist";

const base = (import.meta.env.BASE_URL as string) || "/pallas/";
const api = `${base.replace(/\/$/, "")}/api`;
const devProxy = "Vite 将 /pallas/api 转发到 VITE_PROXY_TARGET，默认 http://127.0.0.1:8088";
const defaultPort = 8088;

const note = ref("");
const apiToken = ref("");
const section = ref<Section>("appearance");

const sectionTitle: Record<Section, string> = {
  appearance: "外观与本地",
  deploy: "与 Bot 进程对接",
  env: "环境变量速查",
  checklist: "发布前自测",
};

const navItems = [
  { index: "appearance" as const, label: "外观与本地", icon: Brush },
  { index: "deploy" as const, label: "对接与路径", icon: Link },
  { index: "env" as const, label: "环境变量", icon: List },
  { index: "checklist" as const, label: "自测清单", icon: CircleCheck },
];

onMounted(() => {
  if (typeof localStorage !== "undefined") {
    note.value = localStorage.getItem("pallas-webui-note") || "";
    apiToken.value = localStorage.getItem(PALLAS_API_TOKEN_KEY) || "";
  }
});

watch(note, (v) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("pallas-webui-note", v);
  }
});

watch(apiToken, (v) => {
  if (typeof localStorage !== "undefined") {
    const t = (v || "").trim();
    if (t) {
      localStorage.setItem(PALLAS_API_TOKEN_KEY, t);
    } else {
      localStorage.removeItem(PALLAS_API_TOKEN_KEY);
    }
  }
});

const envTable = [
  { key: "HOST", tip: "NoneBot 绑定地址，常为 0.0.0.0" },
  { key: "PORT", tip: "HTTP 端口，需与 Vite 代理目标一致" },
  { key: "pallas_webui / pallas_webui_api_token", tip: "本控制台与 Bot/群 配置写操作鉴权；非空时浏览器需在设置中填同值" },
  { key: "pallas_protocol", tip: "协议端（NapCat 等）托管页、pallas_protocol_token 等与 PALLAS_PROTOCOL_* 配置相关" },
  { key: "VITE_PROXY_TARGET", tip: "仅 WebUI 开发：指向 Bot 进程 http(s) 根地址" },
];
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
      <p
        v-if="s === 'appearance'"
        class="main-sub"
      >
        仅影响本机浏览器，不上传。
      </p>
      <p
        v-else-if="s === 'deploy'"
        class="main-sub"
      >
        与 Pallas-Bot 的 HTTP 根路径、健康检查与代理说明。
      </p>
      <p
        v-else-if="s === 'env'"
        class="main-sub"
      >
        以仓库 <code>.env</code> 与实际部署为准；本表为联调时高频项速查。
      </p>
      <p
        v-else
        class="main-sub"
      >
        上线前在目标环境过一遍，避免反代/端口/token 类问题。
      </p>
    </template>

    <div
      v-show="section === 'appearance'"
      class="panel"
    >
      <el-form
        label-position="top"
        class="dense-form"
        @submit.prevent
      >
        <el-form-item label="主题色">
          <p class="form-lead">默认蓝白；可开深色（仍使用品牌蓝作为主操作色）。</p>
        </el-form-item>
        <el-form-item label="深色模式">
          <el-switch
            :model-value="isDark"
            @update:model-value="(v: string | number | boolean) => setTheme(!!v)"
          />
        </el-form-item>
        <el-form-item label="本地备注（仅本机）">
          <p class="form-lead">部署 IP、对外域名、Nginx 路径、团队约定端口等；仅存浏览器。</p>
          <el-input
            v-model="note"
            type="textarea"
            :rows="6"
            placeholder="多行记录便于日后查阅，不上传"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="Pallas API 写 Token（可选）">
          <p class="form-lead">与 Bot 侧 pallas_webui_api_token 一致时，方可 PUT 改 Bot/群 配置。</p>
          <el-input
            v-model="apiToken"
            type="password"
            show-password
            clearable
            placeholder="不填 = 只读；填错会 401"
            class="api-tok"
          />
          <div class="form-hint">
            存 <code>localStorage</code>，请求头 <code>X-Pallas-Token</code>；留空会清除已存值。
          </div>
        </el-form-item>
      </el-form>
    </div>

    <div
      v-show="section === 'deploy'"
      class="panel"
    >
      <p class="para">生产：将 <code>dist</code> 全量复制到 Pallas
        <code>data/pallas_webui/public</code>，由 Bot 进程提供 <code>/pallas</code> 静态与
        <code>/pallas/api</code> JSON。</p>
      <el-descriptions
        :column="1"
        border
        class="desc"
      >
        <el-descriptions-item label="Vite base（构建）">
          <code>{{ base }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="健康检查">
          <code>{{ api }}/health</code>
        </el-descriptions-item>
        <el-descriptions-item label="开发代理">
          <span class="desc-sm">{{ devProxy }}<br>默认
            <code>127.0.0.1:{{ defaultPort }}</code> 需与 <code>.env</code> 中
            <code>PORT</code> 一致。</span>
        </el-descriptions-item>
        <el-descriptions-item label="协议端同机路径">
          <code>/protocol/napcat</code>（默认；可由 pallas_protocol_webui_path 覆盖；不经本 dist）
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <div
      v-show="section === 'env'"
      class="panel"
    >
      <p class="para">下列为常见联调项；以实际环境为准。</p>
      <el-table
        :data="envTable"
        class="env-table"
        size="default"
        border
        stripe
      >
        <el-table-column
          label="名称"
          prop="key"
          min-width="200"
        >
          <template #default="{ row }">
            <code class="k">{{ row.key }}</code>
          </template>
        </el-table-column>
        <el-table-column
          label="作用（简述）"
          prop="tip"
          min-width="300"
        />
      </el-table>
    </div>

    <div
      v-show="section === 'checklist'"
      class="panel"
    >
      <el-timeline class="timeline-dense">
        <el-timeline-item
          type="primary"
          hollow
        >
          <p class="tl-p">Bot 能启动、无 pallas_webui 导入错误。</p>
        </el-timeline-item>
        <el-timeline-item
          type="primary"
          hollow
        >
          <p class="tl-p">浏览器能打开 <code>&lt;你的地址&gt;{{ base }}</code>，且
            <code>…/pallas/api/health</code> 返回 JSON。</p>
        </el-timeline-item>
        <el-timeline-item
          type="primary"
          hollow
        >
          <p class="tl-p">使用协议端时：<code>&lt;同 host:port&gt;/protocol/napcat</code>（或实例返回的
            <code>webui_path</code>）可访问，<code>pallas_protocol_token</code> 能过鉴权。</p>
        </el-timeline-item>
        <el-timeline-item
          type="primary"
          hollow
        >
          <p class="tl-p">公网建议再配反代、HTTPS 与访控，勿裸奔 token。</p>
        </el-timeline-item>
      </el-timeline>
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
  code {
    font-size: 0.9em;
  }
}
.panel {
  line-height: 1.8;
  font-size: 14px;
  color: var(--el-text-color-primary);
  max-width: 920px;
}
.para {
  margin: 0 0 16px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
  code {
    font-size: 0.9em;
  }
}
.form-lead {
  margin: 0 0 10px;
  line-height: 1.75;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}
.form-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  code {
    font-size: 0.9em;
  }
}
.dense-form {
  :deep(.el-form-item) {
    margin-bottom: 22px;
  }
  :deep(.el-form-item__label) {
    font-weight: 600;
    font-size: 14px;
  }
}
.api-tok {
  width: 100%;
  max-width: 480px;
}
.desc {
  :deep(.el-descriptions__label) {
    width: 200px;
  }
  :deep(.el-descriptions__cell) {
    padding: 12px 14px;
    line-height: 1.7;
  }
}
.desc-sm {
  font-size: 13px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
  code {
    font-size: 0.9em;
  }
}
.k {
  font-size: 0.9em;
  word-break: break-all;
}
.env-table {
  width: 100%;
  :deep(.cell) {
    line-height: 1.6;
  }
  --el-table-border-color: rgba(22, 100, 196, 0.1);
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
</style>
