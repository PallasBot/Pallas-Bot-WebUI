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
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { slicePage } from "@/utils/paginate";

const err = ref("");
const ok = ref("");
const jsonText = ref("");
const testOut = ref("");
const logKind = ref<"uvicorn" | "celery">("uvicorn");
const logOut = ref("");

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

async function load() {
  err.value = "";
  try {
    const c = await fetchAiExtensionConfig();
    jsonText.value = JSON.stringify(c, null, 2);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function save() {
  err.value = "";
  ok.value = "";
  try {
    const body = JSON.parse(jsonText.value) as AiExtensionConfig;
    const c = await putAiExtensionConfig(body);
    jsonText.value = JSON.stringify(c, null, 2);
    ok.value = "已保存。";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
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
  err.value = "";
  logOut.value = "";
  try {
    const r = await fetchAiExtensionLogs(logKind.value, 200);
    logOut.value = JSON.stringify(r, null, 2);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function refreshNcmStatus() {
  ncmBusy.value = true;
  ncmLastNote.value = "";
  err.value = "";
  try {
    ncmStatus.value = await fetchAiNcmStatus();
    if (!ncmStatus.value.ok) {
      ok.value = "";
      err.value = ncmStatus.value.error || `扩展服务返回异常（HTTP ${ncmStatus.value.status_code ?? "?"})`;
    }
  } catch (e) {
    ok.value = "";
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
      ok.value = "";
      err.value = msg || r.error || "发送验证码失败。";
    }
  } catch (e) {
    ok.value = "";
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
      ok.value = typeof d.message === "string" ? d.message : "登录成功。";
      ncmCaptcha.value = "";
      await refreshNcmStatus();
    } else {
      ok.value = "";
      err.value = typeof d.message === "string" ? d.message : r.error || "登录失败。";
    }
  } catch (e) {
    ok.value = "";
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
      ok.value = typeof d.message === "string" ? d.message : "已登出。";
      await refreshNcmStatus();
    } else {
      ok.value = "";
      err.value = typeof d.message === "string" ? d.message : r.error || "登出失败。";
    }
  } catch (e) {
    ok.value = "";
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    ncmBusy.value = false;
  }
}

onMounted(async () => {
  await load();
  await refreshNcmStatus();
});
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">AI Stack</p>
      <h1 class="page-hero__title">AI 扩展</h1>
      <p class="page-hero__desc">查看扩展服务配置与健康状态；网易云可通过扩展服务完成短信登录。运行记录由后端代理读取。</p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>
    <div
      v-if="ok"
      class="alert alert--ok"
    >
      {{ ok }}
    </div>

    <div class="panel">
      <div class="panel__hd panel__hd--split">
        <div
          class="row-actions ai-ncm-hd-left"
          style="flex: 1; min-width: 0; flex-wrap: wrap; gap: 10px"
        >
          <h2 class="panel__title ai-ncm-hd-title">网易云音乐登录</h2>
          <template v-if="ncmStatus">
            <span
              class="badge"
              :class="ncmLoggedIn ? 'badge--ok' : 'badge--warn'"
            >{{ ncmLoggedIn ? "已登录" : "未登录" }}</span>
            <span
              v-if="ncmExtraLine"
              class="muted"
              style="font-size: 13px"
            >{{ ncmExtraLine }}</span>
          </template>
        </div>
        <div class="row-actions">
          <button
            type="button"
            class="btn btn--primary"
            :disabled="ncmBusy"
            @click="refreshNcmStatus"
          >
            {{ ncmBusy ? "请求中…" : "刷新状态" }}
          </button>
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
          尚未拉取状态。请先配置下方「扩展基址」并保存，再点「刷新状态」。
        </p>

        <div class="bot-config-edit" style="border: none; background: transparent; padding: 0; margin: 0">
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
          <div class="row-actions" style="margin-top: 12px; flex-wrap: wrap">
            <button
              type="button"
              class="btn btn--primary"
              :disabled="ncmBusy"
              @click="sendNcmSms"
            >
              发送验证码
            </button>
          </div>
          <div class="bot-config-edit__field" style="margin-top: 16px">
            <label>短信验证码</label>
            <input
              v-model="ncmCaptcha"
              class="inp"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="收到的验证码"
              style="max-width: 280px; width: 100%"
              @keydown.enter.prevent="verifyNcmSms"
            >
          </div>
          <div class="row-actions" style="margin-top: 12px; flex-wrap: wrap; gap: 8px">
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
          <pre class="pre-block" style="margin-top: 8px; max-height: 220px; overflow: auto">{{ ncmRawSlice }}</pre>
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
      <div class="panel__hd">
        <h2 class="panel__title">配置 JSON</h2>
        <div class="row-actions">
          <button
            type="button"
            class="btn"
            @click="load"
          >
            重新加载
          </button>
          <button
            type="button"
            class="btn btn--primary"
            @click="save"
          >
            保存
          </button>
          <button
            type="button"
            class="btn"
            @click="runTest"
          >
            健康测试
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <JsonTextareaField
          v-model="jsonText"
          title="AI 扩展配置 JSON"
          :rows="8"
          placeholder="点击或聚焦，在弹窗中编辑扩展服务配置 JSON"
        />
        <div
          v-if="testOut"
          style="margin-top: 16px"
        >
          <div class="muted" style="margin-bottom: 8px">测试结果</div>
          <pre class="pre-block">{{ testOut }}</pre>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">扩展日志</h2>
        <div class="row-actions">
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
      <div
        v-if="logOut"
        class="panel__bd"
      >
        <pre class="pre-block">{{ logOut }}</pre>
      </div>
    </div>
  </div>
</template>
