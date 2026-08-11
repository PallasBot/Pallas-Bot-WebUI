import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("plugin catalog version style", () => {
  it("uses the store version chip rather than a generic Badge", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/PluginCatalogCard.tsx"), "utf8");

    expect(source).toContain('className="plugin-store-card__meta-link plugin-store-card__meta-link--version"');
    expect(source).not.toContain('<Badge variant="outline" size="compact" title={versionLabel}>');
  });
});
