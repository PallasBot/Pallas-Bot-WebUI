import TokenDonutChart from "@/components/ai/TokenDonutChart";
import TokenShareBars from "@/components/ai/TokenShareBars";
import { type TokenRow } from "@/utils/aiTaskStats";

/**
 * 占比可视化：少类目且不过分一边倒用甜甜圈，否则水平条。
 * 强制环图可传 prefer="donut"（命中/失败这类 2～3 项结果）。
 */
export default function ShareDistribution({
  rows,
  emptyText = "暂无数据",
  limit = 8,
  prefer,
  centerTitle,
  centerValue,
  className,
}: {
  rows: TokenRow[];
  emptyText?: string;
  limit?: number;
  prefer?: "auto" | "donut" | "bars";
  centerTitle?: string;
  centerValue?: string;
  className?: string;
}) {
  const top = rows.slice(0, limit);
  const total = top.reduce((s, r) => s + r.totalTokens, 0);
  if (total <= 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  const topShare = top[0]!.totalTokens / total;
  const mode =
    prefer === "donut" || prefer === "bars"
      ? prefer
      : top.length >= 2 && top.length <= 5 && topShare < 0.8
        ? "donut"
        : "bars";

  if (mode === "donut") {
    return (
      <TokenDonutChart
        rows={top}
        limit={limit}
        emptyText={emptyText}
        centerTitle={centerTitle}
        centerValue={centerValue}
        className={className}
      />
    );
  }
  return <TokenShareBars rows={top} limit={limit} emptyText={emptyText} className={className} />;
}
