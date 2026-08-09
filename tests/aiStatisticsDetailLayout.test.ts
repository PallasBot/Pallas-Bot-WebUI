import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const page = readFileSync(
  resolve(process.cwd(), "src/pages/ai/AiStatisticsPage.tsx"),
  "utf8",
);

describe("AI 观测明细布局", () => {
  it("让 Token 和画画的三张明细表按两列换行", () => {
    const tokenDetails = page.match(
      /<StatsSectionLabel>Token 明细<\/StatsSectionLabel>[\s\S]*?<\/div>\n\n            \{hasDrawInRange/,
    )?.[0];
    const imageDetails = page.match(
      /<StatsSectionLabel>画画明细<\/StatsSectionLabel>[\s\S]*?<\/div>\n            \) : null}/,
    )?.[0];

    expect(tokenDetails).toContain(
      'className="console-panel-grid grid-cols-1 lg:grid-cols-2"',
    );
    expect(imageDetails).toContain(
      'className="console-panel-grid grid-cols-1 lg:grid-cols-2"',
    );
  });

  it("让两个 Token 分布共同占满一行，并将长任务改为横向进度条", () => {
    const imageUsage = page.match(
      /<StatsSectionLabel>画画用量<\/StatsSectionLabel>[\s\S]*?\{activeTab === "cost"/,
    )?.[0];
    const tokenUsage = page.match(
      /activeTab === "token"[\s\S]*?<Card>[\s\S]*?Provider 堆叠/,
    )?.[0];

    expect(imageUsage).toContain(
      'className="console-panel-grid grid-cols-1 lg:grid-cols-2"',
    );
    expect(imageUsage).toContain(
      'title="按模型"\n                    rows={rangeImageModelRows}\n                    emptyText="暂无模型数据"\n                    className="lg:col-span-2"',
    );
    expect(tokenUsage).toContain(
      'className="console-panel-grid grid-cols-1 lg:grid-cols-2"',
    );
    expect(tokenUsage).toContain(
      'rows={rangeTokenTaskRows}\n                  limit={12}\n                  prefer="bars"\n                  emptyText="暂无按任务数据"',
    );
  });

  it("让费用按任务通栏展示单位成本，补充 Token 用量排行", () => {
    expect(page).toContain("每百万 Token");
    expect(page).toContain(
      'title="按任务"\n                  rows={rangeCost.tokenTaskRows}\n                  kind="token"\n                  currency={costCurrency}\n                  showUnitCost\n                  className="lg:col-span-2"',
    );
  });

  it("用量占比条丰富明细，并让费用按任务占满第二行", () => {
    expect(page).toContain("const totalVolume = rows.reduce(");
    expect(page).toContain(
      'const volume =\n                  kind === "token"',
    );
    expect(page).toContain(
      'import AiProgressBar from "@/components/ai/AiProgressBar";',
    );
    expect(page).toContain("value={share}");
    expect(page).toContain(
      'title="按模型"\n                  rows={rangeCost.tokenModelRows}\n                  kind="token"\n                  currency={costCurrency}',
    );
    expect(page).toContain(
      'title="按任务"\n                  rows={rangeCost.tokenTaskRows}\n                  kind="token"\n                  currency={costCurrency}\n                  showUnitCost\n                  className="lg:col-span-2"',
    );
    expect(page).toContain(
      'title="按模型"\n                    rows={rangeCost.imageModelRows}\n                    kind="image"\n                    currency={costCurrency}\n                    className="lg:col-span-2"',
    );
  });

  it("将最近错误作为最近任务面板内的提示", () => {
    expect(page).toContain(
      'import ConsoleHint from "@/components/ConsoleHint";',
    );
    expect(page).toContain(
      "stickerVision.recent.length || stickerVision.recent_error ? (",
    );
    expect(page).toContain(
      '<ConsoleHint className="mb-3 border-rose-300/70 bg-rose-50/70 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">',
    );
  });
});
