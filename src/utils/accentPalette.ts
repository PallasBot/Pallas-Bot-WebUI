/** 由单一 hex 推导 Element Plus `--el-color-primary*` 系列，使自定义强调色在全站生效 */

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

/** 生成写在 html 上的 EP primary 系列变量（不设 important，由调用方 setProperty） */
export function buildElPrimaryCssVars(primaryHex: string): Record<string, string> {
  const W = "#ffffff";
  const K = "#000000";
  const dark2 = mixHexRgb(primaryHex, K, 0.22);
  const l3 = mixHexRgb(primaryHex, W, 0.28);
  const l5 = mixHexRgb(primaryHex, W, 0.44);
  const l7 = mixHexRgb(primaryHex, W, 0.58);
  const l8 = mixHexRgb(primaryHex, W, 0.72);
  const l9 = mixHexRgb(primaryHex, W, 0.9);
  return {
    "--el-color-primary": primaryHex,
    "--el-color-primary-dark-2": dark2,
    "--el-color-primary-light-3": l3,
    "--el-color-primary-light-5": l5,
    "--el-color-primary-light-7": l7,
    "--el-color-primary-light-8": l8,
    "--el-color-primary-light-9": l9,
  };
}
