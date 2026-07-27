import { useSyncExternalStore } from "react";
import "@/styles/bot-restart-dialog.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** Bot 重启进度：shadcn Dialog，标题左对齐。 */
export default function BotRestartProgressDialog() {
  const session = useSyncExternalStore(subscribeBotRestartSession, getBotRestartSession, getBotRestartSession);
  const inProgress = botRestartInProgress(session);
  const stepIdx = activeStepIndex(session.phase);
  const subtitle =
    session.phase === "timeout" || session.phase === "failed"
      ? "重启未在预期时间内完成，请查看 Bot 日志或手动确认进程状态。"
      : "重启期间 API 会短暂不可用，请勿关闭本页。";

  return (
    <Dialog
      open={session.open}
      onOpenChange={(next) => {
        if (!next && !inProgress) resetBotRestartSession();
      }}
    >
      <DialogContent
        className="bot-restart-dialog flex w-[min(420px,96vw)] max-w-[min(420px,96vw)] gap-0 overflow-hidden bg-card p-0"
        onEscapeKeyDown={(e) => {
          if (inProgress) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (inProgress) e.preventDefault();
        }}
      >
        <DialogHeader className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left">
          <DialogTitle id="bot-restart-progress-title">
            {session.phase === "online" ? "Bot 已恢复" : "正在重启 Bot"}
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="bot-restart-dialog__bd space-y-3 px-4 py-3">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
