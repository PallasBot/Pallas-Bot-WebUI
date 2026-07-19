import { describe, expect, it, beforeEach } from "vitest";
import {
  isHomeActionDismissed,
  loadHomeActionDismissals,
  saveHomeActionDismissal,
} from "@/utils/homeActionDismissals";

describe("homeActionDismissals", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists dismissal token per action key", () => {
    saveHomeActionDismissal("bot-update", "v4.1.0");
    expect(loadHomeActionDismissals()).toEqual({ "bot-update": "v4.1.0" });
    expect(isHomeActionDismissed(loadHomeActionDismissals(), "bot-update", "v4.1.0")).toBe(true);
    expect(isHomeActionDismissed(loadHomeActionDismissals(), "bot-update", "v4.2.0")).toBe(false);
  });
});
