import type { LlmRepeaterFeedbackEntry } from "@/api/pallasTypes";
import { formatTs } from "@/api/console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { labelLlmRoute, labelScene } from "@/utils/aiHistoryLabels";
import { feedbackEntryKey } from "@/utils/aiHistorySessionMatch";
import { cn } from "@/lib/utils";

export function SessionTurnFeedbackControls({
  entry,
  busy,
  correctionDraft,
  onCorrectionChange,
  onManage,
  onSaveCorrection,
  onClearCorrection,
  className,
}: {
  entry: LlmRepeaterFeedbackEntry | null;
  busy?: boolean;
  correctionDraft: string;
  onCorrectionChange: (value: string) => void;
  onManage: (action: "invalidate" | "restore" | "delete") => void;
  onSaveCorrection: () => void;
  onClearCorrection: () => void;
  className?: string;
}) {
  return (
    <div className={cn("mt-2 space-y-2 rounded-xl border bg-background/70 p-2.5 text-xs", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={entry?.eligible_for_bias ? "success" : entry ? "secondary" : "outline"}>
          {!entry ? "未收录反哺" : entry.eligible_for_bias ? "参与学习" : "已排除"}
        </Badge>
        {entry?.behavior_scene ? <Badge variant="outline">{labelScene(entry.behavior_scene)}</Badge> : null}
        {entry?.llm_route ? <Badge variant="muted">{labelLlmRoute(entry.llm_route)}</Badge> : null}
      </div>

      {entry ? (
        <div className="flex flex-wrap gap-1.5">
          {entry.eligible_for_bias ? (
            <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => onManage("invalidate")}>
              排除
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => onManage("restore")}>
              恢复
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-destructive"
            disabled={busy}
            onClick={() => onManage("delete")}
          >
            删除
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground">此回复未收录，仍可填写期望回复写入语料。</p>
      )}

      <div className="space-y-1.5">
        <label className="text-muted-foreground">期望回复</label>
        <Textarea
          value={correctionDraft}
          onChange={(e) => onCorrectionChange(e.target.value)}
          placeholder="输入期望的回复内容"
          rows={2}
          className="min-h-[3.5rem] resize-y text-xs"
          disabled={busy}
        />
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            className="h-7"
            disabled={busy || !correctionDraft.trim()}
            onClick={onSaveCorrection}
          >
            保存期望回复
          </Button>
          {entry?.corrected_reply_text ? (
            <Button size="sm" variant="ghost" className="h-7" disabled={busy} onClick={onClearCorrection}>
              清除校正
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SessionFeedbackCard({
  item,
  busy,
  correctionDraft,
  onCorrectionChange,
  onManage,
  onSaveCorrection,
  onClearCorrection,
}: {
  item: LlmRepeaterFeedbackEntry;
  busy?: boolean;
  correctionDraft: string;
  onCorrectionChange: (value: string) => void;
  onManage: (action: "invalidate" | "restore" | "delete") => void;
  onSaveCorrection: () => void;
  onClearCorrection: () => void;
}) {
  const key = feedbackEntryKey(item);
  return (
    <article key={key} className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words font-medium leading-relaxed">
          {item.reply_text || "—"}
        </p>
        <Badge variant={item.eligible_for_bias ? "success" : "secondary"}>
          {item.eligible_for_bias ? "参与学习" : "已排除"}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{labelScene(item.behavior_scene)}</span>
        {item.llm_route ? (
          <>
            <span aria-hidden>·</span>
            <span>{labelLlmRoute(item.llm_route)}</span>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <span>{formatTs(item.created_at)}</span>
        {item.user_text ? (
          <>
            <span aria-hidden>·</span>
            <span className="line-clamp-1">触发：{item.user_text}</span>
          </>
        ) : null}
      </div>
      {item.corrected_reply_text ? (
        <p className="rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
          期望：{item.corrected_reply_text}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {item.eligible_for_bias ? (
          <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => onManage("invalidate")}>
            排除
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => onManage("restore")}>
            恢复
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-destructive"
          disabled={busy}
          onClick={() => onManage("delete")}
        >
          删除
        </Button>
      </div>
      <div className="space-y-1.5">
        <Textarea
          value={correctionDraft}
          onChange={(e) => onCorrectionChange(e.target.value)}
          placeholder="输入期望的回复内容"
          rows={2}
          className="min-h-[3rem] resize-y text-xs"
          disabled={busy}
        />
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            className="h-7"
            disabled={busy || !correctionDraft.trim()}
            onClick={onSaveCorrection}
          >
            保存期望
          </Button>
          {item.corrected_reply_text ? (
            <Button size="sm" variant="ghost" className="h-7" disabled={busy} onClick={onClearCorrection}>
              清除
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
