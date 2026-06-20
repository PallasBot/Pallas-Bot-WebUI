import { describe, expect, it } from "vitest";

import { deriveFeedbackGroupFromSession } from "../src/utils/llmRepeaterFeedbackLink";

describe("deriveFeedbackGroupFromSession", () => {
  it("uses selected group session when user has not manually overridden feedback group", () => {
    expect(
      deriveFeedbackGroupFromSession({
        sessionGroupId: 626266902,
        currentFeedbackGroup: "",
        userTouched: false,
      }),
    ).toBe("626266902");
  });

  it("does not auto fill for private sessions", () => {
    expect(
      deriveFeedbackGroupFromSession({
        sessionGroupId: 0,
        currentFeedbackGroup: "",
        userTouched: false,
      }),
    ).toBe("");
  });

  it("preserves manual feedback group edits", () => {
    expect(
      deriveFeedbackGroupFromSession({
        sessionGroupId: 626266902,
        currentFeedbackGroup: "955324625",
        userTouched: true,
      }),
    ).toBe("955324625");
  });
});
