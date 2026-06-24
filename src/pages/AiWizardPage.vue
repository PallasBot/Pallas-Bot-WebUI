<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  fetchLlmProvidersConfig,
  fetchLlmRuntimeOverview,
  fetchLlmWizardStatus,
  postAiExtensionTest,
  postLlmProviderTest,
  postServiceGatewaysConnectivityCheck,
} from "@/api/consoleApi";
import type {
  AiExtensionTestData,
  LlmProviderConfigRow,
  LlmProvidersConfig,
  LlmRuntimeOverviewData,
  LlmWizardStatusData,
  PluginConfigCheckResult,
} from "@/api/pallasTypes";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import RuntimeCheckResults from "@/components/config/RuntimeCheckResults.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

type WizardActionTarget = {
  to: string;
  label: string;
};

type ProviderTestRowState = {
  testing: boolean;
  reachable: boolean | null;
  latencyMs: number | null;
  error: string;
};

const panelNavIcon = usePanelNavIcon();
const loading = ref(false);
const err = ref("");
const gatewayBusy = ref(false);
const gatewayErr = ref("");
const extensionBusy = ref(false);
const extensionErr = ref("");
const providersBusy = ref(false);

const wizardStatus = ref<LlmWizardStatusData | null>(null);
const runtimeOverview = ref<LlmRuntimeOverviewData | null>(null);
const providersConfig = ref<LlmProvidersConfig | null>(null);
const gatewayCheck = ref<PluginConfigCheckResult | null>(null);
const extensionTest = ref<AiExtensionTestData | null>(null);
const providerTests = ref<Record<string, ProviderTestRowState>>({});

function actionTargetForCheck(id: string): WizardActionTarget {
  switch (id) {
    case "ai_service":
      return { to: "/ai/config/connection", label: "检查连接配置" };
    case "provider_configured":
      return { to: "/ai/config/provider", label: "配置 Provider" };
    case "provider_reachable":
      return { to: "/ai/config/provider", label: "测试 Provider" };
    case "llm_chat_enabled":
      return { to: "/ai/config/strategy", label: "开启智能对话" };
    default:
      return { to: "/ai/home", label: "查看 AI 首页" };
  }
}

const checkRows = computed(() =>
  (wizardStatus.value?.checks ?? []).map((check) => ({
    ...check,
    action: actionTargetForCheck(check.id),
  })),
);

const allChecksPassed = computed(() => checkRows.value.length > 0 && checkRows.value.every((row) => row.ok));

const runtimeSummary = computed(() => {
  const health = runtimeOverview.value?.health;
  if (!health) return "";
  if (!health.ok) return health.error || "AI Runtime 当前不可达";
  return health.llm_runtime_detail || "AI Runtime 已接通";
});

const providerRows = computed(() => providersConfig.value?.providers ?? []);
const enabledProviderRows = computed(() => providerRows.value.filter((row) => row.enabled));

const runtimeProviderStatusById = computed(() => {
  const rows = runtimeOverview.value?.health?.llm_health?.provider_status ?? [];
  return new Map(rows.map((row) => [row.id, row]));
});

const providerSummaryText = computed(() => {
  const total = providerRows.value.length;
  const enabled = enabledProviderRows.value.length;
  if (!total) return "尚未登记任何 Provider。";
  return `已登记 ${total} 个 Provider，其中 ${enabled} 个启用。`;
});

const extensionProviderRows = computed(() => extensionTest.value?.llm_health?.provider_status ?? []);
const extensionMediaCapabilities = computed(() => extensionTest.value?.media_tasks?.capabilities ?? []);

