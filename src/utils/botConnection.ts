import type { BotRow } from "@/api/pallasTypes";

/** 账号是否在消息框架当前连接列表中（用于「已连接 / 未连接」胶囊） */
export function accountHasNonebotBot(rows: BotRow[] | undefined, account: number): boolean {
  const sid = String(account);
  return (rows ?? []).some((b) => String(b.self_id) === sid);
}
