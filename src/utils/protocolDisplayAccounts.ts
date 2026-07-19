import type { BotRow, InstancesData, NapcatAccountRow } from "@/api/pallasTypes";

export const PROTOCOL_ACCOUNT_SOURCE_PLUGIN = "plugin";
export const PROTOCOL_ACCOUNT_SOURCE_EXTERNAL = "external";

export function isExternalProtocolAccount(account: NapcatAccountRow): boolean {
  return account.account_source === PROTOCOL_ACCOUNT_SOURCE_EXTERNAL;
}

export function isPluginManagedProtocolAccount(account: NapcatAccountRow): boolean {
  return !isExternalProtocolAccount(account);
}

function pluginAccountSelfIds(accounts: readonly NapcatAccountRow[]): Set<string> {
  const ids = new Set<string>();
  for (const a of accounts) {
    for (const raw of [a.qq, a.id]) {
      const s = String(raw ?? "").trim();
      if (s && s !== "?") ids.add(s);
    }
  }
  return ids;
}

function externalBotToAccount(
  bot: BotRow,
  instances: InstancesData | null,
): NapcatAccountRow | null {
  const selfId = String(bot.self_id ?? "").trim();
  if (!selfId || selfId === "?") return null;
  const profile = instances?.bot_profiles?.[selfId];
  const adapter = String(bot.adapter ?? profile?.adapter ?? "").trim();
  return {
    id: selfId,
    qq: selfId,
    display_name: profile?.nickname?.trim() || undefined,
    connected: true,
    process_running: false,
    account_source: PROTOCOL_ACCOUNT_SOURCE_EXTERNAL,
    external_adapter: adapter || undefined,
    protocol_backend: "external",
    connection_key: bot.connection_key,
    connected_at_unix: bot.connected_at_unix,
  };
}

/** 插件托管账号 + 消息框架当前在线连接 */
export function mergeProtocolDisplayAccounts(
  instances: InstancesData | null | undefined,
  pluginAccounts: readonly NapcatAccountRow[],
): NapcatAccountRow[] {
  const managed: NapcatAccountRow[] = pluginAccounts.map((a) =>
    isExternalProtocolAccount(a)
      ? a
      : { ...a, account_source: PROTOCOL_ACCOUNT_SOURCE_PLUGIN as "plugin" },
  );
  const known = pluginAccountSelfIds(managed);
  const external: NapcatAccountRow[] = [];
  for (const bot of instances?.nonebot_bots ?? []) {
    const sid = String(bot.self_id ?? "").trim();
    if (!sid || sid === "?" || known.has(sid)) continue;
    const row = externalBotToAccount(bot, instances ?? null);
    if (row) external.push(row);
  }
  return [...managed, ...external];
}
