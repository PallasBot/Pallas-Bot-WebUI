import { describe, expect, it } from "vitest";
import {
  ensureStringMapSpeakerGroup,
  stringMapGroupsToJson,
  tryParseStringMapGroups,
} from "@/components/config/StringMapField";

describe("ensureStringMapSpeakerGroup", () => {
  it("adds a speaker with id as default alias", () => {
    const raw = stringMapGroupsToJson([{ speakerId: "pallas", aliases: ["帕拉斯", "牛牛"] }]);
    const result = ensureStringMapSpeakerGroup(raw, "rana");
    expect(result?.created).toBe(true);
    expect(tryParseStringMapGroups(result!.next)).toEqual([
      { speakerId: "pallas", aliases: ["帕拉斯", "牛牛"] },
      { speakerId: "rana", aliases: ["rana"] },
    ]);
  });

  it("is a no-op when speaker already mapped", () => {
    const raw = stringMapGroupsToJson([{ speakerId: "rana", aliases: ["rana"] }]);
    const result = ensureStringMapSpeakerGroup(raw, "rana");
    expect(result?.created).toBe(false);
    expect(result?.next).toBe(stringMapGroupsToJson([{ speakerId: "rana", aliases: ["rana"] }]));
  });

  it("returns null for invalid json map", () => {
    expect(ensureStringMapSpeakerGroup("[1,2]", "rana")).toBeNull();
    expect(ensureStringMapSpeakerGroup("", "  ")).toBeNull();
  });
});
