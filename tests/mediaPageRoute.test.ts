import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const config = readFileSync(resolve(process.cwd(), "src/pages/ai/AiConfigPage.tsx"), "utf8");
const nav = readFileSync(resolve(process.cwd(), "src/config/mainNav.ts"), "utf8");
const page = readFileSync(resolve(process.cwd(), "src/pages/media/MediaPage.tsx"), "utf8");
const redirects = readFileSync(resolve(process.cwd(), "src/utils/commonConfigRedirects.ts"), "utf8");

describe("媒体配置独立页面", () => {
  it("registers a standalone media route and page shell", () => {
    expect(app).toContain('<Route path="media" element={<MediaPage />} />');
    expect(nav).toContain('{ to: "/media", label: "媒体"');
    expect(page).toContain('title="媒体"');
    expect(page).toContain("hideSectionSelect");
  });

  it("redirects the old AI config route and legacy gateway link", () => {
    expect(config).toContain('to={{ pathname: "/media", search }}');
    expect(redirects).toContain('return "/media?panel=draw";');
  });
});
