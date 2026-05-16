<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
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
import type { AiExtensionConfig, AiProxyResult } from "@/api/pallasTypes";
import ConsolePagerBar from "@/components/ConsolePagerBar.vue";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { slicePage } from "@/utils/paginate";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { pushConsoleToast } from "@/utils/consoleToast";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const saving = ref(false);
const testOut = ref("");
const logKind = ref<"uvicorn" | "celery">("uvicorn");
const logOut = ref("");
const logErr = ref("");

const baseScheme = ref<"http" | "https">("http");
const baseHostPort = ref("127.0.0.1:9099");
const apiPrefix = ref("/api");
const token = ref("");
const healthPathsText = ref("/health\n/api/health");
const uvicornLogFile = ref("");
const celeryLogFile = ref("");
const timeoutSec = ref(8);

const ncmPhone = ref("");
const ncmCtcode = ref(86);
const ncmCaptcha = ref("");
const ncmStatus = ref<AiProxyResult | null>(null);
const ncmBusy = ref(false);
const ncmLastNote = ref("");

const tablePageSize = computed({
  get: () => Math.min(80, Math.max(4, consolePrefs.tablePageSize ?? 12)),
  set(v: number) {
    const n = Math.min(80, Math.max(4, Math.floor(Number(v)) || 12));
    if (n !== consolePrefs.tablePageSize) setConsolePrefs({ tablePageSize: n });
  },
});

const ncmPayload = computed<Record<string, unknown>>(() => {
  const d = ncmStatus.value?.data;
  if (d && typeof d === "object" && !Array.isArray(d)) return d as Record<string, unknown>;
  return {};
});

const ncmLoggedIn = computed(() => {
  const p = ncmPayload.value;
  return Boolean(p.success) && (typeof p.session === "string" ? p.session.length > 0 : Boolean(p.session));
});

const ncmStatusMessage = computed(() => {
  const p = ncmPayload.value;
  const m = p.message;
  return typeof m === "string" ? m : "";
});

const ncmExtraLine = computed(() => {
  const m = ncmStatusMessage.value.trim();
  if (!m) return "";
  if (ncmLoggedIn.value && /已登录|登录成功|logged in|login ok/i.test(m)) return "";
  return m;
});

const ncmRawPage = ref(1);
const ncmRawLines = computed(() => {
  if (!ncmStatus.value) return [] as string[];
  return JSON.stringify(ncmStatus.value, null, 2).split("\n");
});
const ncmRawSlice = computed(() => slicePage(ncmRawLines.value, ncmRawPage.value, tablePageSize.value).join("\n"));

watch(ncmStatus, () => {
  ncmRawPage.value = 1;
});

watch(
  () => consolePrefs.tablePageSize,
  () => {
    ncmRawPage.value = 1;
  },
);

