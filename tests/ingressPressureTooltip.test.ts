import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const component = readFileSync(resolve(process.cwd(), "src/components/IngressPressureStrips.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "src/styles/console/app.css"), "utf8");

describe("近期压力提示", () => {
  it("在采样块悬停时渲染时间和数值提示", () => {
    expect(component).toContain("onPointerEnter");
    expect(component).toContain("ingress-pressure__tooltip");
    expect(component).toContain("formatPressureValue");
    expect(component).toContain("y: number");
    expect(component).toContain("below: boolean");
    expect(component).toContain("top: `${hovered.y}px`");
    expect(component).toContain("ingress-pressure__tooltip--below");
    expect(styles).toContain(".ingress-pressure__tooltip");
    expect(styles).toContain(".ingress-pressure__tooltip--below");
    expect(styles).not.toContain(".ingress-pressure__tooltip { position: absolute; top: 4px;");
  });
});
