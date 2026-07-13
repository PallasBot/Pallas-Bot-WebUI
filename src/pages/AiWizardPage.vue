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
import { aiHealthStateLabel } from "@/utils/aiHealthLabel";
import { mediaCapabilityLabel } from "@/utils/runtimeOverviewRows";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import RuntimeCheckResults from "@/components/config/RuntimeCheckResults.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { wizardActionForCheckId } from "@/config/aiWizardGuide";

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
  return wizardActionForCheckId(id);
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
  if (!health.ok) return health.error || "当前无法连接到 AI 运行环境";
  return health.llm_runtime_detail || "运行环境已成功接通";
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
  if (!total) return "尚未登记任何模型提供商。";
  return `共登记 ${total} 个提供商，其中已启用 ${enabled} 个。`;
});

const extensionProviderRows = computed(() => extensionTest.value?.llm_health?.provider_status ?? []);
const extensionMediaCapabilities = computed(() => extensionTest.value?.media_tasks?.capabilities ?? []);

function providerReachUi(row: LlmProviderConfigRow): { label: string; cls: string; detail: string } {
  const tested = providerTests.value[row.id];
  if (tested && !tested.testing && tested.reachable !== null) {
    if (tested.reachable) {
      return {
        label: tested.latencyMs != null ? `网络连通 (${tested.latencyMs}ms)` : "网络连通",
        cls: "tag--ok",
        detail: tested.error || "最近一次主动测试成功。",
      };
    }
    return {
      label: "无法连接",
      cls: "tag--warn",
      detail: tested.error || "最近一次主动测试失败。",
    };
  }
  if (!row.enabled) {
    return { label: "已停用", cls: "tag--muted", detail: "当前提供商未启用，将不参与模型路由分配。" };
  }
  const runtimeRow = runtimeProviderStatusById.value.get(row.id);
  if (runtimeRow?.reachable === true) {
    return {
      label: "连通状态良好",
      cls: "tag--ok",
      detail: aiHealthStateLabel(runtimeRow.health_state) || "根据运行环境状态判断该提供商正常。",
    };
  }
  if (runtimeRow?.reachable === false) {
    return {
      label: "连通异常",
      cls: "tag--warn",
      detail: aiHealthStateLabel(runtimeRow.health_state) || "运行环境状态显示该提供商无法连接。",
    };
  }
  return { label: "等待测试", cls: "tag--muted", detail: "暂未执行网络连通性测试。" };
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
        AI 诊断向导
      </template>
      <template #lead>
        一键检测系统各项 AI 服务配置与网络连通性。不仅为您提供具体的配置修复建议，更能直接发起真实的网络探针探测。
      </template>
      <template #actions>
        <RouterLink to="/ai/home">
          <UiButton variant="outline">返回首页</UiButton>
        </RouterLink>
        <UiButton variant="primary" :busy="loading" @click="refresh">
          刷新诊断报告
        </UiButton>
      </template>
    </ConsoleHubMasthead>

    <div v-if="err" class="alert alert--err">{{ err }}</div>
    <div v-else-if="allChecksPassed" class="alert alert--ok">
      配置检查已通过！各项服务均处于良好状态，可前往 AI 观测了解运行详情。
    </div>
    <div v-else-if="wizardStatus?.next_step" class="alert alert--warn">
      <strong>当前急需处理：</strong>{{ wizardStatus.next_step }}
    </div>

    <section class="ai-wizard-page__summary">
      <UiCard class="ai-wizard-page__summary-card">
        <span class="ai-wizard-page__summary-label">扩展服务连接</span>
        <strong class="ai-wizard-page__summary-value" :class="wizardStatus?.ai_reachable ? 'text-ok' : 'text-danger'">
          {{ wizardStatus?.ai_reachable ? "连接正常" : "无法连接" }}
        </strong>
        <p class="muted ai-wizard-page__summary-text">
          {{ runtimeSummary || wizardStatus?.health_url || "尚未获取运行环境摘要" }}
        </p>
      </UiCard>
      <UiCard class="ai-wizard-page__summary-card">
        <span class="ai-wizard-page__summary-label">模型提供商 (Provider) 覆盖</span>
        <strong class="ai-wizard-page__summary-value">
          <span :class="wizardStatus?.providers_reachable ? 'text-ok' : 'text-muted'">{{ wizardStatus?.providers_reachable ?? 0 }}</span>
          / {{ wizardStatus?.providers_configured ?? 0 }}
        </strong>
        <p class="muted ai-wizard-page__summary-text">
          表示：连通状态良好 / 系统中已配置总数。
        </p>
      </UiCard>
      <UiCard class="ai-wizard-page__summary-card">
        <span class="ai-wizard-page__summary-label">活跃模型及工作模式</span>
        <strong class="ai-wizard-page__summary-value">{{ wizardStatus?.model || "未返回" }}</strong>
        <p class="muted ai-wizard-page__summary-text">
          工作模式：{{ wizardStatus?.provider_mode || "未返回" }}
        </p>
      </UiCard>
    </section>

    <section class="ai-wizard-page__checks">
      <UiCard
        v-for="row in checkRows"
        :key="row.id"
        class="ai-wizard-page__check"
        :class="{ 'is-fail': !row.ok }"
      >
        <div class="ai-wizard-page__check-head">
          <div class="ai-wizard-page__check-info">
            <h3 class="ai-wizard-page__check-title">{{ row.label }}</h3>
            <p class="muted ai-wizard-page__check-detail">{{ row.detail || "该检测项已满足要求" }}</p>
          </div>
          <span class="ai-wizard-page__pill" :class="{ 'is-ok': row.ok, 'is-warn': !row.ok }">
            {{ row.ok ? "检测通过" : "建议处理" }}
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
        <div class="ai-wizard-page__ops-info">
          <h3 class="ai-wizard-page__check-title">执行主动探针网络探测</h3>
          <p class="muted ai-wizard-page__check-detail">以下操作将发送真实的探测请求，排查网络连通和接口鉴权问题。</p>
        </div>
      </div>
      <div class="ai-wizard-page__actions">
        <UiButton variant="outline" :busy="extensionBusy" @click="runExtensionDiagnostic">
          测试扩展连通性
        </UiButton>
        <UiButton variant="outline" :busy="gatewayBusy" @click="runGatewayCheck">
          执行网关探测
        </UiButton>
        <UiButton variant="outline" :busy="providersBusy" :disabled="!providerRows.length" @click="runAllProviderTests">
          批量探测 Provider
        </UiButton>
      </div>
    </UiCard>

    <section class="ai-wizard-page__diag-grid">
      <UiCard class="ai-wizard-page__diag-card">
        <div class="ai-wizard-page__check-head">
          <div class="ai-wizard-page__check-info">
            <h3 class="ai-wizard-page__check-title">扩展服务健康接口</h3>
            <p class="muted ai-wizard-page__check-detail">返回扩展节点的探测地址、响应状态以及媒体并发信息。</p>
          </div>
          <RouterLink to="/ai/config/connection" class="ai-wizard-page__header-action">
            <UiButton variant="ghost" size="sm">连接设置</UiButton>
          </RouterLink>
        </div>
        <div v-if="extensionErr" class="alert alert--err">{{ extensionErr }}</div>
        <div v-else-if="extensionTest" class="ai-wizard-page__rows">
          <div class="ai-wizard-page__row">
            <span class="ai-wizard-page__row-key">网络状况</span>
            <strong class="ai-wizard-page__row-val" :class="extensionTest.ok ? 'text-ok' : 'text-danger'">
              {{ extensionTest.ok ? "访问成功" : "访问失败" }}
            </strong>
          </div>
          <div class="ai-wizard-page__row">
            <span class="ai-wizard-page__row-key">探针地址</span>
            <strong class="ai-wizard-page__row-val ai-wizard-page__row-val--wrap">{{ extensionTest.health_url }}</strong>
          </div>
          <div class="ai-wizard-page__row">
            <span class="ai-wizard-page__row-key">返回状态码</span>
            <strong class="ai-wizard-page__row-val">{{ extensionTest.status_code ?? "—" }}</strong>
          </div>
          <div v-if="extensionTest.error" class="ai-wizard-page__row">
            <span class="ai-wizard-page__row-key">异常信息</span>
            <strong class="ai-wizard-page__row-val ai-wizard-page__row-val--wrap">{{ extensionTest.error }}</strong>
          </div>
          
          <div v-if="extensionProviderRows.length" class="ai-wizard-page__subsection">
            <strong class="ai-wizard-page__subsection-title">通过节点获取的 Provider 状态</strong>
            <div class="ai-wizard-page__chip-list">
              <span
                v-for="row in extensionProviderRows"
                :key="row.id"
                class="tag"
                :class="row.reachable ? 'tag--ok' : 'tag--warn'"
              >
                {{ row.id }} · {{ row.reachable ? "在线" : "掉线" }}
              </span>
            </div>
          </div>
          
          <div v-if="extensionTest.media_tasks" class="ai-wizard-page__subsection">
            <strong class="ai-wizard-page__subsection-title">多媒体队列与并发</strong>
            <div class="ai-wizard-page__chip-list">
              <span class="tag tag--muted">排队中 {{ extensionTest.media_tasks.queue_depth }}</span>
              <span class="tag tag--ok">处理中 {{ extensionTest.media_tasks.active_tasks }}</span>
              <span class="tag tag--muted">历史总计 {{ extensionTest.media_tasks.total_tasks }}</span>
            </div>
            <div v-if="extensionMediaCapabilities.length" class="ai-wizard-page__mini-list">
              <div
                v-for="cap in extensionMediaCapabilities"
                :key="cap.capability"
                class="ai-wizard-page__row"
              >
                <span class="ai-wizard-page__row-key">{{ mediaCapabilityLabel(cap.capability) }}</span>
                <strong class="ai-wizard-page__row-val">{{ cap.queue_depth }} 待处理 / {{ cap.active_tasks }} 运行中</strong>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="ai-wizard-page__empty-state">
          <p class="muted">请点击上方按钮运行扩展连通测试，生成诊断报告。</p>
        </div>
      </UiCard>

      <UiCard class="ai-wizard-page__diag-card">
        <div class="ai-wizard-page__check-head">
          <div class="ai-wizard-page__check-info">
            <h3 class="ai-wizard-page__check-title">系统网关探测</h3>
            <p class="muted ai-wizard-page__check-detail">对服务网关（Service Gateways）执行探测，直接反馈其网络可达性及响应状况。</p>
          </div>
          <RouterLink to="/ai/config/draw" class="ai-wizard-page__header-action">
            <UiButton variant="ghost" size="sm">网关设置</UiButton>
          </RouterLink>
        </div>
        <div v-if="gatewayErr" class="alert alert--err">{{ gatewayErr }}</div>
        <template v-else-if="gatewayCheck">
          <ul v-if="gatewayCheck.lines.length" class="ai-wizard-page__line-list">
            <li v-for="line in gatewayCheck.lines" :key="line">{{ line }}</li>
          </ul>
          <RuntimeCheckResults :results="gatewayCheck.results" />
        </template>
        <div v-else class="ai-wizard-page__empty-state">
          <p class="muted">请点击上方按钮运行网关探测，获取诊断结果。</p>
        </div>
      </UiCard>
    </section>

    <UiCard class="ai-wizard-page__diag-card">
      <div class="ai-wizard-page__check-head">
        <div class="ai-wizard-page__check-info">
          <h3 class="ai-wizard-page__check-title">模型提供商 (Provider) 测试报告</h3>
          <p class="muted ai-wizard-page__check-detail">{{ providerSummaryText }}</p>
        </div>
        <RouterLink to="/ai/config/provider" class="ai-wizard-page__header-action">
          <UiButton variant="ghost" size="sm">进入 Provider 配置</UiButton>
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
            <div class="ai-wizard-page__provider-meta-group">
              <strong class="ai-wizard-page__provider-id">{{ row.id }}</strong>
              <p class="muted ai-wizard-page__provider-meta">
                {{ row.kind === "local" ? "本地直连" : "远程网络" }}
                <span v-if="row.default_model"> · 常用模型: {{ row.default_model }}</span>
                <span v-if="row.base_url"> · {{ row.base_url }}</span>
              </p>
            </div>
            <span class="tag ai-wizard-page__provider-status" :class="providerReachUi(row).cls">
              {{ providerReachUi(row).label }}
            </span>
          </div>
          <p class="muted ai-wizard-page__provider-detail">{{ providerReachUi(row).detail }}</p>
          <div class="ai-wizard-page__provider-actions">
            <UiButton
              variant="outline"
              size="sm"
              :busy="providerTests[row.id]?.testing"
              @click="runProviderTest(row.id)"
            >
              探测连接状态
            </UiButton>
          </div>
        </article>
      </div>
      <div v-else class="ai-wizard-page__empty-state">
        <p class="muted">还没有录入任何模型提供商。请先前往 Provider 配置页面添加。</p>
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.text-ok { color: var(--ok, #16a34a); }
.text-danger { color: var(--danger, #dc2626); }
.text-muted { color: var(--text-muted); }

.ai-wizard-page {
  display: grid;
  gap: 16px;
}

.ai-wizard-page__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.ai-wizard-page__summary-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.ai-wizard-page__summary-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.ai-wizard-page__summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.ai-wizard-page__summary-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.ai-wizard-page__checks {
  display: grid;
  gap: 16px;
}

.ai-wizard-page__check {
  padding: 18px 20px;
}

.ai-wizard-page__check.is-fail {
  border-color: color-mix(in srgb, var(--warn, #f59e0b) 45%, var(--border));
  background: color-mix(in srgb, var(--warn, #f59e0b) 6%, transparent);
}

.ai-wizard-page__check-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.ai-wizard-page__check-info {
  min-width: 0;
}

.ai-wizard-page__check-title {
  margin: 0 0 6px;
  font-size: 1.0625rem;
  font-weight: 600;
}

.ai-wizard-page__check-detail {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.ai-wizard-page__pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.ai-wizard-page__pill.is-ok {
  color: #16a34a;
  background: color-mix(in srgb, #16a34a 10%, transparent);
}

.ai-wizard-page__pill.is-warn {
  color: #d97706;
  background: color-mix(in srgb, #d97706 10%, transparent);
}

.ai-wizard-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ai-wizard-page__ops {
  padding: 24px;
  background: color-mix(in srgb, var(--bg-card) 95%, transparent);
  border: none;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.ai-wizard-page__ops-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.ai-wizard-page__diag-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.ai-wizard-page__diag-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--bg-card) 95%, transparent);
  border: none;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.ai-wizard-page__header-action {
  flex-shrink: 0;
}

.ai-wizard-page__rows {
  display: grid;
  gap: 12px;
}

.ai-wizard-page__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--text) 1.5%, transparent);
  border-radius: 8px;
}

.ai-wizard-page__row-key {
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
}

.ai-wizard-page__row-val {
  text-align: right;
  font-size: 0.875rem;
}

.ai-wizard-page__row-val--wrap {
  word-break: break-word;
}

.ai-wizard-page__subsection {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

.ai-wizard-page__subsection-title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.ai-wizard-page__chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-wizard-page__mini-list {
  display: grid;
  gap: 8px;
}

.ai-wizard-page__line-list {
  margin: 0;
  padding-left: 18px;
  color: var(--text-muted);
  font-size: 0.875rem;
  line-height: 1.6;
}

.ai-wizard-page__empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
}

.ai-wizard-page__provider-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.ai-wizard-page__provider {
  display: flex;
  flex-direction: column;
  padding: 20px;
  border: none;
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 2%, transparent);
}

.ai-wizard-page__provider.is-disabled {
  opacity: 0.7;
}

.ai-wizard-page__provider-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.ai-wizard-page__provider-meta-group {
  min-width: 0;
}

.ai-wizard-page__provider-id {
  font-size: 1.0625rem;
  font-weight: 600;
}

.ai-wizard-page__provider-meta {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.ai-wizard-page__provider-status {
  flex-shrink: 0;
}

.ai-wizard-page__provider-detail {
  margin: 0 0 16px;
  font-size: 0.875rem;
  line-height: 1.5;
  flex-grow: 1;
}

.ai-wizard-page__provider-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 960px) {
  .ai-wizard-page__diag-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .ai-wizard-page__ops-head,
  .ai-wizard-page__check-head {
    flex-direction: column;
  }

  .ai-wizard-page__row {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  .ai-wizard-page__row-val {
    text-align: left;
  }
  
  .ai-wizard-page__actions .ui-btn {
    width: 100%;
  }

  .ai-wizard-page__header-action {
    align-self: stretch;
  }

  .ai-wizard-page__header-action .ui-btn {
    width: 100%;
  }
}
</style>
