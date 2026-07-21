/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { releaseNotesToSafeHtml } from "../src/utils/releaseNotesHtml";
import { setupReadmeCodeCopyButtons } from "../src/utils/readmeCodeCopy";

vi.mock("@/utils/clipboard", () => ({
  copyTextToClipboard: vi.fn(async () => true),
}));

/** 摘自 Bot `.github/workflows/release.yml` 发版说明片段 */
const BOT_RELEASE_SNIPPET = `
## Docker

\`\`\`bash
docker pull pallasbot/pallas-bot:v4.0.2
\`\`\`

## WebUI

| 方式 | 说明 |
| --- | --- |
| 自动 | 本地尚无 \`data/pb_webui/public\` 时，启动会从本仓库 Release 拉取并解压 |
| 手动 | 将本附件解压到仓库根下的 \`data/pb_webui/\` |
| 控制台 | 「更新」页可检查并应用同名 \`dist.zip\` |

\`\`\`bash
unzip -d data/pb_webui dist.zip
\`\`\`
`;

describe("releaseNotesToSafeHtml", () => {
  it("keeps GFM tables from Bot release notes", () => {
    const html = releaseNotesToSafeHtml(BOT_RELEASE_SNIPPET);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>");
    expect(html).toContain("<td>");
    expect(html).toContain("自动");
    expect(html).toContain("控制台");
  });

  it("keeps fenced command code blocks", () => {
    const html = releaseNotesToSafeHtml(BOT_RELEASE_SNIPPET);
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
    expect(html).toContain("docker pull pallasbot/pallas-bot:v4.0.2");
    expect(html).toContain("unzip -d data/pb_webui dist.zip");
  });

  it("fenced blocks can be enhanced with copy buttons after mount", () => {
    const html = releaseNotesToSafeHtml(BOT_RELEASE_SNIPPET);
    const root = document.createElement("div");
    root.innerHTML = html;
    const teardown = setupReadmeCodeCopyButtons(root);
    expect(root.querySelectorAll(".readme-code-block").length).toBe(2);
    expect(root.querySelector(".readme-code-block__copy")?.textContent).toBe("复制");
    teardown();
  });
});
