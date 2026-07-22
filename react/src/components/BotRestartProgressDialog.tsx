import { useSyncExternalStore } from "react";
import ConsoleModal from "@/components/ConsoleModal";
import {
  botRestartInProgress,
  botRestartProgressLabel,
  getBotRestartSession,
  resetBotRestartSession,
  subscribeBotRestartSession,
} from "@/state/botRestartSession";

const phaseSteps = [
  { id: "scheduled", label: "已发送指令" },
  { id: "disconnecting", label: "进程退出" },
  { id: "reconnecting", label: "等待恢复" },
  { id: "online", label: "恢复在线" },
] as const;

function activeStepIndex(phase: string): number {
  switch (phase) {
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
}

export default function BotRestartProgressDialog() {
  const session = useSyncExternalStore(subscribeBotRestartSession, getBotRestartSession, getBotRestartSession);
  const inProgress = botRestartInProgress(session);
  const stepIdx = activeStepIndex(session.phase);
  const subtitle =
    session.phase === "timeout" || session.phase === "failed"
      ? "重启未在预期时间内完成，请查看 Bot 日志或手动确认进程状态。"
      : "重启期间 API 会短暂不可用，请勿关闭本页。";

  return (
    <ConsoleModal
      open={session.open}
      titleId="bot-restart-progress-title"
      panelClass="bot-restart-dialog"
      bodyClass="bot-restart-dialog__bd"
      busy={inProgress}
      onClose={() => {
        if (!inProgress) resetBotRestartSession();
      }}
      header={
        <>
          <div className="console-modal__head-text">
            <h2 id="bot-restart-progress-title" className="console-modal__title">
              {session.phase === "online" ? "Bot 已恢复" : "正在重启 Bot"}
            </h2>
            <p className="console-modal__subtitle">{subtitle}</p>
          </div>
          {!inProgress ? (
            <button
              type="button"
              className="console-modal__close"
              aria-label="关闭"
              onClick={() => resetBotRestartSession()}
            >
              ×
            </button>
          ) : null}
        </>
      }
    >
      <p className="bot-restart-dialog__status" role="status" aria-live="polite">
        {botRestartProgressLabel(session)}
      </p>

      <ol className="bot-restart-dialog__steps" aria-label="重启进度">
        {phaseSteps.map((step, index) => (
          <li
            key={step.id}
            className={
              "bot-restart-dialog__step"
              + (index < stepIdx ? " bot-restart-dialog__step--done" : "")
              + (index === stepIdx && inProgress ? " bot-restart-dialog__step--active" : "")
              + (index === stepIdx ? " bot-restart-dialog__step--current" : "")
            }
          >
            <span className="bot-restart-dialog__step-dot" aria-hidden="true" />
            <span>{step.label}</span>
          </li>
        ))}
      </ol>

      {inProgress || session.progressPercent > 0 ? (
        <>
          <div
            className="bot-restart-dialog__progress"
            role="progressbar"
            aria-valuenow={session.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`重启进度 ${session.progressPercent}%`}
          >
            <div
              className="bot-restart-dialog__progress-fill"
              style={{ width: `${session.progressPercent}%` }}
            />
          </div>
          <p className="bot-restart-dialog__percent" aria-hidden="true">
            {Math.round(session.progressPercent)}%
          </p>
        </>
      ) : null}

      {session.err ? (
        <p className="alert alert--err bot-restart-dialog__err" role="alert">
          {session.err}
        </p>
      ) : null}
    </ConsoleModal>
  );
}
