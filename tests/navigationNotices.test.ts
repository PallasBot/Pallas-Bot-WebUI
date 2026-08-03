import { describe, expect, it } from "vitest";
import { COMMUNITY_FEDERATION_NOTICE } from "@/config/navigationNotices";

describe("navigation notices", () => {
  it("keeps the federation update scoped to its community section", () => {
    expect(COMMUNITY_FEDERATION_NOTICE).toEqual({
      key: "community:federation",
      revision: 1,
      label: "多机协同配置已更新",
      seenOn: "section",
    });
  });
});
