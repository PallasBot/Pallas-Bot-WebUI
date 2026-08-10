import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const databasePage = readFileSync(resolve(process.cwd(), "src/pages/DatabasePage.tsx"), "utf8");

describe("database table browser pagination", () => {
  it("uses the newly selected page size for its first reload", () => {
    expect(databasePage).toContain("async function loadBrowseRows(table: string, page: number, pageSize = prefs.tablePageSize)");
    expect(databasePage).toContain("void loadBrowseRows(browseTable, 1, size);");
  });
});
