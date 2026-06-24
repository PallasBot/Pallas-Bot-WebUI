<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { changeConsoleLogin } from "@/api/consoleApi";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import {
  consoleSetupSatisfied,
  consoleSetupStatus,
  consoleSetupStatusError,
  consoleSetupStatusKnown,
  loadConsoleSetupStatus,
} from "@/state/consoleSetup";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

const route = useRoute();
const router = useRouter();
const panelNavIcon = usePanelNavIcon();

const pwdErr = ref("");
const pwdOk = ref("");
const p1 = ref("");
const p2 = ref("");
const pwdBusy = ref(false);
const statusBusy = ref(false);

const redirectTarget = computed(() => {
  const raw = route.query.redirect;
  if (typeof raw === "string" && raw.startsWith("/")) {
    return raw;
  }
  return "/ai/home";
});

const requiresSetup = computed(() => Boolean(consoleSetupStatus.value?.requires_setup));
const defaultPasswordActive = computed(() => Boolean(consoleSetupStatus.value?.default_password_active));
const setupCompleted = computed(() => consoleSetupSatisfied(consoleSetupStatus.value));
const setupStatusKnown = computed(() => consoleSetupStatusKnown.value);
const setupStatusErrorText = computed(() => consoleSetupStatusError.value);
const canEnterAiFlow = computed(() => setupStatusKnown.value && setupCompleted.value);
const canContinueAfterSetup = computed(() => setupStatusKnown.value && setupCompleted.value);

async function refreshStatus(force = false) {
  statusBusy.value = true;
  try {
    await loadConsoleSetupStatus({ force });
  } finally {
    statusBusy.value = false;
  }
}

async function submitPassword() {
  pwdErr.value = "";
  pwdOk.value = "";
  if (p1.value.length < 8) {
    pwdErr.value = "新口令至少 8 位。";
    return;
  }
  if (p1.value !== p2.value) {
    pwdErr.value = "两次输入不一致。";
    return;
  }
  pwdBusy.value = true;
  try {
    const result = await changeConsoleLogin(p1.value);
    pwdOk.value = result.message || "已更新。";
    toastSaveSuccess("控制台口令已更新");
    p1.value = "";
    p2.value = "";
    await refreshStatus(true);
  } catch (e) {
    pwdErr.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "更新失败");
  } finally {
    pwdBusy.value = false;
  }
}

function continueAfterSetup() {
  void router.push(redirectTarget.value);
}

onMounted(() => {
  void refreshStatus(true);
});

onActivated(() => {
  void refreshStatus();
});
</script>

