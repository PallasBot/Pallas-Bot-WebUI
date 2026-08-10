import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dialogSource = readFileSync(
  fileURLToPath(new URL("./ProtocolRuntimeConfigDialog.tsx", import.meta.url)),
  "utf8",
);
const protocolPageSource = readFileSync(
  fileURLToPath(new URL("../pages/ProtocolPage.tsx", import.meta.url)),
  "utf8",
);
const runtimeTabSource = readFileSync(
  fileURLToPath(new URL("../pages/protocol/ProtocolRuntimeTab.tsx", import.meta.url)),
  "utf8",
);
const accountWorkspaceSource = readFileSync(
  fileURLToPath(new URL("./ProtocolAccountWorkspace.tsx", import.meta.url)),
  "utf8",
);
const appCss = readFileSync(
  fileURLToPath(new URL("../styles/console/app.css", import.meta.url)),
  "utf8",
);

describe("SnowLuma Runtime 配置即时回显", () => {
  it("提交 Runtime 名称并提供可编辑输入框", () => {
    expect(dialogSource).toContain('const [displayName, setDisplayName] = useState("");');
    expect(dialogSource).toContain('display_name: displayName.trim() || runtimeId,');
    expect(dialogSource).toContain('htmlFor="runtime-display-name"');
  });

  it("协议刷新与 Runtime 保存都会刷新全局实例快照", () => {
    expect(protocolPageSource).toContain('qc.invalidateQueries({ queryKey: ["instances"] })');
    expect(runtimeTabSource).toContain('qc.invalidateQueries({ queryKey: ["instances"] })');
    expect(accountWorkspaceSource).toContain(
      'qc.invalidateQueries({ queryKey: ["protocol-accounts", mountUrl] })',
    );
    expect(accountWorkspaceSource).toContain(
      'qc.invalidateQueries({ queryKey: ["instances"] })',
    );
  });

  it("窄屏不强制把成员操作区换到下一行", () => {
    const mobileRule = appCss.indexOf(
      "@media (max-width: 560px) {\n  .protocol-runtime-grid",
    );
    expect(mobileRule).toBeGreaterThan(-1);
    const mobileStyles = appCss.slice(mobileRule, mobileRule + 2600);
    expect(mobileStyles).not.toContain(".protocol-runtime-member {\n    flex-wrap: wrap;");
    expect(mobileStyles).not.toContain(
      ".protocol-runtime-member__actions {\n    width: 100%;",
    );
  });
});
