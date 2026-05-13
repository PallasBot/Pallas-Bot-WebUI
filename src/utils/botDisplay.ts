/** 控制台中隐藏已弃用的 OneBot V11 / OB11 适配器展示（数据面仍可能存在于后端）。 */
export function isOb11LikeAdapter(adapter: string | undefined | null): boolean {
  if (!adapter) return false;
  const s = adapter.trim().toLowerCase();
  return (
    s === "ob11" ||
    s.includes("onebot v11") ||
    s.includes("onebotv11") ||
    /\bv11\b/.test(s)
  );
}

export function visibleBots<T extends { adapter: string }>(rows: T[] | undefined): T[] {
  return (rows ?? []).filter((b) => !isOb11LikeAdapter(b.adapter));
}

/** QQ 头像（腾讯 CDN），用于控制台展示；失败时由 img @error 处理。 */
export function qqAvatarUrl(uin: number | string): string {
  const n = typeof uin === "string" ? parseInt(uin.replace(/\s/g, ""), 10) : uin;
  if (!Number.isFinite(n) || n < 1) return "";
  return `https://q1.qlogo.cn/g?b=qq&nk=${n}&s=160`;
}
