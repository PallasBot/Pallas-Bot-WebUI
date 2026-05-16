import { reactive } from "vue";

export type ConsoleToastLevel = "ok" | "warn" | "err";

export type ConsoleToastItem = {
  id: number;
  message: string;
  level: ConsoleToastLevel;
};

const state = reactive<{ items: ConsoleToastItem[] }>({ items: [] });

let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function useConsoleToastState() {
  return state;
}

export function dismissConsoleToast(id: number): void {
  const t = timers.get(id);
  if (t != null) {
    clearTimeout(t);
    timers.delete(id);
  }
  const i = state.items.findIndex((x) => x.id === id);
  if (i >= 0) state.items.splice(i, 1);
}

/** 右下角轻提示，与内嵌控制台 notify 行为相近 */
export function pushConsoleToast(
  message: string,
  level: ConsoleToastLevel = "ok",
  durationMs = 4200,
): void {
  const text = String(message ?? "").trim();
  const id = ++seq;
  state.items.push({ id, message: text || "完成", level });
  const timer = setTimeout(() => dismissConsoleToast(id), durationMs);
  timers.set(id, timer);
}