function providerReachUi(row: LlmProviderConfigRow): { label: string; cls: string; detail: string } {
  const tested = providerTests.value[row.id];
  if (tested && !tested.testing && tested.reachable !== null) {
    if (tested.reachable) {
      return {
        label: tested.latencyMs != null ? `可达 ${tested.latencyMs}ms` : "可达",
        cls: "tag--ok",
        detail: tested.error || "最近一次主动测试成功。",
      };
    }
    return {
      label: "不可达",
      cls: "tag--warn",
      detail: tested.error || "最近一次主动测试失败。",
    };
  }
  if (!row.enabled) {
    return { label: "已停用", cls: "tag--muted", detail: "当前未启用，不参与路由。" };
  }
  const runtimeRow = runtimeProviderStatusById.value.get(row.id);
  if (runtimeRow?.reachable === true) {
    return {
      label: "可达",
      cls: "tag--ok",
      detail: runtimeRow.health_state || "来自 runtime-overview 的健康状态。",
    };
  }
  if (runtimeRow?.reachable === false) {
    return {
      label: "不可达",
      cls: "tag--warn",
      detail: runtimeRow.health_state || "runtime-overview 显示该 Provider 不可达。",
    };
  }
  return { label: "待测试", cls: "tag--muted", detail: "尚未执行主动连通测试。" };
}

