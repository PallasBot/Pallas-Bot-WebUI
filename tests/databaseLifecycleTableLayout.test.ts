import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  resolve(process.cwd(), "src/features/databaseLifecycle/databaseLifecycle.css"),
  "utf8",
);

describe("database lifecycle table layout", () => {
  it("keeps dataset name, risk, and state labels on one line", () => {
    expect(styles).toMatch(/\.database-lifecycle__table th, \.database-lifecycle__table td \{[^}]*white-space: nowrap;/s);
    expect(styles).toMatch(/\.database-lifecycle__objects \{[^}]*white-space: normal;/s);
  });
});
