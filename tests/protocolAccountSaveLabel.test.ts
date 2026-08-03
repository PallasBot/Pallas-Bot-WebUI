import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dialogSource = readFileSync(
  resolve(__dirname, "../src/components/ProtocolAccountConfigDialog.tsx"),
  "utf8",
);
const workspaceSource = readFileSync(
  resolve(__dirname, "../src/components/ProtocolAccountWorkspace.tsx"),
  "utf8",
);

describe("协议账号保存操作", () => {
  it("将保存入口标为保存配置而非必然重启", () => {
    expect(dialogSource).toContain('{saveBusy ? "保存中…" : "保存配置"}');
    expect(workspaceSource).toContain('again.label("save-restart", "保存配置")');
    expect(dialogSource).not.toContain('"保存并重启"');
    expect(workspaceSource).not.toContain('"保存并重启"');
  });
});
