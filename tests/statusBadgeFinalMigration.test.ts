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

  it("将数据库健康与协议运行状态交给共享 Badge", () => {
    const database = source("src/pages/DatabasePage.tsx");
    const protocolRuntime = source("src/pages/protocol/ProtocolRuntimeTab.tsx");

    expect(database).toContain('import { Badge, type BadgeProps } from "@/components/ui/badge";');
    expect(database).toContain('<Badge variant={healthBadgeVariant(health.status)}');
    expect(protocolRuntime).toContain('<Badge variant="neutral" size="compact">空闲</Badge>');
    expect(protocolRuntime).toContain('className="badge badge--compact badge--success protocol-runtime-webui-link"');
  });
});
