import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const databasePage = readFileSync(resolve(process.cwd(), "src/pages/DatabasePage.tsx"), "utf8");
const pallasTypes = readFileSync(resolve(process.cwd(), "src/api/pallasTypes.ts"), "utf8");

describe("database user ban audit display", () => {
  it("renders the existing operator and time fields", () => {
    expect(pallasTypes).toContain("banned_by?: string;");
    expect(pallasTypes).toContain("banned_at?: number;");
    expect(databasePage).toContain("<th>最近操作</th>");
    expect(databasePage).toContain("formatBanOperator(u.banned_by)");
    expect(databasePage).toContain("formatBanTime(u.banned_at)");
    expect(databasePage).toContain('table === "blacklist_audit" ? "黑名单审计" : table');
    expect(databasePage).toContain('created_at: "时间"');
    expect(databasePage).toContain("formatBrowseCell(r[col], browseTable, col)");
  });
});
