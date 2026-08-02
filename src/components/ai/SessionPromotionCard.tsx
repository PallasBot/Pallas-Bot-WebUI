import type { LlmPromotionCandidate } from "@/api/pallasTypes";
import { formatTs } from "@/api/console";
import { Archive, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labelScene, labelWritebackMessage, labelWritebackStatus } from "@/utils/aiHistoryLabels";

export function promotionStatusLabel(item: LlmPromotionCandidate): string {
  if (item.promoted) {
    const wb = String(item.writeback_status || "").trim();
    if (wb === "written") return "已入库并写回";
    if (wb === "failed") return "已入库但写回失败";
    return "已入库";
  }
  if (String(item.rejected_reason || "").trim()) return "已拒绝";
  return "待审批";
}

export function promotionWritebackHint(item: LlmPromotionCandidate): string {
  const wb = String(item.writeback_status || "").trim();
  if (!wb) return "";
  const status = labelWritebackStatus(wb);
  if (wb === "written") {
    const msg = labelWritebackMessage(item.writeback_message);
    return msg || status;
  }
  if (wb === "failed") {
    const msg = labelWritebackMessage(item.writeback_message);
    return msg ? `写回失败：${msg}` : status;
  }
  return status;
}

export default function SessionPromotionCard({
  item,
  busy,
  onResolve,
}: {
  item: LlmPromotionCandidate;
  busy?: boolean;
  onResolve: (action: "promote" | "reject") => void;
}) {
  const pending = !item.promoted && !String(item.rejected_reason || "").trim();
  const status = promotionStatusLabel(item);
  const hint = promotionWritebackHint(item);

  return (
    <article className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words font-medium leading-relaxed">
          {item.reply_text || "—"}
        </p>
        <Badge variant={item.promoted ? "success" : pending ? "outline" : "secondary"}>{status}</Badge>
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>支持 {item.support_count} 次</span>
        {item.behavior_scene ? (
          <>
            <span aria-hidden>·</span>
            <span>{labelScene(item.behavior_scene)}</span>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <span>{formatTs(item.last_seen_at)}</span>
        {hint ? (
          <>
            <span aria-hidden>·</span>
            <span>{hint}</span>
          </>
        ) : null}
      </div>
      <p className="line-clamp-3 text-xs text-muted-foreground">触发：{item.trigger_text || "—"}</p>
      {pending ? (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" className="h-7" icon={Archive} disabled={busy} onClick={() => onResolve("promote")}>
            入库
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            icon={X}
            iconMotion="close"
            disabled={busy}
            onClick={() => onResolve("reject")}
          >
            拒绝
          </Button>
        </div>
      ) : null}
    </article>
  );
}
