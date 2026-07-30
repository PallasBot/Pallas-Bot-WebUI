import { describe, expect, it } from "vitest";
import {
  aiInstallSubtitle,
  resolveAiInstallPrimary,
  showAiInstallBootstrapSecondary,
} from "../src/utils/aiInstallPrimary";

describe("resolveAiInstallPrimary", () => {
  it("prefers clone when available", () => {
    const p = resolveAiInstallPrimary({ canClone: true, canBootstrap: false, canUpdate: false });
    expect(p).toMatchObject({ action: "clone_and_bootstrap", label: "下载并安装", enabled: true });
  });

  it("uses update when managed and behind remote", () => {
    const p = resolveAiInstallPrimary({
      canClone: false,
      canBootstrap: true,
      canUpdate: true,
      hasUpdate: true,
    });
    expect(p).toMatchObject({ action: "update", label: "更新 Runtime", enabled: true });
    expect(p.visible).toBeUndefined();
  });

  it("hides update when already latest", () => {
    const p = resolveAiInstallPrimary({
      canClone: false,
      canBootstrap: true,
      canUpdate: true,
      hasUpdate: false,
    });
    expect(p).toMatchObject({ action: "update", enabled: false, visible: false });
  });

  it("offers check-and-update when probe unknown", () => {
    const p = resolveAiInstallPrimary({
      canClone: false,
      canBootstrap: true,
      canUpdate: true,
      hasUpdate: null,
    });
    expect(p).toMatchObject({ action: "update", label: "检查并更新", enabled: true });
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
  it("when managed path can update", () => {
    expect(showAiInstallBootstrapSecondary({ canBootstrap: true, canUpdate: true })).toBe(true);
    expect(showAiInstallBootstrapSecondary({ canBootstrap: true, canUpdate: false })).toBe(false);
    expect(showAiInstallBootstrapSecondary({ canBootstrap: false, canUpdate: true })).toBe(false);
  });
});

describe("aiInstallSubtitle", () => {
  it("covers key states", () => {
    expect(aiInstallSubtitle({ localInstallUi: false, canClone: false, canUpdate: false })).toContain("Docker");
    expect(aiInstallSubtitle({ localInstallUi: true, canClone: true, canUpdate: false })).toContain("下载并安装");
    expect(
      aiInstallSubtitle({ localInstallUi: true, canClone: false, canUpdate: true, hasUpdate: true }),
    ).toContain("更新 Runtime");
    expect(
      aiInstallSubtitle({ localInstallUi: true, canClone: false, canUpdate: true, hasUpdate: false }),
    ).toContain("已是最新");
    expect(
      aiInstallSubtitle({ localInstallUi: true, canClone: false, canUpdate: true, hasUpdate: null }),
    ).toContain("检查并更新");
  });
});
