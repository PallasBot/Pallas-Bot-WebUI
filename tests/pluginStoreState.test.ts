import { describe, expect, it } from "vitest";

type ActivationPolicy = "hot-reloadable" | "workers-restart" | "full-restart" | null | undefined;
type ActivationAction = "none" | "hot-reload" | "workers-restart" | "full-restart" | null | undefined;

function resultNeedsRestart(result: { needs_restart?: boolean; restart_scheduled?: boolean } | null): boolean {
  return Boolean(result?.needs_restart) && !Boolean(result?.restart_scheduled);
}

function actionStateLabel(
  policy: ActivationPolicy,
  result: { needs_restart?: boolean; restart_scheduled?: boolean; activation_action?: ActivationAction } | null,
): string {
  const action = result?.activation_action || null;
  if (action === "hot-reload") return "已热重载";
  if (result?.restart_scheduled) return "已安排重启";
  if (resultNeedsRestart(result)) {
    if (policy === "workers-restart") return "待重启 Worker";
    return "待重启";
  }
  return "";
}

function officialInstalledVersionLabel(
  latestRef: string | null | undefined,
  installedRef: string | null | undefined,
  result: { activation_action?: ActivationAction } | null,
): string {
  if (result?.activation_action === "hot-reload" && latestRef) return latestRef;
  return (installedRef || "").trim();
}

describe("plugin store action state", () => {
  it("marks hot-reload result as loaded instead of pending restart", () => {
    expect(actionStateLabel("hot-reloadable", {
      needs_restart: false,
      restart_scheduled: false,
      activation_action: "hot-reload",
    })).toBe("已热重载");
  });

  it("marks worker restart plugins as pending worker restart", () => {
    expect(actionStateLabel("workers-restart", {
      needs_restart: true,
      restart_scheduled: false,
      activation_action: "none",
    })).toBe("待重启 Worker");
  });

  it("uses latest ref as current version after hot reload", () => {
    expect(officialInstalledVersionLabel("1.2.4", "1.2.3", {
      activation_action: "hot-reload",
    })).toBe("1.2.4");
  });
});
