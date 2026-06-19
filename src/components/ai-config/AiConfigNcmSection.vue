<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  fetchAiNcmStatus,
  postAiNcmLogout,
  postAiNcmSendSms,
  postAiNcmVerifySms,
} from "@/api/consoleApi";
import type { AiProxyResult } from "@/api/pallasTypes";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import ConsolePagerBar from "@/components/ConsolePagerBar.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { AI_NCM_DEFAULTS } from "@/config/aiConstants";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { proxyCodeEquals, proxyDataRecord, proxyString } from "@/utils/aiProxyResult";
import { slicePage } from "@/utils/paginate";
import { pushConsoleToast } from "@/utils/consoleToast";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const ncmPhone = ref("");
const ncmCtcode = ref<number>(AI_NCM_DEFAULTS.countryCode);
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

const ncmPayload = computed<Record<string, unknown>>(() => proxyDataRecord(ncmStatus.value));

const ncmLoggedIn = computed(() => {
  const p = ncmPayload.value;
  return Boolean(p.success) && (typeof p.session === "string" ? p.session.length > 0 : Boolean(p.session));
});

const ncmStatusMessage = computed(() => proxyString(ncmPayload.value, "message"));

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
  if (phone.length < AI_NCM_DEFAULTS.phoneMinLength) {
    err.value = "请输入有效手机号。";
    return;
  }
  ncmBusy.value = true;
  ncmLastNote.value = "";
  err.value = "";
  try {
    const r = await postAiNcmSendSms({ phone, ctcode: Number(ncmCtcode.value) || AI_NCM_DEFAULTS.countryCode });
    ncmStatus.value = r;
    const d = proxyDataRecord(r);
    const msg = proxyString(d, "message");
    if (r.ok && proxyCodeEquals(d, 200)) {
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
  if (phone.length < AI_NCM_DEFAULTS.phoneMinLength || captcha.length < AI_NCM_DEFAULTS.captchaMinLength) {
    err.value = "请填写手机号与短信验证码。";
    return;
  }
  ncmBusy.value = true;
  ncmLastNote.value = "";
  err.value = "";
  try {
    const r = await postAiNcmVerifySms({ phone, captcha, ctcode: Number(ncmCtcode.value) || AI_NCM_DEFAULTS.countryCode });
    ncmStatus.value = r;
    const d = proxyDataRecord(r);
    if (r.ok && d.success === true) {
      err.value = "";
      pushConsoleToast(proxyString(d, "message").trim() || "登录成功");
      ncmCaptcha.value = "";
      await refreshNcmStatus();
    } else {
      err.value = proxyString(d, "message") || r.error || "登录失败。";
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
    const d = proxyDataRecord(r);
    if (r.ok && d.success === true) {
      err.value = "";
      pushConsoleToast(proxyString(d, "message").trim() || "已登出");
      await refreshNcmStatus();
    } else {
      err.value = proxyString(d, "message") || r.error || "登出失败。";
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    ncmBusy.value = false;
  }
}

onMounted(() => {
  void refreshNcmStatus();
});
</script>

<template>
  <UiCard
    tag="div"
    glass
    class="ai-config-section__panel"
  >
    <div class="panel__hd panel__hd--split home-page__panel-hd-nowrap">
      <h2 class="panel__title ai-ncm-hd-title">
        <ConsoleNavIcon
          class="panel__title-ico"
          :name="panelNavIcon"
        />网易云音乐登录
        <RefreshIconButton
          :show-label="false"
          :busy="ncmBusy"
          label="刷新状态"
          @click="refreshNcmStatus"
        />
      </h2>
      <div
        class="row-actions ai-ncm-hd__actions"
      >
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
      <div
        v-if="err"
        class="alert alert--err"
        
      >
        {{ err }}
      </div>
      <p
        v-if="ncmLastNote"
        class="muted"
        
      >
        {{ ncmLastNote }}
      </p>
      <p
        v-if="ncmStatus && !ncmStatus.ok"
        class="muted"
        
      >
        代理：{{ ncmStatus.url }}<template v-if="ncmStatus.error"> · {{ ncmStatus.error }}</template>
      </p>
      <p
        v-else-if="!ncmStatus"
        class="muted"
        
      >
        尚未拉取状态。请先在「扩展连接」保存连接配置，再点标题旁刷新。
      </p>
      <p
        v-else
        class="muted ai-config-section__intro"
      >
        登录后扩展服务可代查网易云接口；验证码仅用于本次登录，不会写入 Bot 配置。
      </p>

      <div class="ai-ncm-form">
        <div class="ai-ncm-form__grid">
          <div class="form-field">
            <label class="form-field__label">手机号</label>
            <input
              v-model="ncmPhone"
              class="inp"
              type="text"
              inputmode="tel"
              autocomplete="tel"
              placeholder="11 位手机号"
            >
          </div>
          <div class="form-field">
            <label class="form-field__label">国家区号</label>
            <input
              v-model.number="ncmCtcode"
              class="inp"
              type="number"
              min="1"
              max="999"
              placeholder="86"
            >
          </div>
        </div>
        <div class="row-actions ai-ncm-form__actions">
          <UiButton
            variant="primary"
            :disabled="ncmBusy"
            @click="sendNcmSms"
          >
            发送验证码
          </UiButton>
        </div>
        <div class="form-field ai-ncm-form__captcha">
          <label class="form-field__label">短信验证码</label>
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
        <div class="row-actions ai-ncm-form__actions">
          <UiButton
            variant="primary"
            :disabled="ncmBusy"
            @click="verifyNcmSms"
          >
            验证并登录
          </UiButton>
          <UiButton
            :disabled="ncmBusy"
            @click="logoutNcm"
          >
            登出网易云
          </UiButton>
        </div>
      </div>

      <details
        v-if="ncmStatus"
        class="ai-ncm-raw muted"
      >
        <summary>原始响应（分页查看）</summary>
        <pre class="pre-block ai-ncm-raw__pre">{{ ncmRawSlice }}</pre>
        <div class="ai-ncm-raw__pager">
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
  </UiCard>
</template>

<style scoped>
.ai-ncm-form {
  display: flex;
  flex-direction: column;
}

.ai-ncm-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ai-ncm-form__actions {
  margin-top: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-ncm-form__captcha {
  margin-top: 16px;
}

.ai-ncm-raw {
  margin-top: 16px;
  font-size: 12px;
}

.ai-ncm-raw summary {
  cursor: pointer;
}

.ai-ncm-raw__pre {
  margin-top: 8px;
  max-height: 220px;
  overflow: auto;
}

.ai-ncm-raw__pager {
  margin-top: 8px;
}
</style>
