import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiSource = readFileSync(resolve(__dirname, "../src/api/protocol.ts"), "utf8");
const createSource = readFileSync(resolve(__dirname, "../src/pages/protocol/ProtocolCreateTab.tsx"), "utf8");

describe("协议账号默认后端", () => {
  it("从运行时资料读取默认协议端，并用于创建表单", () => {
    expect(apiSource).toContain('default_protocol_backend?: "napcat" | "snowluma"');
    expect(createSource).toContain("protocolFetchRuntimeProfile");
    expect(createSource).toContain("defaultProtocolBackend");
  });
});
