<script setup lang="ts">
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import {
  fetchAiExtensionConfig,
  fetchAiExtensionLogs,
  fetchAiNcmStatus,
  postAiExtensionTest,
  postAiNcmLogout,
  postAiNcmSendSms,
  postAiNcmVerifySms,
  putAiExtensionConfig,
} from "@/api/consoleApi";
import type { AiExtensionConfig, AiExtensionLogsData, AiExtensionTestData, AiProxyResult } from "@/api/pallasTypes";
import { DesktopIcon, LinkIcon, UserIcon } from "tdesign-icons-vue-next";
import { MessagePlugin } from "tdesign-vue-next";
import { onMounted, ref } from "vue";

type Section = "connection" | "check" | "ncm";
const section = ref<Section>("connection");
const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const testResult = ref<AiExtensionTestData | null>(null);
const ncmLoading = ref(false);
const ncmActionLoading = ref(false);
const ncmResult = ref<AiProxyResult | null>(null);
const ncmPhone = ref("");
const ncmCaptcha = ref("");
const ncmCtcode = ref(86);
const aiLogLoading = ref(false);
const aiUv = ref<AiExtensionLogsData | null>(null);
const aiCel = ref<AiExtensionLogsData | null>(null);

const navItems = [
  { index: "connection" as const, label: "连接配置", icon: LinkIcon },
  { index: "check" as const, label: "连接检测", icon: DesktopIcon },
  { index: "ncm" as const, label: "网易云登录", icon: UserIcon },
];

const form = ref<AiExtensionConfig>({
  base_url: "http://127.0.0.1:9099",
  api_prefix: "/api",
  token: "",
  health_paths: ["/health", "/api/health"],
  uvicorn_log_file: "",
  celery_log_file: "",
  timeout_sec: 8,
});

async function load() {
  loading.value = true;
  try {
    form.value = await fetchAiExtensionConfig();
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : "AI 扩展配置加载失败");
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    form.value = await putAiExtensionConfig(form.value);
    MessagePlugin.success("AI 连接配置已保存");
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

async function testConnection() {
  testing.value = true;
  testResult.value = null;
  try {
    testResult.value = await postAiExtensionTest();
    if (testResult.value.ok) MessagePlugin.success("AI 服务连接正常");
    else MessagePlugin.warning("AI 服务不可达或返回异常");
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : "检测失败");
  } finally {
    testing.value = false;
  }
}

async function loadNcmStatus() {
  ncmLoading.value = true;
  try {
    ncmResult.value = await fetchAiNcmStatus();
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : "获取网易云登录状态失败");
  } finally {
    ncmLoading.value = false;
  }
}

async function loadAiLogs() {
  aiLogLoading.value = true;
  try {
    const [u, c] = await Promise.all([fetchAiExtensionLogs("uvicorn", 160), fetchAiExtensionLogs("celery", 160)]);
    aiUv.value = u;
    aiCel.value = c;
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : "AI 日志读取失败");
  } finally {
    aiLogLoading.value = false;
  }
}

async function sendNcmSms() {
  if (!ncmPhone.value.trim()) {
    MessagePlugin.warning("请先填写手机号");
    return;
  }
  ncmActionLoading.value = true;
  try {
    ncmResult.value = await postAiNcmSendSms({
      phone: ncmPhone.value.trim(),
      ctcode: ncmCtcode.value,
    });
    MessagePlugin.success(ncmResult.value.ok ? "验证码已请求" : "验证码请求失败");
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : "验证码请求失败");
  } finally {
    ncmActionLoading.value = false;
  }
}

async function verifyNcmSms() {
  if (!ncmPhone.value.trim() || !ncmCaptcha.value.trim()) {
    MessagePlugin.warning("请填写手机号与验证码");
    return;
  }
  ncmActionLoading.value = true;
  try {
    ncmResult.value = await postAiNcmVerifySms({
      phone: ncmPhone.value.trim(),
      captcha: ncmCaptcha.value.trim(),
      ctcode: ncmCtcode.value,
    });
    MessagePlugin.success(ncmResult.value.ok ? "网易云登录请求已提交" : "网易云登录失败");
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : "网易云登录失败");
  } finally {
    ncmActionLoading.value = false;
  }
}

