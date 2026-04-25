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
import { Link, Monitor, User } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
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
  { index: "connection" as const, label: "连接配置", icon: Link },
  { index: "check" as const, label: "连接检测", icon: Monitor },
  { index: "ncm" as const, label: "网易云登录", icon: User },
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
    ElMessage.error(e instanceof Error ? e.message : "AI 拓展配置加载失败");
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    form.value = await putAiExtensionConfig(form.value);
    ElMessage.success("AI 连接配置已保存");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

async function testConnection() {
  testing.value = true;
  testResult.value = null;
  try {
    testResult.value = await postAiExtensionTest();
    if (testResult.value.ok) ElMessage.success("AI 服务连接正常");
    else ElMessage.warning("AI 服务不可达或返回异常");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "检测失败");
  } finally {
    testing.value = false;
  }
}

async function loadNcmStatus() {
  ncmLoading.value = true;
  try {
    ncmResult.value = await fetchAiNcmStatus();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "获取网易云登录状态失败");
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
    ElMessage.error(e instanceof Error ? e.message : "AI 日志读取失败");
  } finally {
    aiLogLoading.value = false;
  }
}

async function sendNcmSms() {
  if (!ncmPhone.value.trim()) {
    ElMessage.warning("请先填写手机号");
    return;
  }
  ncmActionLoading.value = true;
  try {
    ncmResult.value = await postAiNcmSendSms({
      phone: ncmPhone.value.trim(),
      ctcode: ncmCtcode.value,
    });
    ElMessage.success(ncmResult.value.ok ? "验证码已请求" : "验证码请求失败");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "验证码请求失败");
  } finally {
    ncmActionLoading.value = false;
  }
}

async function verifyNcmSms() {
  if (!ncmPhone.value.trim() || !ncmCaptcha.value.trim()) {
    ElMessage.warning("请填写手机号与验证码");
    return;
  }
  ncmActionLoading.value = true;
  try {
    ncmResult.value = await postAiNcmVerifySms({
      phone: ncmPhone.value.trim(),
      captcha: ncmCaptcha.value.trim(),
      ctcode: ncmCtcode.value,
    });
    ElMessage.success(ncmResult.value.ok ? "网易云登录请求已提交" : "网易云登录失败");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "网易云登录失败");
  } finally {
    ncmActionLoading.value = false;
  }
}

