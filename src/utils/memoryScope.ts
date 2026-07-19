export type MemoryScopeSummary = {
  title: string;
  detail: string;
};

function positiveInteger(raw: string): string | null {
  const value = raw.trim();
  if (!/^[1-9]\d*$/.test(value)) return null;
  return value;
}

export function memoryScopeSummary(botId: string, groupId: string): MemoryScopeSummary | null {
  const bot = positiveInteger(botId);
  if (!bot) return null;
  const group = positiveInteger(groupId);
  if (group) {
    return {
      title: `群 ${group}`,
      detail: `仅查看 Bot ${bot} 在该群的记忆与关系备注。`,
    };
  }
  return {
    title: "该 Bot 的全部范围",
    detail: `未指定群号，查看 Bot ${bot} 的全部记忆与关系备注。`,
  };
}
