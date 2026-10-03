// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { clearActiveJob, getActiveJob } from "@/utils/activeJobSession";
import { InstallJobStreamCancelledError, waitForInstallJob } from "@/utils/installJobStream";
import { waitForUpdateApplyJob } from "@/utils/updateApplyJobStream";
import { waitForPluginStoreJob } from "@/utils/pluginStoreJobStream";

class StubEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  close = vi.fn(() => { this.closed = true; });
  emit(data: string) { this.onmessage?.({ data } as MessageEvent); }
}

afterEach(() => {
  sessionStorage.clear();
});

it.each([
  ["ai-install", (id: string, open: (id: string) => EventSource, progress: () => void, signal: AbortSignal) =>
    waitForInstallJob(id, open, progress, signal)],
  ["update-apply", (id: string, open: (id: string) => EventSource, progress: () => void, signal: AbortSignal) =>
    waitForUpdateApplyJob(id, open, progress, undefined, signal)],
  ["plugin-store", (id: string, open: (id: string) => EventSource, progress: () => void, signal: AbortSignal) =>
    waitForPluginStoreJob(id, open, progress, undefined, signal)],
] as const)("cancels only the %s watcher, closes its SSE, and retains its session", async (kind, wait) => {
  const stream = new StubEventSource();
  const controller = new AbortController();
  const onProgress = vi.fn();
  const promise = wait("job-1", () => stream as unknown as EventSource, onProgress, controller.signal);
  expect(getActiveJob(kind)?.jobId).toBe("job-1");

  controller.abort();
  await expect(promise).rejects.toBeInstanceOf(InstallJobStreamCancelledError);
  expect(stream.close).toHaveBeenCalledTimes(1);
  stream.emit(JSON.stringify({ type: "complete", result: { message: "late" } }));
  expect(onProgress).not.toHaveBeenCalled();
  expect(getActiveJob(kind)?.jobId).toBe("job-1");
});

it("settles once when completion and abort race and preserves a newer job ID", async () => {
  const stream = new StubEventSource();
  const controller = new AbortController();
  const promise = waitForPluginStoreJob("older", () => stream as unknown as EventSource, undefined, undefined, controller.signal);
  const completion = expect(promise).resolves.toMatchObject({ type: "complete" });
  stream.emit(JSON.stringify({ type: "complete" }));
  controller.abort();
  await completion;
  expect(stream.close).toHaveBeenCalledTimes(1);
  expect(getActiveJob("plugin-store")).toBeNull();

  const newerStream = new StubEventSource();
  const newerController = new AbortController();
  const newer = waitForPluginStoreJob("newer", () => newerStream as unknown as EventSource, undefined, undefined, newerController.signal);
  const olderStream = new StubEventSource();
  const olderController = new AbortController();
  const older = waitForPluginStoreJob("older-2", () => olderStream as unknown as EventSource, undefined, undefined, olderController.signal);
  newerController.abort();
  await expect(newer).rejects.toBeInstanceOf(InstallJobStreamCancelledError);
  expect(getActiveJob("plugin-store")?.jobId).toBe("older-2");
  olderController.abort();
  await expect(older).rejects.toBeInstanceOf(InstallJobStreamCancelledError);
});

it("does not open a stream for an already-aborted watcher", async () => {
  const controller = new AbortController();
  controller.abort();
  const open = vi.fn();
  await expect(waitForInstallJob("job-pre-aborted", open, undefined, controller.signal)).rejects.toBeInstanceOf(
    InstallJobStreamCancelledError,
  );
  expect(open).not.toHaveBeenCalled();
  expect(getActiveJob("ai-install")?.jobId).toBe("job-pre-aborted");
  clearActiveJob("ai-install", "job-pre-aborted");
});
