import { describe, expect, it } from "vitest";
import {
  extensionActionStateLabel,
  extensionResultNeedsRestart,
} from "@/config/extensionActivationSemantics";

function officialInstalledVersionLabel(
  latestRef: string | null | undefined,
  installedRef: string | null | undefined,
  result: { activation_action?: "hot-reload" | null } | null,
): string {
  if (result?.activation_action === "hot-reload" && latestRef) return latestRef;
  return (installedRef || "").trim();
}

describe("plugin store action state", () => {
  it("marks hot-reload result as loaded instead of pending restart", () => {
    expect(extensionActionStateLabel("hot-reloadable", {
      needs_restart: false,
      restart_scheduled: false,
      activation_action: "hot-reload",
    })).toBe("已热更新");
  });

  it("marks worker restart plugins as pending worker restart", () => {
    expect(extensionActionStateLabel("workers-restart", {
      needs_restart: true,
      restart_scheduled: false,
      activation_action: "none",
    })).toBe("待重启分片节点");
  });

  it("marks full restart plugins as pending full restart", () => {
    expect(extensionActionStateLabel("full-restart", {
      needs_restart: true,
      restart_scheduled: false,
      activation_action: "none",
    })).toBe("待重启全部进程");
  });

  it("distinguishes scheduled worker restart from generic restart", () => {
    expect(extensionActionStateLabel("workers-restart", {
      needs_restart: true,
      restart_scheduled: true,
      activation_action: "workers-restart",
    })).toBe("已安排重启分片节点");
  });

  it("treats scheduled restart as not pending manual restart", () => {
    expect(extensionResultNeedsRestart({
      needs_restart: true,
      restart_scheduled: true,
    })).toBe(false);
  });

  it("uses latest ref as current version after hot reload", () => {
    expect(officialInstalledVersionLabel("1.2.4", "1.2.3", {
      activation_action: "hot-reload",
    })).toBe("1.2.4");
  });
});
