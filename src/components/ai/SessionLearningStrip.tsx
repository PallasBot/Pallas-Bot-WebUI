import { Link } from "react-router-dom";
import type { ConversationKernelStatus } from "@/api/pallasTypes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function learningLoopHint(status: ConversationKernelStatus | undefined): {
  kind: "ok" | "warn" | "idle";
  text: string;
} {
  if (!status) return { kind: "idle", text: "正在读取学习状态…" };
  if (!status.feedback_collect_active) {
    return {
      kind: "warn",
      text: "反哺收集未开。可在 AI 配置 → 对话 → 策略中打开「收集 LLM 对话反哺」。",
    };
  }
  if (!status.feedback_bias_active) {
    return {
      kind: "warn",
      text: "已在收集反哺，但打分加权未开；排除/期望回复暂不影响接话。",
    };
  }
  if (!status.writeback_active) {
    return {
      kind: "ok",
      text: "反哺加权已开。可在会话里排除坏样本；写回语料需另开开关。",
    };
  }
  return {
    kind: "ok",
    text: "学习闭环已接通：可排除坏样本，并把升格候选写入接话语料。",
  };
}

export default function SessionLearningStrip({
  status,
  className,
}: {
  status: ConversationKernelStatus | undefined;
  className?: string;
}) {
  const hint = learningLoopHint(status);
  if (hint.kind === "ok" && status?.writeback_active) return null;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-xs leading-relaxed",
        hint.kind === "warn"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-border bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1">{hint.text}</p>
        {hint.kind === "warn" ? (
          <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" asChild>
            <Link to="/ai/config/dialogue?panel=form">去开启</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
