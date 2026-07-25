import type { ConsoleDailyStatRow } from "@/api/pallasTypes";
import GsDualAxisTrendChart from "@/components/GsDualAxisTrendChart";

export default function ChartsMonthlyCommandChart({
  rows,
  emptyText = "所选月份暂无持久化数据，请保持 Bot 运行并跨日写入。",
  busy = false,
}: {
  rows: ConsoleDailyStatRow[];
  emptyText?: string;
  busy?: boolean;
}) {
  return (
    <GsDualAxisTrendChart
      chartUid="charts-monthly-cmd"
      className="charts-monthly-cmd"
      rows={rows}
      emptyText={emptyText}
      busy={busy}
      showSummary
    />
  );
}
