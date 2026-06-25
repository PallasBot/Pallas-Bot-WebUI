<script setup lang="ts">
import { computed } from "vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import {
  botRestartDialogOpen,
  botRestartErr,
  botRestartInProgress,
  botRestartPhase,
  botRestartProgressLabel,
  resetBotRestartSession,
} from "@/state/botRestartSession";

const phaseSteps = [
  { id: "scheduled", label: "已发送指令" },
  { id: "disconnecting", label: "进程退出" },
  { id: "reconnecting", label: "等待恢复" },
  { id: "online", label: "恢复在线" },
] as const;

const activeStepIndex = computed(() => {
  switch (botRestartPhase.value) {
    case "scheduled":
      return 0;
    case "disconnecting":
      return 1;
    case "reconnecting":
      return 2;
    case "online":
      return 3;
    case "timeout":
    case "failed":
      return 2;
    default:
      return 0;
  }
});

const dialogSubtitle = computed(() => {
  if (botRestartPhase.value === "timeout" || botRestartPhase.value === "failed") {
    return "重启未在预期时间内完成，请查看 Bot 日志或手动确认进程状态。";
  }
  return "重启期间 API 会短暂不可用，请勿关闭本页。";
});

function closeDialog() {
  if (botRestartInProgress.value) return;
  resetBotRestartSession();
}
</script>

<template>
  <UiDialog
    :open="botRestartDialogOpen"
    title-id="bot-restart-progress-title"
    panel-class="bot-restart-dialog"
    body-class="bot-restart-dialog__bd"
    :close-on-backdrop="!botRestartInProgress"
    :busy="botRestartInProgress"
    @close="closeDialog"
  >
    <template #header>
      <div class="console-modal__head-text">
        <h2
          id="bot-restart-progress-title"
          class="console-modal__title"
        >
          {{ botRestartPhase === "online" ? "Bot 已恢复" : "正在重启 Bot" }}
        </h2>
        <p class="console-modal__subtitle">
          {{ dialogSubtitle }}
        </p>
      </div>
      <button
        v-if="!botRestartInProgress"
        type="button"
        class="console-modal__close"
        aria-label="关闭"
        @click="closeDialog"
      >
        ×
      </button>
    </template>

    <p
      class="bot-restart-dialog__status"
      role="status"
      aria-live="polite"
    >
      {{ botRestartProgressLabel }}
    </p>

    <ol
      class="bot-restart-dialog__steps"
      aria-label="重启进度"
    >
      <li
        v-for="(step, index) in phaseSteps"
        :key="step.id"
        class="bot-restart-dialog__step"
        :class="{
          'bot-restart-dialog__step--done': index < activeStepIndex,
          'bot-restart-dialog__step--active': index === activeStepIndex && botRestartInProgress,
          'bot-restart-dialog__step--current': index === activeStepIndex,
        }"
      >
        <span
          class="bot-restart-dialog__step-dot"
          aria-hidden="true"
        />
        <span>{{ step.label }}</span>
      </li>
    </ol>

    <div
      v-if="botRestartInProgress"
      class="bot-restart-dialog__progress"
      aria-hidden="true"
    />

    <p
      v-if="botRestartErr"
      class="alert alert--err bot-restart-dialog__err"
      role="alert"
    >
      {{ botRestartErr }}
    </p>
  </UiDialog>
</template>

<style scoped>
.bot-restart-dialog__status {
  margin: 0 0 14px;
  font-size: 0.95rem;
}
.bot-restart-dialog__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.bot-restart-dialog__step {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 0.9rem;
}
.bot-restart-dialog__step-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 35%, transparent);
  flex-shrink: 0;
}
.bot-restart-dialog__step--done {
  color: var(--text);
}
.bot-restart-dialog__step--done .bot-restart-dialog__step-dot {
  background: var(--accent);
}
.bot-restart-dialog__step--current {
  color: var(--text);
  font-weight: 600;
}
.bot-restart-dialog__step--active .bot-restart-dialog__step-dot {
  background: var(--accent);
  animation: bot-restart-step-pulse 1.1s ease-in-out infinite;
}
.bot-restart-dialog__progress {
  margin-top: 16px;
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 24%, transparent);
  overflow: hidden;
  position: relative;
}
.bot-restart-dialog__progress::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 42%;
  border-radius: inherit;
  background: var(--accent);
  animation: bot-restart-progress 1.1s ease-in-out infinite;
}
.bot-restart-dialog__err {
  margin: 14px 0 0;
}
@keyframes bot-restart-progress {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(280%); }
}
@keyframes bot-restart-step-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
@media (max-width: 560px) {
  .bot-restart-dialog__status {
    font-size: 0.92rem;
  }
}
</style>
