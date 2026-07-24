import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appStyles = readFileSync(resolve(__dirname, "../src/styles/app.css"), "utf8");

describe("home KPI layout", () => {
  it("keeps community and charts beside the KPI bar outside narrow screens", () => {
    expect(appStyles).toContain("@media (min-width: 861px)");
    expect(appStyles).toContain(".home-kpi-head {\n    flex-wrap: nowrap;");
    expect(appStyles).toContain(".home-kpi-head > .home-kpi-bar {\n    flex: 1 1 0;");
    expect(appStyles).not.toContain(".home-kpi-head__side {\n    flex: 0 1 19rem;");
  });
});
