import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesRoot = fileURLToPath(new URL("../src/styles/", import.meta.url));
const readStyle = (path: string) => readFileSync(new URL(path, `file://${stylesRoot}`), "utf8");

describe("plugin surface styles", () => {
  it("uses the shared outer-panel edge for installed plugin catalog cards", () => {
    const appCss = readStyle("console/app.css");
    const hubCss = readStyle("console/console-hub.css");

    expect(appCss).toContain("--plugin-card-edge: rgba(15, 23, 42, 0.12)");
    expect(appCss).toContain(".plugin-store-page--hub .plugin-store-card {\n  border: 1px solid var(--plugin-card-edge)");
    expect(hubCss).toContain(".plugins-page__plugin-grid > .plugin-catalog-card {\n  height: 100%;\n  min-height: 0;\n  border: 1px solid var(--surface-edge, var(--border))");
    expect(hubCss).toContain("html[data-layout=\"hub\"][data-surface=\"glass\"] .plugins-page--hub .plugins-page__plugin-grid > .plugin-catalog-card {\n  border-color: var(--surface-edge-glass, var(--border));");
  });

  it("uses the shared config panel edge for inner configuration panels", () => {
    const tokensCss = readStyle("console/tokens.css");
    const parityCss = readStyle("react-parity-pass.css");

    expect(tokensCss).toContain("--config-panel-edge: rgba(15, 23, 42, 0.14)");
    expect(parityCss).toContain(".plugin-governance-panel__group,\n.string-map-field__group,");
    expect(parityCss).toContain("border-color: var(--config-panel-edge);");
    expect(parityCss).toContain("box-shadow: var(--config-panel-shadow);");
  });
});
