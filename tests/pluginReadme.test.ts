// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { extractReadmeAvatarUrl, readmeMarkdownToSafeHtml } from "../src/utils/pluginReadme";

describe("readmeMarkdownToSafeHtml", () => {
  it("keeps centered html hero blocks and rewrites relative image sources", () => {
    const html = readmeMarkdownToSafeHtml(
      `<div align="center">
<img src="./assets/hero.png" width="320" alt="Hero" />
</div>`,
      "https://github.com/PallasBot/Plugin-Duel",
    );
    expect(html).toContain('<div align="center">');
    expect(html).toContain(
      'src="https://raw.githubusercontent.com/PallasBot/Plugin-Duel/refs/heads/main/assets/hero.png"',
    );
    expect(html).toContain('width="320"');
  });

  it("rewrites relative html links to github blob links", () => {
    const html = readmeMarkdownToSafeHtml(
      '<p><a href="./docs/guide.md">Guide</a></p>',
      "https://github.com/PallasBot/Plugin-Duel",
    );
    expect(html).toContain(
      'href="https://github.com/PallasBot/Plugin-Duel/blob/main/docs/guide.md"',
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });
});

describe("extractReadmeAvatarUrl", () => {
  it("resolves first html image from readme", () => {
    const md = `
<p align="center">
  <img src="./assets/avatar.png" width="128" height="128" />
</p>
`;
    expect(extractReadmeAvatarUrl(md, "https://github.com/acme/demo")).toBe(
      "https://raw.githubusercontent.com/acme/demo/refs/heads/main/assets/avatar.png",
    );
  });

  it("falls back to markdown image", () => {
    const md = "![logo](assets/icon.png)";
    expect(extractReadmeAvatarUrl(md, "https://github.com/acme/demo")).toBe(
      "https://raw.githubusercontent.com/acme/demo/refs/heads/main/assets/icon.png",
    );
  });
});
