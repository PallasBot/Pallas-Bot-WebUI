import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "../src/components/ProtocolAccountWorkspace.vue"), "utf8");

describe("ProtocolAccountWorkspace 登录加载", () => {
  it("打开账号卡片时只读取二维码状态", () => {
    const bootWorkspace = source.match(
      /async function bootWorkspace\(\) \{[\s\S]*?\n\}/,
    )?.[0];

    expect(bootWorkspace).toContain("void refreshQrcode(false);");
    expect(bootWorkspace).not.toContain("void refreshQrcode(true);");
  });
});
