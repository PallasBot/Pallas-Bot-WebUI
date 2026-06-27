/** 紧凑时间格式（月/日 时:分），用于 AI 历史 / 会话明细等列表场景。 */
export function formatCompactDateTime(tsSeconds: number): string {
  if (!tsSeconds) return "—";
  return new Date(tsSeconds * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 相对日期标签：今日 / 昨日；更早返回 null。 */
export function formatRelativeDayLabel(tsSeconds: number, now = new Date()): "今日" | "昨日" | null {
  if (!tsSeconds) return null;
  const target = new Date(tsSeconds * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((todayStart.getTime() - targetStart.getTime()) / 86_400_000);
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  return null;
}
