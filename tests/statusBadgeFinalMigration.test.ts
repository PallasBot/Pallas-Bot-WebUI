import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("状态标签第三批迁移", () => {
  it("移除插件卡片的旧 data-pill", () => {
    const catalogCard = source("src/components/PluginCatalogCard.tsx");

    expect(catalogCard).toContain('import { Badge } from "@/components/ui/badge";');
    expect(catalogCard).toContain('<Badge variant="neutral" size="compact">已禁用</Badge>');
    expect(catalogCard).toContain('<Badge variant="warn" size="compact" title={loadWhere}>');
  });

  it("将数据库健康交给共享 Badge", () => {
    const database = source("src/pages/DatabasePage.tsx");

    expect(database).toContain('import { Badge, type BadgeProps } from "@/components/ui/badge";');
    expect(database).toContain('<Badge variant={healthBadgeVariant(health.status)}');
  });
});
