<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  protocolApiErrorMessage,
  protocolCreateAccount,
  protocolListSnowlumaRuntimes,
  type SnowlumaRuntimeRow,
} from "@/api/protocolApi";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PageChrome from "@/components/PageChrome.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { useProtocolMount } from "@/composables/useProtocolMount";
import { pushConsoleToast } from "@/utils/consoleToast";

const router = useRouter();
const panelNavIcon = usePanelNavIcon();
const { err, pageReady, mountUrl, reload } = useProtocolMount();

const qq = ref("");
const displayName = ref("");
const protocolBackend = ref("napcat");
const webuiPort = ref("");
const webuiToken = ref("");
const wsUrl = ref("");
const wsName = ref("");
const wsToken = ref("");
const busy = ref(false);
const snowlumaRuntimes = ref<SnowlumaRuntimeRow[]>([]);
const snowlumaRuntimeId = ref("");
const snowlumaRuntimeMode = ref<"new" | "existing">("new");

async function loadSnowlumaRuntimes() {
  const mount = mountUrl.value;
  if (!mount) {
    snowlumaRuntimes.value = [];
    return;
  }
  try {
    snowlumaRuntimes.value = await protocolListSnowlumaRuntimes(mount);
  } catch {
    snowlumaRuntimes.value = [];
  }
}

watch(protocolBackend, (v) => {
  if (v === "snowluma") void loadSnowlumaRuntimes();
});

onMounted(() => {
  if (protocolBackend.value === "snowluma") void loadSnowlumaRuntimes();
});

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
  if (protocolBackend.value === "snowluma" && snowlumaRuntimeMode.value === "existing") {
    if (!snowlumaRuntimeId.value.trim()) {
      pushConsoleToast("请选择已有 SnowLuma Runtime", "warn");
      return;
    }
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
    if (protocolBackend.value === "snowluma") {
      if (snowlumaRuntimeMode.value === "existing") {
        body.snowluma_runtime_id = snowlumaRuntimeId.value.trim();
        body.create_runtime = false;
      } else {
        body.create_runtime = true;
      }
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
      <PageChrome
        :icon="panelNavIcon"
        title="创建协议账号"
        lead="填写 QQ 与连接参数后创建协议端实例；完成后可返回列表启停。"
      >
        <template #actions>
          <RouterLink
            custom
            v-slot="{ navigate }"
            to="/protocol"
          >
            <UiButton
              variant="outline"
              @click="navigate"
            >
              返回实例列表
            </UiButton>
          </RouterLink>
          <UiButton
            variant="outline"
            :busy="busy"
            @click="reload"
          >
            刷新
          </UiButton>
        </template>
      </PageChrome>
      <UiCard
        tag="div"
        glass
        class="protocol-sub-page__panel"
      >
        <div class="panel__bd protocol-form-grid">
          <label class="field">
            <span class="field__label">QQ 号</span>
            <UiInput
              v-model="qq"
              inputmode="numeric"
              autocomplete="off"
            />
          </label>
          <label class="field">
            <span class="field__label">显示昵称</span>
            <UiInput
              v-model="displayName"
              autocomplete="off"
              placeholder="可选"
            />
          </label>
          <label class="field">
            <span class="field__label">协议端类型</span>
            <UiSelect v-model="protocolBackend">
              <option value="napcat">
                NapCat
              </option>
              <option value="snowluma">
                SnowLuma
              </option>
            </UiSelect>
          </label>
          <template v-if="protocolBackend === 'snowluma'">
            <label class="field">
              <span class="field__label">SnowLuma Runtime</span>
              <UiSelect v-model="snowlumaRuntimeMode">
                <option value="new">
                  新建 Runtime（一进程可再加号）
                </option>
                <option value="existing">
                  加入已有 Runtime
                </option>
              </UiSelect>
            </label>
            <label
              v-if="snowlumaRuntimeMode === 'existing'"
              class="field"
            >
              <span class="field__label">选择 Runtime</span>
              <UiSelect v-model="snowlumaRuntimeId">
                <option value="">
                  请选择…
                </option>
                <option
                  v-for="rt in snowlumaRuntimes"
                  :key="rt.id"
                  :value="rt.id"
                >
                  {{ rt.display_name || rt.id }}（{{ rt.member_count ?? 0 }} 号）
                </option>
              </UiSelect>
            </label>
          </template>
          <label class="field">
            <span class="field__label">内置 WebUI 端口</span>
            <UiInput
              v-model="webuiPort"
              type="number"
              placeholder="留空自动分配；加入已有 Runtime 时沿用 Runtime 端口"
            />
          </label>
          <label
            v-if="protocolBackend !== 'snowluma'"
            class="field"
          >
            <span class="field__label">WebUI token</span>
            <UiInput
              v-model="webuiToken"
              type="password"
              revealable
              autocomplete="off"
              placeholder="留空随机生成"
            />
          </label>
          <label class="field field--full">
            <span class="field__label">WS 连接地址</span>
            <UiInput
              v-model="wsUrl"
              placeholder="ws://127.0.0.1:8088/onebot/v11/ws"
              autocomplete="off"
            />
          </label>
          <label class="field">
            <span class="field__label">连接名</span>
            <UiInput
              v-model="wsName"
              placeholder="pallas"
              autocomplete="off"
            />
          </label>
          <label class="field">
            <span class="field__label">WS Token</span>
            <UiInput
              v-model="wsToken"
              type="password"
              revealable
              autocomplete="off"
            />
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
