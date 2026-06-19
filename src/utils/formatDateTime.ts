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
