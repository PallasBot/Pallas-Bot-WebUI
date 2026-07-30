import { describe, expect, it } from "vitest";
import {
  resolveAiInstallPrimary,
  showAiInstallBootstrapSecondary,
} from "../src/utils/aiInstallPrimary";

describe("resolveAiInstallPrimary", () => {
  it("prefers clone when available", () => {
    const p = resolveAiInstallPrimary({ canClone: true, canBootstrap: false, canUpdate: false });
    expect(p).toMatchObject({ action: "clone_and_bootstrap", label: "下载并安装", enabled: true });
  });

  it("uses update for managed install", () => {
    const p = resolveAiInstallPrimary({ canClone: false, canBootstrap: true, canUpdate: true });
    expect(p).toMatchObject({ action: "update", label: "更新 Runtime", enabled: true });
  });

  it("falls back to bootstrap for sibling source", () => {
    const p = resolveAiInstallPrimary({ canClone: false, canBootstrap: true, canUpdate: false });
    expect(p).toMatchObject({ action: "bootstrap", label: "安装依赖", enabled: true });
  });

  it("disables when nothing available", () => {
    const p = resolveAiInstallPrimary({ canClone: false, canBootstrap: false, canUpdate: false });
    expect(p.enabled).toBe(false);
  });
});

describe("showAiInstallBootstrapSecondary", () => {
  it("only when update is primary path", () => {
    expect(showAiInstallBootstrapSecondary({ canBootstrap: true, canUpdate: true })).toBe(true);
    expect(showAiInstallBootstrapSecondary({ canBootstrap: true, canUpdate: false })).toBe(false);
    expect(showAiInstallBootstrapSecondary({ canBootstrap: false, canUpdate: true })).toBe(false);
  });
});
