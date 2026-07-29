import { describe, expect, it, vi } from "vitest";
import { InstallJobFailedError, waitForInstallJob } from "@/utils/installJobStream";

function mockEventSource(emit: (handler: (ev: MessageEvent) => void) => void) {
  let messageHandler: ((ev: MessageEvent) => void) | undefined;
  const openStream = vi.fn(() => {
    const source = {
      close: vi.fn(),
      set onmessage(fn: (ev: MessageEvent) => void) {
        messageHandler = fn;
      },
      set onerror(_fn: () => void) {},
    };
    queueMicrotask(() => {
      if (messageHandler) emit(messageHandler);
    });
    return source as unknown as EventSource;
  });
  return openStream;
}

describe("waitForInstallJob", () => {
  it("resolves on complete event", async () => {
    const openStream = mockEventSource((handler) => {
      handler({
        data: JSON.stringify({
          type: "complete",
          phase: "done",
          message: "ok",
          progress_percent: 100,
          result: { message: "ok" },
        }),
      } as MessageEvent);
    });

    await expect(waitForInstallJob("job-1", openStream)).resolves.toMatchObject({
      type: "complete",
      phase: "done",
    });
  });

  it("reports progress percent and lines", async () => {
    const seen: Array<{ percent: number; message: string; line?: string }> = [];
    const openStream = mockEventSource((handler) => {
      handler({
        data: JSON.stringify({
          type: "progress",
          phase: "running",
          message: "pip…",
          progress_percent: 55,
          line: "Collecting torch",
        }),
      } as MessageEvent);
      handler({
        data: JSON.stringify({
          type: "complete",
          phase: "done",
          message: "ok",
          progress_percent: 100,
        }),
      } as MessageEvent);
    });

    await waitForInstallJob("job-2", openStream, (p) => {
      seen.push({ percent: p.percent, message: p.message, line: p.line });
    });
    expect(seen[0]).toEqual({ percent: 55, message: "pip…", line: "Collecting torch" });
  });

  it("rejects with output_tail on failed complete", async () => {
    const openStream = mockEventSource((handler) => {
      handler({
        data: JSON.stringify({
          type: "complete",
          phase: "failed",
          error: "bootstrap 退出码 1",
          progress_percent: 70,
          log_lines: ["err-line"],
          result: { output_tail: "fatal: boom", exit_code: 1 },
        }),
      } as MessageEvent);
    });

    await expect(waitForInstallJob("job-3", openStream)).rejects.toMatchObject({
      name: "InstallJobFailedError",
      message: "bootstrap 退出码 1",
      result: { output_tail: "fatal: boom", exit_code: 1 },
      logLines: ["err-line"],
    } satisfies Partial<InstallJobFailedError>);
  });
});
