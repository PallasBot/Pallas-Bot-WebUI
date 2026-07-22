const STORAGE_KEY = "pallas.aiHome.cardLayout.v1";

export type AiHomeCardId = "focus" | "modules" | "diagnostic" | "logs";

export const AI_HOME_CARD_DEFS: Array<{ id: AiHomeCardId; label: string }> = [
  { id: "focus", label: "需要关注" },
  { id: "modules", label: "模块与连通" },
  { id: "diagnostic", label: "运行诊断" },
  { id: "logs", label: "服务日志" },
];

export type AiHomeCardLayout = {
  order: AiHomeCardId[];
  hidden: AiHomeCardId[];
};

const DEFAULT_ORDER = AI_HOME_CARD_DEFS.map((d) => d.id);

export function defaultAiHomeCardLayout(): AiHomeCardLayout {
  return { order: [...DEFAULT_ORDER], hidden: [] };
}

export function readAiHomeCardLayout(): AiHomeCardLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAiHomeCardLayout();
    const parsed = JSON.parse(raw) as Partial<AiHomeCardLayout>;
    const order = Array.isArray(parsed.order)
      ? parsed.order.filter((id): id is AiHomeCardId => DEFAULT_ORDER.includes(id as AiHomeCardId))
      : [...DEFAULT_ORDER];
    for (const id of DEFAULT_ORDER) {
      if (!order.includes(id)) order.push(id);
    }
    const hidden = Array.isArray(parsed.hidden)
      ? parsed.hidden.filter((id): id is AiHomeCardId => DEFAULT_ORDER.includes(id as AiHomeCardId))
      : [];
    return { order, hidden };
  } catch {
    return defaultAiHomeCardLayout();
  }
}

export function writeAiHomeCardLayout(layout: AiHomeCardLayout): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function visibleAiHomeCards(layout: AiHomeCardLayout): AiHomeCardId[] {
  return layout.order.filter((id) => !layout.hidden.includes(id));
}
