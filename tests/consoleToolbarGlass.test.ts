import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const consoleHubStyles = readFileSync(resolve(process.cwd(), "src/styles/console/console-hub.css"), "utf8");

describe("pinned toolbar actions", () => {
  it("keeps a frosted background in glass mode", () => {
    const glassTrailingRule = consoleHubStyles.match(
      /html\[data-layout="hub"\]\[data-surface="glass"\] \.console-hub-page__chrome-row > \.chrome-tools__trailing \{([^}]+)\}/,
    )?.[1];

    expect(glassTrailingRule).toContain("background: var(--surface-glass-fill)");
    expect(glassTrailingRule).toContain("backdrop-filter: blur(var(--surface-blur))");
    expect(glassTrailingRule).not.toContain("background: transparent");
  });
});
