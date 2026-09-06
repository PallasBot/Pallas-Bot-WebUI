import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("plugin catalog card actions", () => {
  const card = source("src/components/PluginCatalogCard.tsx");

  it("keeps the uninstall action inside the corner menu", () => {
    expect(card).toContain('aria-label="更多操作"');
    expect(card).toContain("uninstallable");
    expect(card).toContain('"plugin-store-card__menu-item--danger"');
  });

  it("shows disable and edit buttons side by side without wrapping", () => {
    expect(card).toContain("禁用");
    expect(card).toContain("编辑");
    expect(card).toContain('plugin-catalog-card__foot');
  });

  it("disables the toggle for protected plugins", () => {
    expect(card).toContain("global_disable_protected");
    expect(card).toContain("不可禁用");
  });

  it("shows a missing dependency badge for community plugins", () => {
    expect(card).toContain("deps_missing");
    expect(card).toContain("缺依赖");
  });
});

describe("plugin store card update button", () => {
  const card = source("src/components/PluginStoreCard.tsx");

  it("keeps an update button for installed plugins and disables it when up to date", () => {
    expect(card).toContain("updateDisabled");
    expect(card).toContain("disabled={footLocked || updateDisabled}");
    expect(card).toContain("updateDisabled ? latestLabel : updateLabel");
  });
});