function parseBaseUrlParts(raw: string): { scheme: "http" | "https"; hostPort: string } {
  const s = (raw || "").trim();
  const m = s.match(/^(https?):\/\/([^/?#]+)/i);
  if (m) {
    const scheme = m[1].toLowerCase() === "https" ? "https" : "http";
    return { scheme, hostPort: m[2] };
  }
  const t = s.replace(/\/+$/, "");
  if (t && !/\s/.test(t)) {
    const hostPart = t.split("/")[0] ?? "";
    if (hostPart) return { scheme: "http", hostPort: hostPart };
  }
  return { scheme: "http", hostPort: "127.0.0.1:9099" };
}

function buildBaseUrl(scheme: "http" | "https", hostPort: string): string {
  const hp = hostPort.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!hp) return `${scheme}://127.0.0.1:9099`;
  return `${scheme}://${hp}`;
}

function hydrateFromConfig(c: AiExtensionConfig): void {
  const { scheme, hostPort } = parseBaseUrlParts(c.base_url);
  baseScheme.value = scheme;
  baseHostPort.value = hostPort;
  apiPrefix.value = c.api_prefix || "/api";
  token.value = c.token || "";
  healthPathsText.value = (c.health_paths?.length ? c.health_paths : ["/health", "/api/health"]).join("\n");
  uvicornLogFile.value = c.uvicorn_log_file || "";
  celeryLogFile.value = c.celery_log_file || "";
  timeoutSec.value = c.timeout_sec ?? 8;
}

function buildConfigPayload(): AiExtensionConfig {
  const paths = healthPathsText.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const ap = apiPrefix.value.trim();
  const api_prefix = ap.startsWith("/") ? ap : `/${ap}`;
  const t = Math.min(30, Math.max(2, Math.floor(Number(timeoutSec.value)) || 8));
  return {
    base_url: buildBaseUrl(baseScheme.value, baseHostPort.value),
    api_prefix,
    token: token.value,
    health_paths: paths.length ? paths : ["/health", "/api/health"],
    uvicorn_log_file: uvicornLogFile.value.trim(),
    celery_log_file: celeryLogFile.value.trim(),
    timeout_sec: t,
  };
}

async function load() {
  err.value = "";
  try {
    const c = await fetchAiExtensionConfig();
    hydrateFromConfig(c);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function save() {
  err.value = "";
  saving.value = true;
  try {
    const c = await putAiExtensionConfig(buildConfigPayload());
    hydrateFromConfig(c);
    pushConsoleToast("配置已保存");
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

async function runTest() {
  err.value = "";
  testOut.value = "";
  try {
    const r = await postAiExtensionTest();
    testOut.value = JSON.stringify(r, null, 2);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function loadLogs() {
  logErr.value = "";
  logOut.value = "";
  try {
    const r = await fetchAiExtensionLogs(logKind.value, 200);
    logOut.value = JSON.stringify(r, null, 2);
  } catch (e) {
    logErr.value = e instanceof Error ? e.message : String(e);
  }
}

async function refreshNcmStatus() {
  ncmBusy.value = true;
  ncmLastNote.value = "";
  err.value = "";
  try {
    ncmStatus.value = await fetchAiNcmStatus();
    if (!ncmStatus.value.ok) {
      err.value = ncmStatus.value.error || `扩展服务返回异常（HTTP ${ncmStatus.value.status_code ?? "?"})`;
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    ncmStatus.value = null;
  } finally {
    ncmBusy.value = false;
  }
}

async function sendNcmSms() {
  const phone = ncmPhone.value.trim();
  if (phone.length < 5) {
    err.value = "请输入有效手机号。";
    return;
  }
  ncmBusy.value = true;
  ncmLastNote.value = "";
  err.value = "";
  try {
    const r = await postAiNcmSendSms({ phone, ctcode: Number(ncmCtcode.value) || 86 });
    ncmStatus.value = r;
    const d = r.data as Record<string, unknown>;
    const msg = typeof d.message === "string" ? d.message : "";
    const code = d.code;
    if (r.ok && (code === 200 || code === "200")) {
      ncmLastNote.value = msg || "验证码已发送，请查收短信。";
    } else {
      err.value = msg || r.error || "发送验证码失败。";
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    ncmBusy.value = false;
  }
}

async function verifyNcmSms() {
  const phone = ncmPhone.value.trim();
  const captcha = ncmCaptcha.value.trim();
  if (phone.length < 5 || captcha.length < 2) {
    err.value = "请填写手机号与短信验证码。";
    return;
  }
  ncmBusy.value = true;
  ncmLastNote.value = "";
  err.value = "";
  try {
    const r = await postAiNcmVerifySms({ phone, captcha, ctcode: Number(ncmCtcode.value) || 86 });
    ncmStatus.value = r;
    const d = r.data as Record<string, unknown>;
    if (r.ok && d.success === true) {
      err.value = "";
      pushConsoleToast(typeof d.message === "string" && d.message.trim() ? d.message : "登录成功");
      ncmCaptcha.value = "";
      await refreshNcmStatus();
    } else {
      err.value = typeof d.message === "string" ? d.message : r.error || "登录失败。";
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    ncmBusy.value = false;
  }
}

async function logoutNcm() {
  ncmBusy.value = true;
  ncmLastNote.value = "";
  err.value = "";
  try {
    const r = await postAiNcmLogout();
    ncmStatus.value = r;
    const d = r.data as Record<string, unknown>;
    if (r.ok && d.success === true) {
      err.value = "";
      pushConsoleToast(typeof d.message === "string" && d.message.trim() ? d.message : "已登出");
      await refreshNcmStatus();
    } else {
      err.value = typeof d.message === "string" ? d.message : r.error || "登出失败。";
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    ncmBusy.value = false;
  }
}

onMounted(async () => {
  try {
    await load();
    await refreshNcmStatus();
  } finally {
    pageReady.value = true;
  }
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
    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="4"
    />
    <div v-else>
      <div class="panel">
        <div class="panel__hd panel__hd--split home-page__panel-hd-nowrap">
          <h2 class="panel__title ai-ncm-hd-title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>网易云音乐登录
            <RefreshIconButton
              :busy="ncmBusy"
              label="刷新状态"
              @click="refreshNcmStatus"
            />
          </h2>
          <div
            class="row-actions"
            style="flex-wrap: wrap; justify-content: flex-end"
          >
            <PanelSidebarAdd main-path="/ai" />
            <div
              v-if="ncmStatus"
              class="ai-ncm-hd-status"
            >
              <span
                class="home-page__hd-capsule"
                :class="ncmLoggedIn ? 'home-page__hd-capsule--ok' : 'home-page__hd-capsule--warn'"
              >{{ ncmLoggedIn ? "已登录" : "未登录" }}</span>
              <span
                v-if="ncmExtraLine"
                class="muted ai-ncm-hd-extra"
              >{{ ncmExtraLine }}</span>
            </div>
          </div>
        </div>
        <div class="panel__bd">
          <p
            v-if="ncmLastNote"
            class="muted"
            style="margin: 0 0 12px"
          >
            {{ ncmLastNote }}
          </p>
          <p
            v-if="ncmStatus && !ncmStatus.ok"
            class="muted"
            style="margin: 0 0 12px; font-size: 12px"
          >
            代理：{{ ncmStatus.url }}<template v-if="ncmStatus.error"> · {{ ncmStatus.error }}</template>
          </p>
          <p
            v-else-if="!ncmStatus"
            class="muted"
            style="margin: 0 0 12px"
          >
            尚未拉取状态。请先配置下方「扩展服务连接」并保存，再点标题旁刷新图标。
          </p>

          <div
            class="bot-config-edit"
            style="border: none; background: transparent; padding: 0; margin: 0"
          >
            <div class="bot-config-edit__grid">
              <div class="bot-config-edit__field">
                <label>手机号</label>
                <input
                  v-model="ncmPhone"
                  class="inp"
                  type="text"
                  inputmode="tel"
                  autocomplete="tel"
                  placeholder="11 位手机号"
                  style="width: 100%"
                >
              </div>
              <div class="bot-config-edit__field">
                <label>国家区号 ctcode</label>
                <input
                  v-model.number="ncmCtcode"
                  class="inp"
                  type="number"
                  min="1"
                  max="999"
                  style="width: 100%"
                >
              </div>
            </div>
            <div
              class="row-actions"
              style="margin-top: 12px; flex-wrap: wrap"
            >
              <button
                type="button"
                class="btn btn--primary"
                :disabled="ncmBusy"
                @click="sendNcmSms"
              >
                发送验证码
              </button>
            </div>
            <div
              class="bot-config-edit__field"
              style="margin-top: 16px"
            >
              <label>短信验证码</label>
              <input
                v-model="ncmCaptcha"
                class="inp ai-ncm-captcha-inp"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                placeholder="收到的验证码"
                @keydown.enter.prevent="verifyNcmSms"
              >
            </div>
            <div
              class="row-actions"
              style="margin-top: 12px; flex-wrap: wrap; gap: 8px"
            >
              <button
                type="button"
                class="btn btn--primary"
                :disabled="ncmBusy"
                @click="verifyNcmSms"
              >
                验证并登录
              </button>
              <button
                type="button"
                class="btn"
                :disabled="ncmBusy"
                @click="logoutNcm"
              >
                登出网易云
              </button>
            </div>
          </div>

          <details
            v-if="ncmStatus"
            class="muted"
            style="margin-top: 16px; font-size: 12px"
          >
            <summary style="cursor: pointer">原始响应（分页查看）</summary>
            <pre
              class="pre-block"
              style="margin-top: 8px; max-height: 220px; overflow: auto"
            >{{ ncmRawSlice }}</pre>
            <div style="border-top: none; margin-top: 8px; padding-top: 0">
              <ConsolePagerBar
                v-if="ncmRawLines.length > 0"
                v-model:page="ncmRawPage"
                v-model:page-size="tablePageSize"
                :total="ncmRawLines.length"
                unit="行"
                embedded
                :page-sizes="[8, 10, 12, 14, 16, 20, 24, 32]"
              />
            </div>
          </details>
        </div>
      </div>

      <div class="panel">
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>扩展日志
          </h2>
          <div class="row-actions">
            <PanelSidebarAdd main-path="/ai" />
            <select
              v-model="logKind"
              class="sel"
            >
              <option value="uvicorn">uvicorn</option>
              <option value="celery">celery</option>
            </select>
            <button
              type="button"
              class="btn btn--primary"
              @click="loadLogs"
            >
              拉取
            </button>
          </div>
        </div>
        <div class="panel__bd">
          <p
            v-if="!logOut && !logErr"
            class="muted"
            style="margin: 0 0 10px"
          >
            选择日志类型后点「拉取」读取扩展服务端日志片段（JSON）。
          </p>
          <div
            v-if="logErr"
            class="alert alert--err"
            style="margin-bottom: 10px"
          >
            {{ logErr }}
          </div>
          <pre
            v-if="logOut"
            class="pre-block"
          >{{ logOut }}</pre>
        </div>
      </div>

      <div class="panel">
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>扩展服务连接
          </h2>
          <div class="row-actions">
            <PanelSidebarAdd main-path="/ai" />
            <button
              type="button"
              class="btn"
              :disabled="saving"
              @click="load"
            >
              重新加载
            </button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="saving"
              @click="save"
            >
              {{ saving ? "保存中…" : "保存" }}
            </button>
            <button
              type="button"
              class="btn"
              :disabled="saving"
              @click="runTest"
            >
              健康测试
            </button>
          </div>
        </div>
        <div class="panel__bd">
          <div class="ai-ext-config-form bot-config-edit">
            <p
              class="muted"
              style="margin: 0 0 12px; font-size: 13px; line-height: 1.55"
            >
              以下为 Bot 访问 AI 扩展服务所用的连接参数；保存后写入服务端配置。
            </p>
            <div class="ai-ext-url-row">
              <div class="ai-ext-url-row__scheme">
                <label class="ai-ext-field-label">协议</label>
                <select
                  v-model="baseScheme"
                  class="sel"
                  style="width: 100%"
                >
                  <option value="http">http</option>
                  <option value="https">https</option>
                </select>
              </div>
              <div class="ai-ext-url-row__host">
                <label class="ai-ext-field-label">主机与端口</label>
                <input
                  v-model="baseHostPort"
                  class="inp"
                  type="text"
                  autocomplete="off"
                  placeholder="127.0.0.1:9099 或 [::1]:9099"
                  style="width: 100%"
                >
              </div>
            </div>
            <div class="bot-config-edit__field">
              <label>API 前缀</label>
              <input
                v-model="apiPrefix"
                class="inp"
                type="text"
                autocomplete="off"
                placeholder="/api"
                style="width: 100%; max-width: 480px"
              >
            </div>
            <div class="bot-config-edit__field">
              <label>Bearer Token（可选）</label>
              <input
                v-model="token"
                class="inp"
                type="password"
                autocomplete="off"
                placeholder="留空表示不携带 Authorization"
                style="width: 100%; max-width: 520px"
              >
            </div>
            <div class="bot-config-edit__field">
              <label>健康检查路径（每行一条）</label>
              <textarea
                v-model="healthPathsText"
                class="textarea"
                rows="3"
                spellcheck="false"
                style="width: 100%; max-width: 560px; font-family: ui-monospace, monospace; font-size: 12px"
              />
            </div>
            <div class="bot-config-edit__field">
              <label>请求超时（秒）</label>
              <input
                v-model.number="timeoutSec"
                class="inp"
                type="number"
                min="2"
                max="30"
                style="width: 100%; max-width: 200px"
              >
            </div>
            <div class="bot-config-edit__field">
              <label>uvicorn 日志路径</label>
              <input
                v-model="uvicornLogFile"
                class="inp"
                type="text"
                autocomplete="off"
                style="width: 100%"
              >
            </div>
            <div class="bot-config-edit__field">
              <label>celery 日志路径</label>
              <input
                v-model="celeryLogFile"
                class="inp"
                type="text"
                autocomplete="off"
                style="width: 100%"
              >
            </div>
          </div>
          <div
            v-if="testOut"
            style="margin-top: 16px"
          >
            <div
              class="muted"
              style="margin-bottom: 8px"
            >健康测试结果</div>
            <pre class="pre-block">{{ testOut }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-ext-field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--text-muted, #94a3b8);
}

.ai-ext-config-form {
  min-width: 0;
}

.ai-ext-url-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: flex-end;
  margin-bottom: 14px;
  min-width: 0;
  width: 100%;
}

.ai-ext-url-row__scheme {
  flex: 0 1 120px;
  min-width: 0;
}

.ai-ext-url-row__host {
  flex: 1 1 220px;
  min-width: 0;
}
</style>