async function logoutNcm() {
  ncmActionLoading.value = true;
  try {
    ncmResult.value = await postAiNcmLogout();
    MessagePlugin.success(ncmResult.value.ok ? "已请求登出" : "登出失败");
  } catch (e) {
    MessagePlugin.error(e instanceof Error ? e.message : "登出失败");
  } finally {
    ncmActionLoading.value = false;
  }
}

onMounted(() => {
  void load();
  void loadNcmStatus();
  void loadAiLogs();
});
</script>

<template>
  <PallasSidebarShell
    v-model="section"
    aside-title="AI 扩展"
    menu-aria-label="AI 扩展分节"
    :nav-items="navItems"
  >
    <template #header>
      <h1 class="main-title">AI 扩展</h1>
      <p class="main-sub">参考 Pallas-Bot-AI 的部署方式，管理 AI 服务连接地址并做连通性检测。</p>
    </template>

    <div v-show="section === 'connection'" class="panel">
      <t-card v-loading="loading" class="c" bordered hover-shadow>
        <t-form :data="form" label-width="120px">
          <t-form-item label="服务地址" name="base_url">
            <t-input v-model="form.base_url" placeholder="例如 http://127.0.0.1:9099" />
          </t-form-item>
          <t-form-item label="API 前缀" name="api_prefix">
            <t-input v-model="form.api_prefix" placeholder="/api" />
          </t-form-item>
          <t-form-item label="鉴权 Token" name="token">
            <t-input v-model="form.token" type="password" placeholder="可选" clearable />
          </t-form-item>
          <t-form-item label="健康探测路径" name="health_paths">
            <t-input
              :model-value="form.health_paths.join(', ')"
              placeholder="/health, /api/health"
              @update:model-value="(v: string) => (form.health_paths = v.split(',').map((x) => x.trim()).filter(Boolean))"
            />
          </t-form-item>
          <t-form-item label="Uvicorn 日志文件" name="uvicorn_log_file">
            <t-input v-model="form.uvicorn_log_file" placeholder="例如 ../Pallas-Bot-AI/logs/app.log" />
          </t-form-item>
          <t-form-item label="Celery 日志文件" name="celery_log_file">
            <t-input v-model="form.celery_log_file" placeholder="例如 ../Pallas-Bot-AI/logs/app.log" />
          </t-form-item>
          <t-form-item label="超时（秒）" name="timeout_sec">
            <t-input-number v-model="form.timeout_sec" :min="2" :max="30" />
          </t-form-item>
        </t-form>
        <div class="ft">
          <t-button theme="primary" :loading="saving" @click="save">保存</t-button>
          <t-button variant="outline" :loading="loading" @click="load">重新加载</t-button>
        </div>
      </t-card>
    </div>

    <div v-show="section === 'check'" class="panel">
      <t-card class="c" bordered hover-shadow>
        <div class="ft">
          <t-button theme="primary" :loading="testing" @click="testConnection">检测连接</t-button>
        </div>
        <t-empty v-if="!testResult" description="点击「检测连接」后显示结果" />
        <t-descriptions v-else :column="1" bordered class="desc">
          <t-descriptions-item label="检测结果">
            <t-tag :theme="testResult.ok ? 'success' : 'danger'">{{ testResult.ok ? "可用" : "不可用" }}</t-tag>
          </t-descriptions-item>
          <t-descriptions-item label="健康探测地址">{{ testResult.health_url }}</t-descriptions-item>
          <t-descriptions-item label="状态码">{{ testResult.status_code ?? "—" }}</t-descriptions-item>
          <t-descriptions-item label="探测路径">
            <div>{{ (testResult.tried_urls || []).join(" , ") || "—" }}</div>
          </t-descriptions-item>
          <t-descriptions-item label="错误信息">{{ testResult.error || "—" }}</t-descriptions-item>
        </t-descriptions>
      </t-card>
      <t-card class="c demo-card" bordered hover-shadow>
        <template #header>
          <div class="log-hd">
            <span>AI 日志（Uvicorn / Celery）</span>
            <t-button theme="primary" size="small" :loading="aiLogLoading" @click="loadAiLogs">刷新</t-button>
          </div>
        </template>
        <t-row :gutter="10">
          <t-col :xs="24" :md="12">
            <span class="txt-muted">Uvicorn：{{ aiUv?.path || "—" }}</span>
            <pre class="json-box">{{ (aiUv?.lines || []).join('\n') || aiUv?.error || "（暂无输出）" }}</pre>
          </t-col>
          <t-col :xs="24" :md="12">
            <span class="txt-muted">Celery：{{ aiCel?.path || "—" }}</span>
            <pre class="json-box">{{ (aiCel?.lines || []).join('\n') || aiCel?.error || "（暂无输出）" }}</pre>
          </t-col>
        </t-row>
      </t-card>
    </div>

    <div v-show="section === 'ncm'" class="panel">
      <t-card class="c" bordered hover-shadow>
        <t-form :data="{}" label-width="120px">
          <t-form-item label="手机号">
            <t-input v-model="ncmPhone" placeholder="例如 13800138000" />
          </t-form-item>
          <t-form-item label="国家码">
            <t-input-number v-model="ncmCtcode" :min="1" :max="999" />
          </t-form-item>
          <t-form-item label="验证码">
            <t-input v-model="ncmCaptcha" placeholder="短信验证码" />
          </t-form-item>
        </t-form>
        <div class="ft">
          <t-button variant="outline" :loading="ncmLoading" @click="loadNcmStatus">刷新状态</t-button>
          <t-button theme="primary" :loading="ncmActionLoading" @click="sendNcmSms">发送验证码</t-button>
          <t-button theme="success" :loading="ncmActionLoading" @click="verifyNcmSms">验证码登录</t-button>
          <t-button theme="danger" variant="outline" :loading="ncmActionLoading" @click="logoutNcm">登出</t-button>
        </div>
        <t-descriptions v-if="ncmResult" :column="1" bordered class="desc">
          <t-descriptions-item label="代理结果">
            <t-tag :theme="ncmResult.ok ? 'success' : 'danger'">{{ ncmResult.ok ? "成功" : "失败" }}</t-tag>
          </t-descriptions-item>
          <t-descriptions-item label="状态码">{{ ncmResult.status_code ?? "—" }}</t-descriptions-item>
          <t-descriptions-item label="请求地址">{{ ncmResult.url }}</t-descriptions-item>
          <t-descriptions-item label="返回数据">
            <pre class="json-box">{{ JSON.stringify(ncmResult.data, null, 2) }}</pre>
          </t-descriptions-item>
          <t-descriptions-item label="错误信息">{{ ncmResult.error || "—" }}</t-descriptions-item>
        </t-descriptions>
      </t-card>

      <t-card class="c demo-card" bordered hover-shadow>
        <template #header>接口示例（调试用）</template>
        <pre class="json-box">curl -X GET "$BASE/pallas/api/ai-extension/ncm/status"</pre>
        <pre class="json-box">curl -X POST "$BASE/pallas/api/ai-extension/ncm/send-sms" -H "Content-Type: application/json" -d "{\"phone\":\"13800138000\",\"ctcode\":86}"</pre>
        <pre class="json-box">curl -X POST "$BASE/pallas/api/ai-extension/ncm/verify-sms" -H "Content-Type: application/json" -d "{\"phone\":\"13800138000\",\"captcha\":\"1234\",\"ctcode\":86}"</pre>
        <pre class="json-box">curl -X POST "$BASE/pallas/api/ai-extension/ncm/logout"</pre>
      </t-card>
    </div>
  </PallasSidebarShell>
</template>

<style scoped lang="scss">
.panel {
  width: 100%;
  max-width: none;
}
.c {
  border: 1px solid rgba(22, 100, 196, 0.1);
}
.ft {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.desc {
  margin-top: 12px;
}
.txt-muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: block;
  margin-bottom: 4px;
}
.json-box {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.5;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
}
.demo-card {
  margin-top: 12px;
}
.log-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
@media (max-width: 768px) {
  .log-hd {
    align-items: flex-start;
    flex-direction: column;
  }
  .ft {
    align-items: stretch;
    flex-direction: column;
  }
  .ft :deep(.t-button) {
    margin-left: 0;
    width: 100%;
  }
  .panel :deep(.t-form__label) {
    width: auto !important;
  }
  .panel :deep(.t-input-number) {
    width: 100%;
  }
}
</style>
