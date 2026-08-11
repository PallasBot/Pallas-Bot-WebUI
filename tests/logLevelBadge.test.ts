import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const feed = readFileSync(resolve(process.cwd(), "src/components/LogVirtualFeed.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "src/styles/log-virtual-feed.css"), "utf8");

describe("日志等级徽章", () => {
  it("在主列表和固定详情中使用共享 Badge，而非色点", () => {
    expect(feed).toContain('variant={logLevelBadgeVariant(row.level)}');
    expect(feed).toContain('variant={logLevelBadgeVariant(pinnedRow.level)}');
    expect(feed).not.toContain('"log-line__lv-tag--dot"');
    expect(styles).toContain(".log-line--virtual .log-line__level-badge {");
    expect(styles).toContain("margin-top: 2px;");
  });
});
