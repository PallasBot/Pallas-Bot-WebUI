import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("状态标签第二批迁移", () => {
  it("将更新状态映射到共享的成功与警告语义", () => {
    const page = source("src/pages/UpdatePage.tsx");
    const styles = source("src/styles/update-page.css");

    expect(page).toContain('variant="warn"');
    expect(page).toContain('variant="success"');
    expect(styles).not.toContain(".update-page__status-pill--available {");
    expect(styles).not.toContain(".update-page__status-pill--current,");
  });

  it("将治理、备份与实例状态接入共享 Badge", () => {
    const governance = source("src/components/PluginGovernancePanel.tsx");
    const backups = source("src/pages/DatabaseBackupsPage.tsx");
    const instances = source("src/pages/InstancesPage.tsx");

    expect(governance).toContain('import { Badge } from "@/components/ui/badge";');
    expect(governance).toContain('<Badge variant="info" size="compact"');
    expect(backups).toContain('import { Badge, type BadgeProps } from "@/components/ui/badge";');
    expect(backups).toContain('<Badge variant={runStatusBadgeVariant(row)} size="compact"');
    expect(instances).toContain('"badge badge--compact badge--success"');
    expect(instances).toContain('"badge badge--compact badge--neutral"');
  });
});
