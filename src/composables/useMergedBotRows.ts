import type { BotConfigPublic, BotRow } from "@/api/pallasTypes";
import type { ComputedRef, Ref } from "vue";
import { computed } from "vue";

/** 合并实例行 */
export interface MergedBotRow {
  key: string;
  account: number;
  selfId: string;
  connectionKey: string;
  adapter: string;
  online: boolean;
  config: BotConfigPublic | null;
}

export function useMergedBotRows(
  nonebot: Ref<BotRow[]>,
  dbBots: Ref<BotConfigPublic[]>,
): {
  mergedRows: ComputedRef<MergedBotRow[]>;
  instanceLabel: (row: MergedBotRow) => string;
} {
  const mergedRows = computed<MergedBotRow[]>(() => {
    const byAcc = new Map<number, BotConfigPublic>();
    for (const c of dbBots.value) {
      byAcc.set(c.account, c);
    }
    const used = new Set<number>();
    const out: MergedBotRow[] = [];
    for (const b of nonebot.value) {
      const sid = b.self_id.trim();
      const n = /^\d+$/.test(sid) ? parseInt(sid, 10) : NaN;
      const conf = !Number.isNaN(n) ? byAcc.get(n) ?? null : null;
      if (!Number.isNaN(n)) used.add(n);
      out.push({
        key: `nb:${b.connection_key}`,
        account: Number.isNaN(n) ? -1 : n,
        selfId: sid,
        connectionKey: b.connection_key,
        adapter: b.adapter,
        online: true,
        config: conf,
      });
    }
    for (const c of dbBots.value) {
      if (!used.has(c.account)) {
        out.push({
          key: `db:${c.account}`,
          account: c.account,
          selfId: String(c.account),
          connectionKey: "—",
          adapter: "未连接",
          online: false,
          config: c,
        });
      }
    }
    return out;
  });

  function instanceLabel(row: MergedBotRow): string {
    const nick = row.config?.taken_name && Object.keys(row.config.taken_name).length ? "Bot" : "";
    if (nick) return `Bot · ${row.account >= 0 ? row.account : row.selfId}`;
    return `QQ ${row.account >= 0 ? row.account : row.selfId}`;
  }

  return { mergedRows, instanceLabel };
}
