import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("实例卡片与更新历史的视觉状态", () => {
  it("将实例连接标签与收藏放在昵称行，并放大头像填补标题区", () => {
    const instances = source("src/pages/InstancesPage.tsx");
    const statusTone = source("src/components/StatusTone.tsx");
    const styles = source("src/styles/console/app.css");

    expect(instances).toContain('size="compact"');
    expect(instances).toContain('className="data-summary-card__title-status"');
    expect(instances).not.toContain('className="data-summary-card__head-badges"');
    expect(statusTone).toContain('size = "regular"');
    expect(styles).toContain(".data-summary-card--bot .data-summary-card__avatar {\n  width: 40px;\n  height: 40px;");
    expect(styles).toContain(".data-summary-card--bot .data-summary-card__secondary {\n  margin-top: 1px;");
  });

  it("不再以背景色强调本地当前提交行", () => {
    const styles = source("src/styles/update-page.css");

    expect(styles).not.toContain(".bot-git-panel__row--head {");
  });
});
