/** 控制台强调色预设（深/浅各一套 CSS 变量，由 app.css 的 data-accent 选择器应用） */

export const ACCENT_PRESET_IDS = ["sky", "indigo", "emerald", "rose", "amber", "violet"] as const;

export type AccentPreset = (typeof ACCENT_PRESET_IDS)[number];

export const ACCENT_PRESET_OPTIONS: { id: AccentPreset; label: string; swatch: string }[] = [
  { id: "sky", label: "天蓝", swatch: "#38bdf8" },
  { id: "indigo", label: "靛蓝", swatch: "#818cf8" },
  { id: "emerald", label: "翠绿", swatch: "#34d399" },
  { id: "rose", label: "玫红", swatch: "#fb7185" },
  { id: "amber", label: "琥珀", swatch: "#fbbf24" },
  { id: "violet", label: "紫罗兰", swatch: "#a78bfa" },
];

export function isAccentPreset(v: unknown): v is AccentPreset {
  return typeof v === "string" && (ACCENT_PRESET_IDS as readonly string[]).includes(v);
}
