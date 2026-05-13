/** 由单一 hex 推导 TDesign `--td-brand-color-*` 系列，使自定义强调色在全站生效 */

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => clampByte(x).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mixHexRgb(base: string, target: string, t: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(target);
  if (!a || !b) return base;
  const u = Math.min(1, Math.max(0, t));
  return rgbToHex(
    a.r + (b.r - a.r) * u,
    a.g + (b.g - a.g) * u,
    a.b + (b.b - a.b) * u,
  );
}

/**
 * 浅色文档：primary 即用户选择的 accent。
 * 深色文档：使用略提亮的 primary，按钮与描边仍由调色板变量驱动。
 */
export function resolveEffectivePrimary(accentHex: string, documentDark: boolean): string {
  if (!documentDark) return accentHex;
  return mixHexRgb(accentHex, "#ffffff", 0.38);
}

/** 生成写在 html 上的 TDesign 品牌色阶（不设 important，由调用方 setProperty） */
export function buildTdBrandCssVars(primaryHex: string): Record<string, string> {
  const W = "#ffffff";
  const K = "#000000";
  const p = primaryHex;
  return {
    "--td-brand-color-1": mixHexRgb(p, W, 0.92),
    "--td-brand-color-2": mixHexRgb(p, W, 0.84),
    "--td-brand-color-3": mixHexRgb(p, W, 0.7),
    "--td-brand-color-4": mixHexRgb(p, W, 0.52),
    "--td-brand-color-5": mixHexRgb(p, W, 0.36),
    "--td-brand-color-6": mixHexRgb(p, W, 0.2),
    "--td-brand-color-7": p,
    "--td-brand-color-8": mixHexRgb(p, K, 0.18),
    "--td-brand-color-9": mixHexRgb(p, K, 0.32),
    "--td-brand-color-10": mixHexRgb(p, K, 0.46),
    "--td-brand-color": "var(--td-brand-color-7)",
    "--td-brand-color-hover": "var(--td-brand-color-6)",
    "--td-brand-color-active": "var(--td-brand-color-8)",
    "--td-brand-color-focus": "var(--td-brand-color-2)",
    "--td-brand-color-disabled": "var(--td-brand-color-3)",
    "--td-brand-color-light": "var(--td-brand-color-1)",
    "--td-brand-color-light-hover": "var(--td-brand-color-2)",
    "--td-text-color-brand": "var(--td-brand-color-7)",
    "--td-text-color-link": "var(--td-brand-color-8)",
  };
}
