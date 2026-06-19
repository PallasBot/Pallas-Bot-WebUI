import { describe, expect, it } from "vitest";
import { readmeMarkdownToSafeHtml } from "@/utils/pluginReadme";

describe("readmeMarkdownToSafeHtml", () => {
  it("keeps centered html hero blocks and rewrites relative image sources", () => {
    const html = readmeMarkdownToSafeHtml(
      `<div align="center">
<img src="./assets/hero.png" width="320" alt="Hero" />
</div>`,
      "https://github.com/TogetsuDo/pallas-plugin-duel",
    );
    expect(html).toContain('<div align="center">');
    expect(html).toContain(
      'src="https://raw.githubusercontent.com/TogetsuDo/pallas-plugin-duel/refs/heads/main/assets/hero.png"',
    );
    expect(html).toContain('width="320"');
  });

  it("rewrites relative html links to github blob links", () => {
    const html = readmeMarkdownToSafeHtml(
      '<p><a href="./docs/guide.md">Guide</a></p>',
      "https://github.com/TogetsuDo/pallas-plugin-duel",
    );
    expect(html).toContain(
      'href="https://github.com/TogetsuDo/pallas-plugin-duel/blob/main/docs/guide.md"',
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });
});
