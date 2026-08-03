/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import {
  isNavigationNoticeUnseen,
  markNavigationNoticeSeen,
  NAVIGATION_NOTICE_SEEN_EVENT,
  readNavigationNoticeRevision,
} from "@/utils/navigationNotice";

describe("navigationNotice", () => {
  it("shows a revision until the page is opened, then records it as seen", () => {
    localStorage.clear();
    const dispatch = vi.spyOn(window, "dispatchEvent");

    expect(isNavigationNoticeUnseen("/preferences", 2)).toBe(true);

    markNavigationNoticeSeen("/preferences", 2);

    expect(readNavigationNoticeRevision("/preferences")).toBe(2);
    expect(isNavigationNoticeUnseen("/preferences", 2)).toBe(false);
    expect(isNavigationNoticeUnseen("/preferences", 3)).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: NAVIGATION_NOTICE_SEEN_EVENT }));
  });
});
