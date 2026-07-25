export type ConsoleToastLevel = "ok" | "warn" | "err";

export type ConsoleToastItem = {
  id: number;
  message: string;
  level: ConsoleToastLevel;
};

type Listener = () => void;

let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let items: ConsoleToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeConsoleToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConsoleToastItems(): readonly ConsoleToastItem[] {
  return items;
}

export function dismissConsoleToast(id: number): void {
  const t = timers.get(id);
  if (t != null) {
    clearTimeout(t);
    timers.delete(id);
  }
  items = items.filter((x) => x.id !== id);
  emit();
}

/** 右下角轻提示，与内嵌控制台 notify 行为相近 */
export function pushConsoleToast(
  message: string,
  level: ConsoleToastLevel = "ok",
  durationMs = 4200,
): void {
  const text = String(message ?? "").trim();
  const id = ++seq;
  items = [...items, { id, message: text || "完成", level }];
  emit();
  const timer = setTimeout(() => dismissConsoleToast(id), durationMs);
  timers.set(id, timer);
}