<template>
  <div class="console-hub-page setup-wizard-page">
    <ConsoleHubMasthead :icon="panelNavIcon">
      <template #title>
        首次 Setup Wizard
      </template>
      <template #lead>
        先完成控制台口令改密，再继续进入其它页面；完成后可以顺手做一遍 AI 基础体检。
      </template>
      <template #actions>
        <UiButton variant="ghost" :busy="statusBusy" @click="refreshStatus(true)">
          重新检查
        </UiButton>
        <RouterLink v-if="canEnterAiFlow" to="/ai/wizard">
          <UiButton variant="outline">AI 体检</UiButton>
        </RouterLink>
      </template>
    </ConsoleHubMasthead>

    <div v-if="!setupStatusKnown && setupStatusErrorText" class="alert alert--warn">
      当前无法确认首次引导状态：{{ setupStatusErrorText }}。为避免绕过改密流程，需先重试检查或完成状态恢复。
    </div>
    <div v-if="requiresSetup" class="alert alert--warn">
      当前仍处于首次引导阶段，其他页面会先收口到这里。
      <span v-if="defaultPasswordActive">默认口令仍有效，请立即改密。</span>
    </div>
    <div v-else-if="setupCompleted" class="alert alert--ok">
      控制台首次引导已完成，可以继续进入其它页面。
    </div>

    <section class="setup-wizard-page__grid">
      <UiCard class="setup-wizard-page__card">
        <div class="setup-wizard-page__card-head">
          <div>
            <h3 class="setup-wizard-page__title">步骤 1 · 改控制台口令</h3>
            <p class="muted setup-wizard-page__lead">口令至少 8 位；保存后会自动刷新 setup 状态。</p>
          </div>
          <span class="setup-wizard-page__pill" :class="{ 'is-done': setupCompleted, 'is-warn': requiresSetup }">
            {{ setupCompleted ? "已完成" : "待处理" }}
          </span>
        </div>

        <div v-if="pwdErr" class="alert alert--err setup-wizard-page__inline-alert">{{ pwdErr }}</div>
        <div v-if="pwdOk" class="alert alert--ok setup-wizard-page__inline-alert">{{ pwdOk }}</div>

        <div class="setup-wizard-page__field">
          <label class="setup-wizard-page__label">新口令</label>
          <input
            v-model="p1"
            class="inp"
            type="password"
            autocomplete="new-password"
          >
        </div>
        <div class="setup-wizard-page__field">
          <label class="setup-wizard-page__label">确认口令</label>
          <input
            v-model="p2"
            class="inp"
            type="password"
            autocomplete="new-password"
          >
        </div>
        <div class="setup-wizard-page__actions">
          <UiButton variant="primary" :busy="pwdBusy" @click="submitPassword">
            {{ pwdBusy ? "提交中…" : "保存口令" }}
          </UiButton>
          <RouterLink to="/preferences#console-password">
            <UiButton variant="ghost">前往偏好页</UiButton>
          </RouterLink>
        </div>
      </UiCard>

      <UiCard class="setup-wizard-page__card">
        <div class="setup-wizard-page__card-head">
          <div>
            <h3 class="setup-wizard-page__title">步骤 2 · 检查 AI 基础能力</h3>
            <p class="muted setup-wizard-page__lead">确认 AI 服务可达、Provider 已配置且智能对话总闸已开启。</p>
          </div>
          <span class="setup-wizard-page__pill">可选但推荐</span>
        </div>

        <div class="setup-wizard-page__action-stack">
          <RouterLink v-if="canEnterAiFlow" to="/ai/wizard">
            <UiButton variant="outline" block>打开 AI 体检向导</UiButton>
          </RouterLink>
          <UiButton v-else variant="outline" block disabled>完成改密后可进入 AI 体检</UiButton>
          <RouterLink v-if="canEnterAiFlow" to="/ai/home">
            <UiButton variant="ghost" block>查看 AI 首页</UiButton>
          </RouterLink>
          <UiButton v-else variant="ghost" block disabled>完成改密后可查看 AI 首页</UiButton>
        </div>
      </UiCard>
    </section>

    <UiCard class="setup-wizard-page__card">
      <div class="setup-wizard-page__card-head">
        <div>
          <h3 class="setup-wizard-page__title">完成后去哪里</h3>
          <p class="muted setup-wizard-page__lead">如果你是从其他页面被收口过来的，完成后可以直接回去。</p>
        </div>
      </div>
      <div class="setup-wizard-page__actions">
        <UiButton variant="primary" :disabled="!canContinueAfterSetup" @click="continueAfterSetup">
          继续到 {{ redirectTarget }}
        </UiButton>
        <RouterLink to="/">
          <UiButton variant="ghost">回到仪表盘</UiButton>
        </RouterLink>
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.setup-wizard-page {
  display: grid;
  gap: 16px;
}

.setup-wizard-page__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.setup-wizard-page__card {
  display: grid;
  gap: 14px;
}

.setup-wizard-page__card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.setup-wizard-page__title {
  margin: 0 0 4px;
  font-size: 1rem;
}

.setup-wizard-page__lead {
  margin: 0;
  line-height: 1.5;
}

.setup-wizard-page__pill {
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

.setup-wizard-page__pill.is-done {
  border-color: color-mix(in srgb, #2e9b5f 40%, transparent);
  color: #2e9b5f;
}

.setup-wizard-page__pill.is-warn {
  border-color: color-mix(in srgb, #d08b00 45%, transparent);
  color: #d08b00;
}

.setup-wizard-page__inline-alert {
  margin: 0;
}

.setup-wizard-page__field {
  display: grid;
  gap: 6px;
}

.setup-wizard-page__label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.setup-wizard-page__actions,
.setup-wizard-page__action-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.setup-wizard-page__action-stack {
  flex-direction: column;
}

@media (max-width: 860px) {
  .setup-wizard-page__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .setup-wizard-page__card-head {
    flex-direction: column;
  }

  .setup-wizard-page__actions {
    flex-direction: column;
  }
}
</style>
