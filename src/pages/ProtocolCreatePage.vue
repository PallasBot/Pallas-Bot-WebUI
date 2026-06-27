<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { protocolApiErrorMessage, protocolCreateAccount } from "@/api/protocolApi";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { useProtocolMount } from "@/composables/useProtocolMount";
import { pushConsoleToast } from "@/utils/consoleToast";

const router = useRouter();
const { err, pageReady, mountUrl, protocolNotInstalled, reload } = useProtocolMount();

const qq = ref("");
const displayName = ref("");
const protocolBackend = ref<"napcat" | "snowluma">("napcat");
const webuiPort = ref("");
const webuiToken = ref("");
const wsUrl = ref("");
const wsName = ref("");
const wsToken = ref("");
const busy = ref(false);

async function submitCreate() {
  const mount = mountUrl.value;
  if (!mount) {
    pushConsoleToast("协议端未就绪", "warn");
    return;
  }
  const q = qq.value.trim();
  if (!q) {
    pushConsoleToast("请填写 QQ 号", "warn");
    return;
  }
  busy.value = true;
  try {
    const body: Record<string, unknown> = {
      id: q,
      qq: q,
      display_name: displayName.value.trim(),
      enabled: true,
      protocol_backend: protocolBackend.value,
    };
    const wp = parseInt(webuiPort.value.trim(), 10);
    if (webuiPort.value.trim() && !Number.isNaN(wp)) body.webui_port = wp;
    if (protocolBackend.value !== "snowluma" && webuiToken.value.trim()) {
      body.webui_token = webuiToken.value.trim();
    }
    if (wsUrl.value.trim()) body.ws_url = wsUrl.value.trim();
    if (wsName.value.trim()) body.ws_name = wsName.value.trim();
    if (wsToken.value) body.ws_token = wsToken.value;
    await protocolCreateAccount(mount, body);
    pushConsoleToast(`已创建账号 ${q}`, "ok");
    await router.push("/protocol");
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "创建失败"), "err");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="console-hub-page protocol-sub-page">
    <ConsolePageSkeleton v-if="!pageReady" :panels="1" />
    <template v-else>
      <div
        v-if="err"
        class="alert alert--err"
      >
        {{ err }}
      </div>
      <div
        v-if="protocolNotInstalled"
        class="alert alert--warn"
      >
        尚未安装 pallas-plugin-protocol 扩展。
      </div>
      <UiCard
        tag="div"
        glass
        class="protocol-sub-page__panel"
      >
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">
            创建协议账号
          </h2>
          <div class="row-actions">
            <RouterLink
              class="btn secondary"
              to="/protocol"
            >
              返回实例列表
            </RouterLink>
            <UiButton
              variant="outline"
              :busy="busy"
              @click="reload"
            >
              刷新
            </UiButton>
          </div>
        </div>
        <div class="panel__bd protocol-form-grid">
          <label class="field">
            <span class="field__label">QQ 号</span>
            <input
              v-model="qq"
              class="inp"
              inputmode="numeric"
              autocomplete="off"
            >
          </label>
          <label class="field">
            <span class="field__label">显示昵称</span>
            <input
              v-model="displayName"
              class="inp"
              autocomplete="off"
              placeholder="可选"
            >
          </label>
          <label class="field">
            <span class="field__label">协议端类型</span>
            <select
              v-model="protocolBackend"
              class="inp"
            >
              <option value="napcat">
                NapCat
              </option>
              <option value="snowluma">
                SnowLuma
              </option>
            </select>
          </label>
          <label class="field">
            <span class="field__label">内置 WebUI 端口</span>
            <input
              v-model="webuiPort"
              class="inp"
              type="number"
              placeholder="留空自动分配"
            >
          </label>
          <label
            v-if="protocolBackend !== 'snowluma'"
            class="field"
          >
            <span class="field__label">WebUI token</span>
            <input
              v-model="webuiToken"
              class="inp"
              type="password"
              autocomplete="off"
              placeholder="留空随机生成"
            >
          </label>
          <label class="field field--full">
            <span class="field__label">WS 连接地址</span>
            <input
              v-model="wsUrl"
              class="inp"
              placeholder="ws://127.0.0.1:8088/onebot/v11/ws"
              autocomplete="off"
            >
          </label>
          <label class="field">
            <span class="field__label">连接名</span>
            <input
              v-model="wsName"
              class="inp"
              placeholder="pallas"
              autocomplete="off"
            >
          </label>
          <label class="field">
            <span class="field__label">WS Token</span>
            <input
              v-model="wsToken"
              class="inp"
              type="password"
              autocomplete="off"
            >
          </label>
          <div class="field field--full row-actions">
            <UiButton
              variant="primary"
              :disabled="!mountUrl"
              :busy="busy"
              @click="submitCreate"
            >
              创建
            </UiButton>
          </div>
        </div>
      </UiCard>
    </template>
  </div>
</template>

<style scoped>
.protocol-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.field--full {
  grid-column: 1 / -1;
}
.field__label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.82rem;
  color: var(--muted);
}
@media (max-width: 560px) {
  .protocol-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
