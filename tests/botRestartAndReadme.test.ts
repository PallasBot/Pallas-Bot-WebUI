import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  botRestartPhaseLabel,
  healthBootFingerprint,
  isHealthRestartComplete,
  restartProgressSteps,
  waitForBotRestartOnline,
} from "@/utils/botRestartProgress";
import { normalizeBundledReadmeMarkdown } from "@/utils/pluginReadme";

vi.mock("@/api/health", () => ({
  fetchHealth: vi.fn(),
}));

import { fetchHealth } from "@/api/health";

const fetchHealthMock = vi.mocked(fetchHealth);

describe("botRestartPhaseLabel", () => {
  it("describes reconnecting phase", () => {
    expect(botRestartPhaseLabel("reconnecting")).toContain("探测");
  });
});

describe("restartProgressSteps", () => {
  it("reveals restart stages one by one and keeps the current stage active", () => {
    expect(restartProgressSteps("scheduled", true)).toEqual([
      { id: "scheduled", label: "已发送指令", state: "active" },
      { id: "disconnecting", label: "进程退出", state: "hidden" },
      { id: "reconnecting", label: "等待恢复", state: "hidden" },
      { id: "online", label: "恢复在线", state: "hidden" },
    ]);

    expect(restartProgressSteps("reconnecting", true)).toEqual([
      { id: "scheduled", label: "已发送指令", state: "done" },
      { id: "disconnecting", label: "进程退出", state: "done" },
      { id: "reconnecting", label: "等待恢复", state: "active" },
      { id: "online", label: "恢复在线", state: "hidden" },
    ]);
  });

  it("marks every stage done after the bot is online", () => {
    expect(restartProgressSteps("online", false).map((step) => step.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
    ]);
  });
});

describe("healthBootFingerprint", () => {
  it("prefers boot_id when present", () => {
    expect(healthBootFingerprint({ boot_id: "abc123", ok: true } as never)).toBe("abc123");
  });
});

describe("isHealthRestartComplete", () => {
  it("detects boot_id change after offline", () => {
    const complete = isHealthRestartComplete(
      { ok: true, boot_id: "new" } as never,
      "old",
      { sawOffline: false, sawRestarting: false },
      false,
    );
    expect(complete).toBe(true);
  });

  it("accepts workers-only restart after restarting flag", () => {
    const complete = isHealthRestartComplete(
      { ok: true, boot_id: "same" } as never,
      "same",
      { sawOffline: false, sawRestarting: true },
      true,
    );
    expect(complete).toBe(true);
  });
});

describe("waitForBotRestartOnline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchHealthMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores health ok until bot went offline once", async () => {
    const phases: string[] = [];
    const progress: number[] = [];
    fetchHealthMock
      .mockResolvedValueOnce({ ok: true, boot_id: "a" } as never)
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ ok: true, boot_id: "a" } as never);

    const promise = waitForBotRestartOnline({
      pollMs: 500,
      onPhase: (phase) => phases.push(phase),
      onProgress: (p) => progress.push(p),
    });

    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toBe(true);
    expect(phases).toContain("scheduled");
    expect(phases).toContain("disconnecting");
    expect(phases).toContain("online");
    expect(phases.indexOf("online")).toBeGreaterThan(phases.indexOf("disconnecting"));
    expect(progress.length).toBeGreaterThan(0);
  });

  it("completes when boot_id changes without offline", async () => {
    fetchHealthMock
      .mockResolvedValueOnce({ ok: true, restarting: true, boot_id: "old" } as never)
      .mockResolvedValueOnce({ ok: true, boot_id: "new" } as never);

    const promise = waitForBotRestartOnline({
      pollMs: 500,
      baselineFingerprint: "old",
    });

    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toBe(true);
  });
});

describe("normalizeBundledReadmeMarkdown", () => {
  it("rewrites bundled asset paths to console static", () => {
    expect(normalizeBundledReadmeMarkdown('<img src="../assets/brand-avatar.png">')).toContain(
      "/pallas/assets/brand-avatar.png",
    );
  });

  it("rewrites plugin package asset paths when plugin id is provided", () => {
    expect(
      normalizeBundledReadmeMarkdown("![cover](assets/cover.png)", "roulette"),
    ).toBe("![cover](/pallas/plugin-assets/roulette/assets/cover.png)");
  });
});
