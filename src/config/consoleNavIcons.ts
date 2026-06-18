/** GS / Lucide 风格控制台导航与面板图标 ID */

export type ConsoleNavIconId =
  | "dashboard"
  | "charts"
  | "logs"
  | "alert"
  | "server"
  | "radio"
  | "blocks"
  | "store"
  | "settings"
  | "users"
  | "database"
  | "globe"
  | "sparkles"
  | "palette"
  | "download"
  | "account"
  | "activity"
  | "cpu"
  | "timer"
  | "network"
  | "terminal"
  | "swap"
  | "list"
  | "backup"
  | "plugin"
  | "default"
  | "sun"
  | "layout"
  | "sliders"
  | "lock"
  | "square"
  | "layers";

export type ConsoleIconNode =
  | { kind: "path"; d: string }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx?: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "polyline"; points: string };

export const CONSOLE_NAV_ICON_NODES: Record<ConsoleNavIconId, ConsoleIconNode[]> = {
  dashboard: [
    { kind: "rect", x: 3, y: 3, width: 7, height: 9, rx: 1 },
    { kind: "rect", x: 14, y: 3, width: 7, height: 5, rx: 1 },
    { kind: "rect", x: 14, y: 12, width: 7, height: 9, rx: 1 },
    { kind: "rect", x: 3, y: 16, width: 7, height: 5, rx: 1 },
  ],
  charts: [
    { kind: "path", d: "M3 3v16a2 2 0 0 0 2 2h16" },
    { kind: "path", d: "M18 17V9" },
    { kind: "path", d: "M13 17V5" },
    { kind: "path", d: "M8 17v-3" },
  ],
  logs: [
    { kind: "path", d: "M15 12h-5" },
    { kind: "path", d: "M15 8h-5" },
    { kind: "path", d: "M19 17V5a2 2 0 0 0-2-2H4" },
    { kind: "path", d: "M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v1a2 2 0 1 0 4 0" },
  ],
  alert: [
    { kind: "path", d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" },
    { kind: "path", d: "M12 9v4" },
    { kind: "path", d: "M12 17h.01" },
  ],
  server: [
    { kind: "rect", x: 2, y: 3, width: 20, height: 8, rx: 2 },
    { kind: "rect", x: 2, y: 13, width: 20, height: 8, rx: 2 },
    { kind: "path", d: "M6 7h.01" },
    { kind: "path", d: "M6 17h.01" },
  ],
  radio: [
    { kind: "path", d: "M16.247 7.761a6 6 0 0 1 0 8.478" },
    { kind: "path", d: "M19.075 4.933a10 10 0 0 1 0 14.134" },
    { kind: "path", d: "M4.925 4.933a10 10 0 0 0 0 14.134" },
    { kind: "path", d: "M7.753 7.761a6 6 0 0 0 0 8.478" },
    { kind: "circle", cx: 12, cy: 12, r: 2 },
  ],
  blocks: [
    { kind: "rect", x: 3, y: 3, width: 7, height: 7, rx: 1 },
    { kind: "rect", x: 14, y: 3, width: 7, height: 7, rx: 1 },
    { kind: "rect", x: 3, y: 14, width: 7, height: 7, rx: 1 },
    { kind: "path", d: "M14 14h.01" },
    { kind: "path", d: "M17 14h.01" },
    { kind: "path", d: "M14 17h.01" },
    { kind: "path", d: "M17 17h.01" },
    { kind: "path", d: "M20 14h.01" },
    { kind: "path", d: "M20 17h.01" },
    { kind: "path", d: "M20 20h.01" },
  ],
  store: [
    { kind: "path", d: "M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" },
    {
      kind: "path",
      d: "M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.761l2.331-4.697a2 2 0 0 1 1.789-1.102h8.853a2 2 0 0 1 1.789 1.102l2.331 4.697a2.5 2.5 0 0 1-3.77 3.761",
    },
  ],
  settings: [
    { kind: "path", d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" },
    { kind: "circle", cx: 12, cy: 12, r: 3 },
  ],
  users: [
    { kind: "path", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
    { kind: "circle", cx: 9, cy: 7, r: 4 },
    { kind: "path", d: "M22 21v-2a4 4 0 0 0-3-3.87" },
    { kind: "path", d: "M16 3.13a4 4 0 0 1 0 7.75" },
  ],
  database: [
    { kind: "path", d: "M4.5 5.5a8.5 8.5 0 0 1 15 0" },
    { kind: "path", d: "M4.5 5.5V18.5a8.5 8.5 0 0 0 15 0V5.5" },
    { kind: "path", d: "M4.5 12a8.5 8.5 0 0 0 15 0" },
  ],
  globe: [
    { kind: "circle", cx: 12, cy: 12, r: 10 },
    { kind: "path", d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" },
    { kind: "path", d: "M2 12h20" },
  ],
  sparkles: [
    { kind: "path", d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" },
    { kind: "path", d: "M20 2v4" },
    { kind: "path", d: "M22 4h-4" },
    { kind: "circle", cx: 4, cy: 20, r: 2 },
  ],
  palette: [
    { kind: "path", d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" },
    { kind: "circle", cx: 6.5, cy: 12.5, r: 0.5 },
    { kind: "circle", cx: 8.5, cy: 7.5, r: 0.5 },
    { kind: "circle", cx: 13.5, cy: 6.5, r: 0.5 },
    { kind: "circle", cx: 17.5, cy: 10.5, r: 0.5 },
  ],
  download: [
    { kind: "path", d: "M12 15V3" },
    { kind: "path", d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" },
    { kind: "path", d: "m7 10 5 5 5-5" },
  ],
  account: [
    { kind: "circle", cx: 12, cy: 12, r: 10 },
    { kind: "circle", cx: 12, cy: 10, r: 3 },
    { kind: "path", d: "M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" },
  ],
  activity: [
    { kind: "path", d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" },
  ],
  cpu: [
    { kind: "path", d: "M12 20v2" },
    { kind: "path", d: "M12 2v2" },
    { kind: "path", d: "M17 20v2" },
    { kind: "path", d: "M17 2v2" },
    { kind: "path", d: "M2 12h2" },
    { kind: "path", d: "M2 17h2" },
    { kind: "path", d: "M2 7h2" },
    { kind: "path", d: "M20 12h2" },
    { kind: "path", d: "M20 17h2" },
    { kind: "path", d: "M20 7h2" },
    { kind: "path", d: "M7 20v2" },
    { kind: "path", d: "M7 2v2" },
    { kind: "rect", x: 7, y: 7, width: 10, height: 10, rx: 2 },
  ],
  timer: [
    { kind: "line", x1: 10, y1: 2, x2: 14, y2: 2 },
    { kind: "line", x1: 12, y1: 14, x2: 15, y2: 11 },
    { kind: "circle", cx: 12, cy: 14, r: 8 },
  ],
  network: [
    { kind: "rect", x: 16, y: 16, width: 6, height: 6, rx: 1 },
    { kind: "rect", x: 2, y: 16, width: 6, height: 6, rx: 1 },
    { kind: "rect", x: 9, y: 2, width: 6, height: 6, rx: 1 },
    { kind: "path", d: "M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" },
    { kind: "path", d: "M12 12V8" },
  ],
  terminal: [
    { kind: "polyline", points: "4 17 10 11 4 5" },
    { kind: "line", x1: 12, y1: 19, x2: 20, y2: 19 },
  ],
  swap: [
    { kind: "path", d: "m16 3 4 4-4 4" },
    { kind: "path", d: "M20 7H4" },
    { kind: "path", d: "m8 21-4-4 4-4" },
    { kind: "path", d: "M4 17h16" },
  ],
  list: [
    { kind: "path", d: "M3 5h.01" },
    { kind: "path", d: "M3 12h.01" },
    { kind: "path", d: "M3 19h.01" },
    { kind: "path", d: "M8 5h13" },
    { kind: "path", d: "M8 12h13" },
    { kind: "path", d: "M8 19h13" },
  ],
  backup: [
    { kind: "path", d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" },
    { kind: "polyline", points: "3.29 7 12 12 20.71 7" },
    { kind: "line", x1: 12, y1: 22, x2: 12, y2: 12 },
  ],
  plugin: [
    { kind: "path", d: "M12 22v-5" },
    { kind: "path", d: "M9 8V2" },
    { kind: "path", d: "M15 8V2" },
    { kind: "path", d: "M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4z" },
  ],
  default: [
    { kind: "path", d: "M12 2 2 7l10 5 10-5-10-5Z" },
    { kind: "path", d: "m2 17 10 5 10-5" },
    { kind: "path", d: "m2 12 10 5 10-5" },
  ],
  sun: [
    { kind: "circle", cx: 12, cy: 12, r: 4 },
    { kind: "path", d: "M12 2v2" },
    { kind: "path", d: "M12 20v2" },
    { kind: "path", d: "M4.93 4.93l1.41 1.41" },
    { kind: "path", d: "M17.66 17.66l1.41 1.41" },
    { kind: "path", d: "M2 12h2" },
    { kind: "path", d: "M20 12h2" },
    { kind: "path", d: "M4.93 19.07l1.41-1.41" },
    { kind: "path", d: "M17.66 6.34l1.41-1.41" },
  ],
  layout: [
    { kind: "rect", x: 3, y: 3, width: 18, height: 18, rx: 2 },
    { kind: "path", d: "M3 9h18" },
    { kind: "path", d: "M9 21V9" },
  ],
  sliders: [
    { kind: "path", d: "M10 8h11" },
    { kind: "path", d: "M10 12h11" },
    { kind: "path", d: "M10 16h11" },
    { kind: "path", d: "M4 8h.01" },
    { kind: "path", d: "M4 12h.01" },
    { kind: "path", d: "M4 16h.01" },
  ],
  lock: [
    { kind: "rect", x: 3, y: 11, width: 18, height: 11, rx: 2 },
    { kind: "path", d: "M7 11V7a5 5 0 0 1 10 0v4" },
  ],
  square: [
    { kind: "rect", x: 3, y: 3, width: 18, height: 18, rx: 2 },
  ],
  layers: [
    { kind: "path", d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" },
    { kind: "path", d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" },
    { kind: "path", d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" },
  ],
};

/** 旧 Unicode 图标 → 新 ID（兼容本地存储等） */
const LEGACY_ICON_MAP: Record<string, ConsoleNavIconId> = {
  "◆": "dashboard",
  "▥": "charts",
  "≡": "logs",
  "⚠": "alert",
  "◎": "account",
  "▣": "blocks",
  "◫": "store",
  "⛭": "settings",
  "⊞": "users",
  "▤": "database",
  "◉": "globe",
  "◇": "cpu",
  "✦": "palette",
  "↑": "download",
  "⏱": "timer",
  "⎇": "network",
  "⌘": "terminal",
  "⇄": "swap",
  "◈": "sparkles",
  "▦": "charts",
  "💾": "backup",
  "📁": "database",
  "📊": "charts",
  "🗂️": "list",
  "◐": "sun",
  "◌": "sliders",
  "◻": "square",
  "●": "palette",
  "🔒": "lock",
};

export function resolveConsoleNavIcon(name: string | undefined | null): ConsoleNavIconId {
  const raw = (name ?? "").trim();
  if (!raw) return "default";
  if (raw in CONSOLE_NAV_ICON_NODES) return raw as ConsoleNavIconId;
  return LEGACY_ICON_MAP[raw] ?? "default";
}
