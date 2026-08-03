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
import { restartProgressSteps } from "@/utils/botRestartProgress";

/** Bot 重启进度：shadcn Dialog，标题左对齐。 */
export default function BotRestartProgressDialog() {
  const session = useSyncExternalStore(subscribeBotRestartSession, getBotRestartSession, getBotRestartSession);
  const inProgress = botRestartInProgress(session);
  const steps = restartProgressSteps(session.phase, inProgress);
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
          <p className="sr-only" role="status" aria-live="polite">
            {botRestartProgressLabel(session)}
          </p>

          {inProgress || session.progressPercent > 0 ? (
            <div className="bot-restart-dialog__timeline">
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
              <ol className="bot-restart-dialog__steps" aria-label="重启进度">
                {steps.map((step) => (
                  <li
                    key={step.id}
                    className={`bot-restart-dialog__step bot-restart-dialog__step--${step.state}`}
                    aria-current={step.state === "active" || step.state === "current" ? "step" : undefined}
                    aria-hidden={step.state === "hidden"}
                  >
                    <span className="bot-restart-dialog__step-dot" aria-hidden="true" />
                    <span className="bot-restart-dialog__step-label">{step.label}</span>
                  </li>
                ))}
              </ol>
              <p className="bot-restart-dialog__percent" aria-hidden="true">
                {Math.round(session.progressPercent)}%
              </p>
            </div>
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
