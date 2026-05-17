/** 轮盘模式：与 Pallas-Bot GroupConfig.roulette_mode 一致（0=踢人，1=禁言） */
export const ROULETTE_MODE_KICK = 0;
export const ROULETTE_MODE_MUTE = 1;

export type RouletteModeOption = { value: number; label: string };

export const ROULETTE_MODE_OPTIONS: readonly RouletteModeOption[] = [
  { value: ROULETTE_MODE_KICK, label: "踢人" },
  { value: ROULETTE_MODE_MUTE, label: "禁言" },
];

const labelByMode = new Map(ROULETTE_MODE_OPTIONS.map((o) => [o.value, o.label]));

export function rouletteModeLabel(mode: number): string {
  const label = labelByMode.get(mode);
  if (label) return label;
  if (!Number.isFinite(mode)) return "—";
  return `未知 (${mode})`;
}

export function rouletteModeSelectValue(mode: number): string {
  if (labelByMode.has(mode)) return String(mode);
  if (!Number.isFinite(mode)) return String(ROULETTE_MODE_MUTE);
  return String(mode);
}

export function parseRouletteModeSelect(
  raw: string,
  fallback: number = ROULETTE_MODE_MUTE,
): number {
  const n = Number.parseInt(raw, 10);
  if (n === ROULETTE_MODE_KICK || n === ROULETTE_MODE_MUTE) return n;
  return fallback;
}

/** 下拉选项；当前值为未知模式时追加一项以便展示 */
export function rouletteModeSelectOptions(currentMode?: number): RouletteModeOption[] {
  const opts: RouletteModeOption[] = [...ROULETTE_MODE_OPTIONS];
  if (
    currentMode != null &&
    Number.isFinite(currentMode) &&
    !labelByMode.has(currentMode)
  ) {
    opts.push({ value: currentMode, label: rouletteModeLabel(currentMode) });
  }
  return opts;
}
