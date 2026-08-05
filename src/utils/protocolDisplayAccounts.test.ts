import { describe, expect, it } from "vitest";
import type { InstancesData, NapcatAccountRow } from "@/api/pallasTypes";
import { protocolAccountDisplayName } from "./protocolDisplayAccounts";

function account(partial: Partial<NapcatAccountRow>): NapcatAccountRow {
  return { id: "2927116873", qq: "2927116873", ...partial };
}

function instances(nickname: string): InstancesData {
  return {
    nonebot_bots: [],
    db_bot_configs: [],
    pallas_protocol: null,
    bot_profiles: {
      "2927116873": { nickname },
    },
  };
}

describe("protocolAccountDisplayName", () => {
  it("prefers the configured name for plugin-managed accounts", () => {
    expect(
      protocolAccountDisplayName(
        account({ display_name: "帕拉斯", account_source: "plugin" }),
        instances("2927116873"),
      ),
    ).toBe("帕拉斯");
  });

  it("keeps the QQ nickname for external accounts", () => {
    expect(
      protocolAccountDisplayName(
        account({ display_name: "帕拉斯", account_source: "external" }),
        instances("2927116873"),
      ),
    ).toBe("2927116873");
  });
});
