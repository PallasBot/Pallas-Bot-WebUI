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

  it("加载并保存账号运行时切换配置", () => {
    expect(source).toContain("const targetBackend = ref");
    expect(source).toContain("const napcatDockerImage = ref");
    expect(source).toContain("const bypassEnabled = ref");
    expect(source).toContain("const runtimeMode = ref");
    expect(source).toContain("const runtimeId = ref");
    expect(source).toContain("const snowlumaRuntimes = ref");
    expect(source).toContain("protocolSwitchAccountRuntime");
    expect(source).toContain("await loadAccount(false);");
  });

  it("仅允许保存现存的 SnowLuma Runtime", () => {
    expect(source).toContain("function validateRuntimeSettings()");
    expect(source).toContain("请选择已有 SnowLuma Runtime");
    expect(source).toContain("snowlumaRuntimes.value.some");
    expect(source).toContain("await protocolSwitchAccountRuntime(mount, id");
    expect(source.indexOf("await protocolSwitchAccountRuntime(mount, id")).toBeLessThan(
      source.indexOf("await protocolUpdateAccount(mount, id, body, true)"),
    );
  });

  it("在设置页渲染协议与运行时字段", () => {
    expect(source).toContain("协议与运行时");
    expect(source).toContain('v-model="targetBackend"');
    expect(source).toContain("NapCat Docker 镜像");
    expect(source).toContain('v-model="bypassEnabled"');
    expect(source).toContain("SnowLuma Runtime 模式");
    expect(source).toContain('v-model="runtimeMode"');
    expect(source).toContain('v-model="runtimeId"');
    expect(source).toContain("保留原 NapCat 数据目录");
  });
});
