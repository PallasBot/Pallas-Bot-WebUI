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

  it("已连接时展示登录成功而不是暂无二维码", () => {
    expect(source).toContain('if (isAccountConnected.value) return "登录成功 · Bot 已连接"');
    expect(source).toContain("const showQrImage = computed(");
    expect(source).toContain("{{ displayQrHint }}");
    expect(source).not.toContain("friends-groups-hd-pin-wrap");
  });

  it("协议日志在刷新后会滚到底部", () => {
    expect(source).toContain("scrollLogsToBottom");
    expect(source).toContain('ref="logPreEl"');
    expect(source).toContain('@scroll="onLogPreScroll"');
  });
});
