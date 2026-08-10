import { describe, expect, it } from "vitest";
import { DATABASE_LIFECYCLE_NOTICE } from "./navigationNotices";

describe("database lifecycle navigation notice", () => {
  it("is dismissed only after its lifecycle section is visited", () => {
    expect(DATABASE_LIFECYCLE_NOTICE).toMatchObject({
      key: "database:lifecycle",
      revision: 1,
      seenOn: "section",
    });
  });
});
