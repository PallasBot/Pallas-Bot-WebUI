import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const homePage = readFileSync(resolve(process.cwd(), "src/pages/HomePage.tsx"), "utf8");

describe("首页社交概况加载", () => {
  it("在当前账号社交请求完成前优先显示占位", () => {
    expect(homePage).toContain("!overviewSettled || socialQ.isPending || socialQ.isFetching");
    expect(homePage).toContain("accountSocialPending ? (\n                            <PendingValue pending />\n                          ) : socialQ.data?.fl != null");
    expect(homePage).toContain("if (accountSocialPending || !scopedReqRow) return \"—\";");
  });

  it("为好友申请和入群邀请先保留文字与数量占位", () => {
    expect(homePage).toContain(
      'accountSocialPending ? (\n                          <span\n                            className="home-acct-pending-pill home-acct-pending-pill--friend"',
    );
    expect(homePage).toContain(
      'accountSocialPending ? (\n                          <span\n                            className="home-acct-pending-pill home-acct-pending-pill--group"',
    );
    expect(homePage).toContain('aria-busy="true"');
    expect(homePage).toContain("好友申请 · <PendingValue pending narrow />");
    expect(homePage).toContain("入群邀请 · <PendingValue pending narrow />");
  });
});