async function logoutNcm() {
  ncmActionLoading.value = true;
  try {
    ncmResult.value = await postAiNcmLogout();
    ElMessage.success(ncmResult.value.ok ? "已请求登出" : "登出失败");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "登出失败");
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
    aside-title="AI拓展"
    menu-aria-label="AI拓展分节"
    :nav-items="navItems"
  >
    <template #header>
      <h1 class="main-title">AI拓展</h1>
      <p class="main-sub">参考 Pallas-Bot-AI 的部署方式，管理 AI 服务连接地址并做连通性检测。</p>
    </template>

    <div v-show="section === 'connection'" class="panel">
      <el-card v-loading="loading" class="c" shadow="hover">
        <el-form label-width="120px">
          <el-form-item label="服务地址">
            <el-input v-model="form.base_url" placeholder="例如 http://127.0.0.1:9099" />
          </el-form-item>
          <el-form-item label="API 前缀">
            <el-input v-model="form.api_prefix" placeholder="/api" />
          </el-form-item>
          <el-form-item label="鉴权 Token">
            <el-input v-model="form.token" type="password" show-password clearable placeholder="可选" />
          </el-form-item>
          <el-form-item label="健康探测路径">
            <el-input
              :model-value="form.health_paths.join(', ')"
              placeholder="/health, /api/health"
              @update:model-value="(v: string | number) => form.health_paths = String(v).split(',').map((x) => x.trim()).filter(Boolean)"
            />
          </el-form-item>
          <el-form-item label="Uvicorn 日志文件">
            <el-input v-model="form.uvicorn_log_file" placeholder="例如 ../Pallas-Bot-AI/logs/app.log" />
          </el-form-item>
          <el-form-item label="Celery 日志文件">
            <el-input v-model="form.celery_log_file" placeholder="例如 ../Pallas-Bot-AI/logs/app.log" />
          </el-form-item>
          <el-form-item label="超时（秒）">
            <el-input-number v-model="form.timeout_sec" :min="2" :max="30" />
          </el-form-item>
        </el-form>
        <div class="ft">
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
          <el-button plain :loading="loading" @click="load">重新加载</el-button>
        </div>
      </el-card>
    </div>

    <div v-show="section === 'check'" class="panel">
      <el-card class="c" shadow="hover">
        <div class="ft">
          <el-button type="primary" :loading="testing" @click="testConnection">检测连接</el-button>
        </div>
        <el-empty v-if="!testResult" description="点击“检测连接”后显示结果" :image-size="72" />
        <el-descriptions v-else :column="1" border class="desc">
          <el-descriptions-item label="检测结果">
            <el-tag :type="testResult.ok ? 'success' : 'danger'">{{ testResult.ok ? "可用" : "不可用" }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="健康检查 URL">{{ testResult.health_url }}</el-descriptions-item>
          <el-descriptions-item label="状态码">{{ testResult.status_code ?? "—" }}</el-descriptions-item>
          <el-descriptions-item label="探测路径">
            <div>{{ (testResult.tried_urls || []).join(" , ") || "—" }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="错误信息">{{ testResult.error || "—" }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
      <el-card class="c demo-card" shadow="hover">
        <template #header>
          <div class="log-hd">
            <span>AI 日志（Uvicorn / Celery）</span>
            <el-button type="primary" size="small" :loading="aiLogLoading" @click="loadAiLogs">刷新</el-button>
          </div>
        </template>
        <el-row :gutter="10">
          <el-col :xs="24" :md="12">
            <el-text size="small" type="info">Uvicorn：{{ aiUv?.path || "—" }}</el-text>
            <pre class="json-box">{{ (aiUv?.lines || []).join('\n') || aiUv?.error || "（暂无输出）" }}</pre>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-text size="small" type="info">Celery：{{ aiCel?.path || "—" }}</el-text>
            <pre class="json-box">{{ (aiCel?.lines || []).join('\n') || aiCel?.error || "（暂无输出）" }}</pre>
          </el-col>
        </el-row>
      </el-card>
    </div>

    <div v-show="section === 'ncm'" class="panel">
      <el-card class="c" shadow="hover">
        <el-form label-width="120px">
          <el-form-item label="手机号">
            <el-input v-model="ncmPhone" placeholder="例如 13800138000" />
          </el-form-item>
          <el-form-item label="国家码">
            <el-input-number v-model="ncmCtcode" :min="1" :max="999" />
          </el-form-item>
          <el-form-item label="验证码">
            <el-input v-model="ncmCaptcha" placeholder="短信验证码" />
          </el-form-item>
        </el-form>
        <div class="ft">
          <el-button plain :loading="ncmLoading" @click="loadNcmStatus">刷新状态</el-button>
          <el-button type="primary" :loading="ncmActionLoading" @click="sendNcmSms">发送验证码</el-button>
          <el-button type="success" :loading="ncmActionLoading" @click="verifyNcmSms">验证码登录</el-button>
          <el-button type="danger" plain :loading="ncmActionLoading" @click="logoutNcm">登出</el-button>
        </div>
        <el-descriptions v-if="ncmResult" :column="1" border class="desc">
          <el-descriptions-item label="代理结果">
            <el-tag :type="ncmResult.ok ? 'success' : 'danger'">{{ ncmResult.ok ? "成功" : "失败" }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态码">{{ ncmResult.status_code ?? "—" }}</el-descriptions-item>
          <el-descriptions-item label="请求地址">{{ ncmResult.url }}</el-descriptions-item>
          <el-descriptions-item label="返回数据">
            <pre class="json-box">{{ JSON.stringify(ncmResult.data, null, 2) }}</pre>
          </el-descriptions-item>
          <el-descriptions-item label="错误信息">{{ ncmResult.error || "—" }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card class="c demo-card" shadow="hover">
        <template #header>接口示例（调试用）</template>
        <pre class="json-box">curl -X GET "$BASE/pallas/api/ai-extension/ncm/status"</pre>
        <pre class="json-box">curl -X POST "$BASE/pallas/api/ai-extension/ncm/send-sms" -H "Content-Type: application/json" -d "{\"phone\":\"13800138000\",\"ctcode\":86}"</pre>
        <pre class="json-box">curl -X POST "$BASE/pallas/api/ai-extension/ncm/verify-sms" -H "Content-Type: application/json" -d "{\"phone\":\"13800138000\",\"captcha\":\"1234\",\"ctcode\":86}"</pre>
        <pre class="json-box">curl -X POST "$BASE/pallas/api/ai-extension/ncm/logout"</pre>
      </el-card>
    </div>
  </PallasSidebarShell>
</template>

<style scoped lang="scss">
.main-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}
.main-sub {
  margin: 10px 0 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
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
</style>
