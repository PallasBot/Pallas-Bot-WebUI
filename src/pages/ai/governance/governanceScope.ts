export type GovernanceScope = {
  botId: number;
  groupId: number | null;
  scene: "group_chat";
};

export type GovernanceScopeParams = {
  bot?: string | null;
  group?: string | null;
  scene?: string | null;
};

export type ReplyProfileFacts = {
  style: string | null;
  expressionCount: number;
  memoryCount: number;
};

function parsePositiveInteger(value: string | null | undefined): number | null {
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function parseGovernanceScope(params: GovernanceScopeParams): {
  scope: GovernanceScope | null;
  ready: boolean;
} {
  const botId = parsePositiveInteger(params.bot);
  if (botId == null || params.scene !== "group_chat") {
    return { scope: null, ready: false };
  }
  const groupId = parsePositiveInteger(params.group);
  return { scope: { botId, groupId, scene: "group_chat" }, ready: true };
}

export function buildGovernanceSearch(scope: GovernanceScope): URLSearchParams {
  const params = new URLSearchParams();
  params.set("bot", String(scope.botId));
  if (scope.groupId != null) params.set("group", String(scope.groupId));
  params.set("scene", scope.scene);
  return params;
}

export function replyProfileSummary({
  style,
  expressionCount,
  memoryCount,
}: ReplyProfileFacts): string {
  const normalizedStyle = style?.trim();
  if (!normalizedStyle && expressionCount <= 0 && memoryCount <= 0) {
    return "尚无足够数据生成回复画像。";
  }
  const facts = [
    normalizedStyle ? `回复风格：${normalizedStyle}` : null,
    `表达记录 ${Math.max(0, expressionCount)} 条`,
    `记忆记录 ${Math.max(0, memoryCount)} 条`,
  ].filter(Boolean);
  return facts.join("；");
}