async function refresh() {
  loading.value = true;
  err.value = "";
  try {
    const [wizard, overview, providers] = await Promise.all([
      fetchLlmWizardStatus(),
      fetchLlmRuntimeOverview().catch(() => null),
      fetchLlmProvidersConfig().catch(() => null),
    ]);
    wizardStatus.value = wizard;
    runtimeOverview.value = overview;
    providersConfig.value = providers;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function runGatewayCheck() {
  gatewayBusy.value = true;
  gatewayErr.value = "";
  try {
    gatewayCheck.value = await postServiceGatewaysConnectivityCheck();
  } catch (e) {
    gatewayErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    gatewayBusy.value = false;
  }
}

async function runExtensionDiagnostic() {
  extensionBusy.value = true;
  extensionErr.value = "";
  try {
    extensionTest.value = await postAiExtensionTest();
  } catch (e) {
    extensionErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    extensionBusy.value = false;
  }
}

async function runProviderTest(providerId: string) {
  providerTests.value = {
    ...providerTests.value,
    [providerId]: { testing: true, reachable: null, latencyMs: null, error: "" },
  };
  try {
    const result = await postLlmProviderTest(providerId);
    providerTests.value = {
      ...providerTests.value,
      [providerId]: {
        testing: false,
        reachable: result.reachable,
        latencyMs: result.latency_ms ?? null,
        error: result.error ?? "",
      },
    };
  } catch (e) {
    providerTests.value = {
      ...providerTests.value,
      [providerId]: {
        testing: false,
        reachable: false,
        latencyMs: null,
        error: e instanceof Error ? e.message : String(e),
      },
    };
  }
}

async function runAllProviderTests() {
  const rows = enabledProviderRows.value.length ? enabledProviderRows.value : providerRows.value;
  if (!rows.length) return;
  providersBusy.value = true;
  try {
    await Promise.all(rows.map((row) => runProviderTest(row.id)));
  } finally {
    providersBusy.value = false;
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="console-hub-page ai-wizard-page">
    <ConsoleHubMasthead :icon="panelNavIcon">
      <template #title>
        AI 体检向导
      </template>
      <template #lead>
        用统一的 `wizard/status` 与 `runtime-overview` 做总览，再补充扩展连通测试、站点级网关检查和 Provider 主动探测，减少只提示“下一步”却看不到真实诊断结果的空心页。
      </template>
      <template #actions>
        <UiButton variant="primary" :busy="loading" @click="refresh">
          刷新体检
        </UiButton>
        <RouterLink to="/ai/home">
          <UiButton variant="ghost">AI 首页</UiButton>
        </RouterLink>
      </template>
    </ConsoleHubMasthead>

    <div v-if="err" class="alert alert--err">{{ err }}</div>
    <div v-else-if="allChecksPassed" class="alert alert--ok">
      AI 体检已通过，可以回到 AI 首页继续观察运行态。
    </div>
    <div v-else-if="wizardStatus?.next_step" class="alert alert--warn">
      当前优先处理：{{ wizardStatus.next_step }}
    </div>

    <section class="ai-wizard-page__summary">
      <UiCard class="ai-wizard-page__summary-card">
        <span class="ai-wizard-page__summary-label">AI 服务</span>
        <strong class="ai-wizard-page__summary-value">
          {{ wizardStatus?.ai_reachable ? "可达" : "不可达" }}
        </strong>
        <p class="muted ai-wizard-page__summary-text">
          {{ runtimeSummary || wizardStatus?.health_url || "尚未获取运行态摘要" }}
        </p>
      </UiCard>
      <UiCard class="ai-wizard-page__summary-card">
        <span class="ai-wizard-page__summary-label">Provider</span>
        <strong class="ai-wizard-page__summary-value">
          {{ wizardStatus?.providers_reachable ?? 0 }} / {{ wizardStatus?.providers_configured ?? 0 }}
        </strong>
        <p class="muted ai-wizard-page__summary-text">
          已配置 / 可达 Provider 数量。
        </p>
      </UiCard>
      <UiCard class="ai-wizard-page__summary-card">
        <span class="ai-wizard-page__summary-label">当前模型</span>
        <strong class="ai-wizard-page__summary-value">{{ wizardStatus?.model || "未返回" }}</strong>
        <p class="muted ai-wizard-page__summary-text">
          Provider 模式：{{ wizardStatus?.provider_mode || "未返回" }}
        </p>
      </UiCard>
    </section>

    <section class="ai-wizard-page__checks">
      <UiCard
        v-for="row in checkRows"
        :key="row.id"
        class="ai-wizard-page__check"
      >
        <div class="ai-wizard-page__check-head">
          <div>
            <h3 class="ai-wizard-page__check-title">{{ row.label }}</h3>
            <p class="muted ai-wizard-page__check-detail">{{ row.detail || "已满足" }}</p>
          </div>
          <span class="ai-wizard-page__pill" :class="{ 'is-ok': row.ok, 'is-warn': !row.ok }">
            {{ row.ok ? "通过" : "待处理" }}
          </span>
        </div>
        <div class="ai-wizard-page__actions">
          <RouterLink :to="row.action.to">
            <UiButton :variant="row.ok ? 'ghost' : 'outline'">{{ row.action.label }}</UiButton>
          </RouterLink>
        </div>
      </UiCard>
    </section>

    <UiCard class="ai-wizard-page__ops">
      <div class="ai-wizard-page__ops-head">
        <div>
          <h3 class="ai-wizard-page__check-title">进一步诊断</h3>
          <p class="muted ai-wizard-page__check-detail">下面三组操作会真正向扩展服务、service gateways 与各个 Provider 发起检查。</p>
        </div>
      </div>
      <div class="ai-wizard-page__actions">
        <UiButton variant="outline" :busy="extensionBusy" @click="runExtensionDiagnostic">
          扩展连通测试
        </UiButton>
        <UiButton variant="outline" :busy="gatewayBusy" @click="runGatewayCheck">
          站点级网关检查
        </UiButton>
        <UiButton variant="outline" :busy="providersBusy" :disabled="!providerRows.length" @click="runAllProviderTests">
          批量测试 Provider
        </UiButton>
      </div>
    </UiCard>

    <section class="ai-wizard-page__diag-grid">
      <UiCard class="ai-wizard-page__diag-card">
        <div class="ai-wizard-page__check-head">
          <div>
            <h3 class="ai-wizard-page__check-title">AI 扩展服务</h3>
            <p class="muted ai-wizard-page__check-detail">直接读取扩展健康接口，补充 health URL、状态码与媒体任务摘要。</p>
          </div>
          <RouterLink to="/ai/config/connection">
            <UiButton variant="ghost" size="sm">连接配置</UiButton>
          </RouterLink>
        </div>
        <div v-if="extensionErr" class="alert alert--err">{{ extensionErr }}</div>
        <div v-else-if="extensionTest" class="ai-wizard-page__rows">
          <div class="ai-wizard-page__row">
            <span class="ai-wizard-page__row-key">连通状态</span>
            <strong class="ai-wizard-page__row-val">{{ extensionTest.ok ? "可达" : "不可达" }}</strong>
          </div>
          <div class="ai-wizard-page__row">
            <span class="ai-wizard-page__row-key">健康地址</span>
            <strong class="ai-wizard-page__row-val ai-wizard-page__row-val--wrap">{{ extensionTest.health_url }}</strong>
          </div>
          <div class="ai-wizard-page__row">
            <span class="ai-wizard-page__row-key">状态码</span>
            <strong class="ai-wizard-page__row-val">{{ extensionTest.status_code ?? "—" }}</strong>
          </div>
          <div v-if="extensionTest.error" class="ai-wizard-page__row">
            <span class="ai-wizard-page__row-key">错误</span>
            <strong class="ai-wizard-page__row-val ai-wizard-page__row-val--wrap">{{ extensionTest.error }}</strong>
          </div>
          <div v-if="extensionProviderRows.length" class="ai-wizard-page__subsection">
            <strong class="ai-wizard-page__subsection-title">扩展返回的 Provider 状态</strong>
            <div class="ai-wizard-page__chip-list">
              <span
                v-for="row in extensionProviderRows"
                :key="row.id"
                class="tag"
                :class="row.reachable ? 'tag--ok' : 'tag--warn'"
              >
                {{ row.id }} · {{ row.reachable ? "可达" : "不可达" }}
              </span>
            </div>
          </div>
          <div v-if="extensionTest.media_tasks" class="ai-wizard-page__subsection">
            <strong class="ai-wizard-page__subsection-title">媒体任务</strong>
            <div class="ai-wizard-page__chip-list">
              <span class="tag">队列 {{ extensionTest.media_tasks.queue_depth }}</span>
              <span class="tag">执行中 {{ extensionTest.media_tasks.active_tasks }}</span>
              <span class="tag">累计 {{ extensionTest.media_tasks.total_tasks }}</span>
            </div>
            <div v-if="extensionMediaCapabilities.length" class="ai-wizard-page__mini-list">
              <div
                v-for="cap in extensionMediaCapabilities"
                :key="cap.capability"
                class="ai-wizard-page__row"
              >
                <span class="ai-wizard-page__row-key">{{ cap.capability }}</span>
                <strong class="ai-wizard-page__row-val">队列 {{ cap.queue_depth }} / 执行 {{ cap.active_tasks }}</strong>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="muted ai-wizard-page__placeholder">还没有执行扩展连通测试。</p>
      </UiCard>

      <UiCard class="ai-wizard-page__diag-card">
        <div class="ai-wizard-page__check-head">
          <div>
            <h3 class="ai-wizard-page__check-title">站点级网关检查</h3>
            <p class="muted ai-wizard-page__check-detail">复用 service gateways 的连通性检查，直接展示 runtime 视角的能力状态。</p>
          </div>
          <RouterLink to="/common-config?section=service_gateways">
            <UiButton variant="ghost" size="sm">通用配置</UiButton>
          </RouterLink>
        </div>
        <div v-if="gatewayErr" class="alert alert--err">{{ gatewayErr }}</div>
        <template v-else-if="gatewayCheck">
          <ul v-if="gatewayCheck.lines.length" class="ai-wizard-page__line-list">
            <li v-for="line in gatewayCheck.lines" :key="line">{{ line }}</li>
          </ul>
          <RuntimeCheckResults :results="gatewayCheck.results" />
        </template>
        <p v-else class="muted ai-wizard-page__placeholder">还没有执行站点级网关检查。</p>
      </UiCard>
    </section>

    <UiCard class="ai-wizard-page__diag-card">
      <div class="ai-wizard-page__check-head">
        <div>
          <h3 class="ai-wizard-page__check-title">Provider 主动测试</h3>
          <p class="muted ai-wizard-page__check-detail">{{ providerSummaryText }}</p>
        </div>
        <RouterLink to="/ai/config/provider">
          <UiButton variant="ghost" size="sm">Provider 配置</UiButton>
        </RouterLink>
      </div>
      <div v-if="providerRows.length" class="ai-wizard-page__provider-list">
        <article
          v-for="row in providerRows"
          :key="row.id"
          class="ai-wizard-page__provider"
          :class="{ 'is-disabled': !row.enabled }"
        >
          <div class="ai-wizard-page__provider-head">
            <div>
              <strong>{{ row.id }}</strong>
              <p class="muted ai-wizard-page__provider-meta">
                {{ row.kind === "local" ? "本地" : "远程" }}
                <span v-if="row.default_model"> · 模型 {{ row.default_model }}</span>
                <span v-if="row.base_url"> · {{ row.base_url }}</span>
              </p>
            </div>
            <span class="tag" :class="providerReachUi(row).cls">{{ providerReachUi(row).label }}</span>
          </div>
          <p class="muted ai-wizard-page__provider-detail">{{ providerReachUi(row).detail }}</p>
          <div class="ai-wizard-page__actions">
            <UiButton
              variant="outline"
              size="sm"
              :busy="providerTests[row.id]?.testing"
              @click="runProviderTest(row.id)"
            >
              测试 {{ row.id }}
            </UiButton>
          </div>
        </article>
      </div>
      <p v-else class="muted ai-wizard-page__placeholder">还没有登记任何 Provider，可先前往配置页补录。</p>
    </UiCard>
  </div>
</template>

<style scoped>
.ai-wizard-page {
  display: grid;
  gap: 16px;
}

.ai-wizard-page__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.ai-wizard-page__summary-card,
.ai-wizard-page__check {
  display: grid;
  gap: 10px;
}

.ai-wizard-page__summary-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

.ai-wizard-page__summary-value {
  font-size: 1.2rem;
}

.ai-wizard-page__summary-text,
.ai-wizard-page__check-detail {
  margin: 0;
  line-height: 1.5;
}

.ai-wizard-page__checks {
  display: grid;
  gap: 16px;
}

.ai-wizard-page__ops,
.ai-wizard-page__diag-card {
  display: grid;
  gap: 12px;
}

.ai-wizard-page__ops-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ai-wizard-page__diag-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ai-wizard-page__check-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ai-wizard-page__check-title {
  margin: 0 0 4px;
  font-size: 1rem;
}

.ai-wizard-page__pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.ai-wizard-page__pill.is-ok {
  border-color: color-mix(in srgb, #2e9b5f 40%, transparent);
  color: #2e9b5f;
}

.ai-wizard-page__pill.is-warn {
  border-color: color-mix(in srgb, #d08b00 45%, transparent);
  color: #d08b00;
}

.ai-wizard-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ai-wizard-page__rows,
.ai-wizard-page__mini-list,
.ai-wizard-page__provider-list {
  display: grid;
  gap: 10px;
}

.ai-wizard-page__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ai-wizard-page__row-key {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.ai-wizard-page__row-val {
  text-align: right;
}

.ai-wizard-page__row-val--wrap {
  word-break: break-word;
}

.ai-wizard-page__subsection {
  display: grid;
  gap: 8px;
  padding-top: 4px;
}

.ai-wizard-page__subsection-title {
  font-size: 0.875rem;
}

.ai-wizard-page__chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-wizard-page__line-list {
  margin: 0;
  padding-left: 18px;
  color: var(--text-muted);
  font-size: 0.875rem;
  line-height: 1.6;
}

.ai-wizard-page__placeholder {
  margin: 0;
  line-height: 1.6;
}

.ai-wizard-page__provider {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-card) 92%, white 8%);
}

.ai-wizard-page__provider.is-disabled {
  opacity: 0.82;
}

.ai-wizard-page__provider-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ai-wizard-page__provider-meta,
.ai-wizard-page__provider-detail {
  margin: 4px 0 0;
  line-height: 1.5;
}

@media (max-width: 960px) {
  .ai-wizard-page__summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-wizard-page__diag-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .ai-wizard-page__ops-head,
  .ai-wizard-page__check-head {
    flex-direction: column;
  }

  .ai-wizard-page__row,
  .ai-wizard-page__provider-head,
  .ai-wizard-page__actions {
    flex-direction: column;
  }

  .ai-wizard-page__row-val {
    text-align: left;
  }
}
</style>
