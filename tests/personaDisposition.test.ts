import { describe, expect, it } from "vitest";
import { readPersonaDisposition, serializePersonaDisposition } from "@/utils/personaDisposition";

describe("personaDisposition", () => {
  it("reads stored values and serializes a bounded form payload", () => {
    expect(
      readPersonaDisposition({
        disposition: {
          approach: "先接住再判断",
          do: ["说重点", "留接话口"],
        },
      }),
    ).toEqual({
      approach: "先接住再判断",
      initiative: "",
      conflict: "",
      do: "说重点\n留接话口",
      dont: "",
    });

    expect(
      serializePersonaDisposition({
        approach: " 先接住再判断 ",
        initiative: "偶尔主动追问",
        conflict: "",
        do: "说重点\n留接话口\n别复述\n给选择\n超出上限",
        dont: "讲大道理\n\n抢结论",
      }),
    ).toEqual({
      version: 1,
      approach: "先接住再判断",
      initiative: "偶尔主动追问",
      conflict: "",
      do: ["说重点", "留接话口", "别复述", "给选择"],
      dont: ["讲大道理", "抢结论"],
    });
  });
});
