import type { BotRow, InstancesData } from "@/api/pallasTypes";

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

/**
 * 好友/群等按账号维度选择：合并消息框架当前连接与数据库中的 Bot 配置。
 * 不过滤 OneBot V11（NapCat 等仍使用该适配器名）；未在线的账号用占位行展示。
 */
export function botPickerRowsFromInstances(inst: InstancesData | null | undefined): BotRow[] {
  const onlineSelfIds = new Set<string>();
  const bySelf = new Map<string, BotRow>();
  for (const b of inst?.nonebot_bots ?? []) {
    const sid = String(b.self_id ?? "").trim();
    if (!sid || sid === "?") continue;
    onlineSelfIds.add(sid);
    bySelf.set(sid, { ...b, self_id: sid });
  }
  for (const c of inst?.db_bot_configs ?? []) {
    const sid = String(c.account);
    if (bySelf.has(sid)) continue;
    bySelf.set(sid, {
      connection_key: `db:${sid}`,
      self_id: sid,
      adapter: "未连接",
    });
  }
  const profiles = inst?.bot_profiles ?? {};
  const rows = [...bySelf.values()];
  rows.sort((a, b) => {
    const oa = onlineSelfIds.has(a.self_id) ? 1 : 0;
    const ob = onlineSelfIds.has(b.self_id) ? 1 : 0;
    if (oa !== ob) return ob - oa;
    const na = (profiles[a.self_id]?.nickname?.trim() || "").toLowerCase();
    const nb = (profiles[b.self_id]?.nickname?.trim() || "").toLowerCase();
    const cmp = na.localeCompare(nb, "zh-CN");
    if (cmp !== 0) return cmp;
    return String(a.self_id).localeCompare(String(b.self_id), "zh-CN", { numeric: true });
  });
  return rows;
}

/** QQ 头像（腾讯 CDN），用于控制台展示；失败时由 img @error 处理。 */
export function qqAvatarUrl(uin: number | string): string {
  const n = typeof uin === "string" ? parseInt(uin.replace(/\s/g, ""), 10) : uin;
  if (!Number.isFinite(n) || n < 1) return "";
  return `https://q1.qlogo.cn/g?b=qq&nk=${n}&s=160`;
}

/** 触发器短文案：有昵称只显示昵称，无昵称才回退账号。 */
export function botSelectTriggerLabel(
  nickname: string | undefined | null,
  account: string | number,
): string {
  const nick = String(nickname ?? "").trim();
  if (nick) return nick;
  return String(account).trim() || "Bot";
}

/** 下拉完整文案：昵称（账号）；无昵称则仅账号。 */
export function botSelectDropdownLabel(
  nickname: string | undefined | null,
  account: string | number,
): string {
  const id = String(account).trim();
  const nick = String(nickname ?? "").trim();
  if (nick) return `${nick}（${id}）`;
  return id || "Bot";
}

export function botProfileNick(
  profiles: InstancesData["bot_profiles"] | undefined | null,
  account: string | number,
): string {
  return profiles?.[String(account)]?.nickname?.trim() || "";
}
