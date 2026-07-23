export type SparkGeometry = {
  poly: string;
  area: string;
};

export function buildSparkGeometry(
  values: number[],
  width = 160,
  height = 48,
): SparkGeometry | undefined {
  if (values.length < 2) return undefined;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const dv = maxV - minV || 1;
  const n = values.length;
  const bottom = height - 2;
  const pts = values.map((v, i) => ({
    x: (i / (n - 1)) * width,
    y: bottom - ((v - minV) / dv) * (height - 10) - 4,
  }));
  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const line = pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ");
  const area = `M 0 ${bottom.toFixed(1)} L ${line} L ${width.toFixed(1)} ${bottom.toFixed(1)} Z`;
  return { poly, area };
}

export type SparkBar = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function buildSparkBars(
  values: number[],
  width = 160,
  height = 48,
  gap = 3,
): SparkBar[] {
  if (!values.length) return [];
  const n = values.length;
  const maxV = Math.max(...values, 1);
  const barW = Math.max(2, (width - gap * (n - 1)) / n);
  const bottom = height - 2;
  return values.map((v, i) => {
    const h = (Math.max(0, v) / maxV) * (height - 8);
    return {
      x: i * (barW + gap),
      y: bottom - h,
      w: barW,
      h,
    };
  });
}
