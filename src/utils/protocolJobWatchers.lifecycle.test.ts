// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchBatch: vi.fn(),
  streamBatch: vi.fn(),
  fetchPull: vi.fn(),
  streamPull: vi.fn(),
}));

vi.mock("@/api/protocol", () => ({
  protocolFetchBatchJob: api.fetchBatch,
  protocolStreamBatchJob: api.streamBatch,
  protocolFetchDockerPullJob: api.fetchPull,
  protocolStreamDockerPullJob: api.streamPull,
}));

import { waitForProtocolBatchJob } from "@/utils/protocolBatch";
import { waitForDockerPullJob } from "@/utils/protocolDockerPull";

class StubEventSource {
  static readonly CLOSED = 2;
  readyState = 1;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  closed = false;
  listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback = typeof listener === "function" ? listener : (event: Event) => listener.handleEvent(event);
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(callback);
    this.listeners.set(type, listeners);
  }

  close(): void {
    this.closed = true;
    this.readyState = StubEventSource.CLOSED;
  }

  emit(type: string, data: string): void {
    const event = new MessageEvent(type, { data });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("protocol batch watcher lifecycle", () => {
  it("keeps watching after a transient SSE error while the job is still running", async () => {
    vi.stubGlobal("EventSource", StubEventSource);
    const stream = new StubEventSource();
    const running = { job_id: "batch-1", status: "running", completed: 1, total: 2 };
    const completed = { ...running, status: "completed", completed: 2 };
    api.streamBatch.mockReturnValue(stream as unknown as EventSource);
    api.fetchBatch.mockResolvedValue(running);

    const watched = waitForProtocolBatchJob("/protocol/console", "batch-1");
    stream.readyState = 0;
    stream.onerror?.call(stream as unknown as EventSource, new Event("error"));
    await vi.waitFor(() => expect(api.fetchBatch).toHaveBeenCalledTimes(1));
    let settled = false;
    void watched.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    stream.emit("progress", "{");
    stream.emit("snapshot", JSON.stringify(completed));
    await expect(watched).resolves.toEqual(completed);
    expect(stream.closed).toBe(true);
  });

  it("single-flights a closed-stream fallback and one poll, then ignores late errors", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", StubEventSource);
    const stream = new StubEventSource();
    const fallback = deferred<{ job_id: string; status: string; completed: number; total: number }>();
    const completed = { job_id: "batch-2", status: "completed", completed: 2, total: 2 };
    api.streamBatch.mockReturnValue(stream as unknown as EventSource);
    api.fetchBatch.mockReturnValueOnce(fallback.promise).mockResolvedValueOnce(completed);

    const watched = waitForProtocolBatchJob("/protocol/console", "batch-2", { pollMs: 10 });
    stream.readyState = StubEventSource.CLOSED;
    stream.onerror?.call(stream as unknown as EventSource, new Event("error"));
    stream.onerror?.call(stream as unknown as EventSource, new Event("error"));
    expect(api.fetchBatch).toHaveBeenCalledTimes(1);

    fallback.resolve({ job_id: "batch-2", status: "running", completed: 1, total: 2 });
    await Promise.resolve();
    await Promise.resolve();
    expect(api.fetchBatch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    stream.onerror?.call(stream as unknown as EventSource, new Event("error"));
    expect(api.fetchBatch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10);
    await expect(watched).resolves.toEqual(completed);
    expect(api.fetchBatch).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    stream.onerror?.call(stream as unknown as EventSource, new Event("error"));
    expect(api.fetchBatch).toHaveBeenCalledTimes(2);
  });

  it("does not poll after abort while a closed-stream fallback is pending", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", StubEventSource);
    const stream = new StubEventSource();
    const fallback = deferred<{ job_id: string; status: string; completed: number; total: number }>();
    const controller = new AbortController();
    api.streamBatch.mockReturnValue(stream as unknown as EventSource);
    api.fetchBatch.mockReturnValue(fallback.promise);

    const watched = waitForProtocolBatchJob("/protocol/console", "batch-3", { pollMs: 10, signal: controller.signal });
    stream.readyState = StubEventSource.CLOSED;
    const lateError = stream.onerror!;
    lateError.call(stream as unknown as EventSource, new Event("error"));
    controller.abort();
    await expect(watched).rejects.toMatchObject({ name: "AbortError" });
    fallback.resolve({ job_id: "batch-3", status: "running", completed: 1, total: 2 });
    await Promise.resolve();
    await Promise.resolve();
    lateError.call(stream as unknown as EventSource, new Event("error"));

    expect(api.fetchBatch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(stream.closed).toBe(true);
  });

  it("clears timers when the closed-stream fallback fails", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", StubEventSource);
    const stream = new StubEventSource();
    const failure = new Error("fixture batch status failure");
    api.streamBatch.mockReturnValue(stream as unknown as EventSource);
    api.fetchBatch.mockRejectedValue(failure);

    const watched = waitForProtocolBatchJob("/protocol/console", "batch-error", { pollMs: 10 });
    stream.readyState = StubEventSource.CLOSED;
    stream.onerror?.call(stream as unknown as EventSource, new Event("error"));
    await expect(watched).rejects.toBe(failure);
    stream.onerror?.call(stream as unknown as EventSource, new Event("error"));

    expect(api.fetchBatch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(stream.closed).toBe(true);
  });

  it("single-flights Docker closed-stream errors and ignores the saved callback after abort", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", StubEventSource);
    const stream = new StubEventSource();
    const pending = deferred<{ job_id: string; status: string }>();
    const controller = new AbortController();
    api.streamPull.mockReturnValue(stream as unknown as EventSource);
    api.fetchPull.mockReturnValue(pending.promise);

    const watched = waitForDockerPullJob("/protocol/console", "pull-1", { pollMs: 10, signal: controller.signal });
    const lateError = stream.onerror!;
    stream.readyState = StubEventSource.CLOSED;
    lateError.call(stream as unknown as EventSource, new Event("error"));
    lateError.call(stream as unknown as EventSource, new Event("error"));
    expect(api.fetchPull).toHaveBeenCalledTimes(1);

    controller.abort();
    await expect(watched).rejects.toMatchObject({ name: "AbortError" });
    pending.reject(new Error("late fixture error"));
    await Promise.resolve();
    await Promise.resolve();
    lateError.call(stream as unknown as EventSource, new Event("error"));

    expect(api.fetchPull).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(stream.closed).toBe(true);
  });

  it("clears a scheduled Docker poll on terminal SSE and ignores later error callbacks", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", StubEventSource);
    const stream = new StubEventSource();
    const running = { job_id: "pull-2", status: "running" };
    const completed = { ...running, status: "completed" };
    api.streamPull.mockReturnValue(stream as unknown as EventSource);
    api.fetchPull.mockResolvedValue(running);

    const watched = waitForDockerPullJob("/protocol/console", "pull-2", { pollMs: 10 });
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    stream.emit("snapshot", JSON.stringify(completed));
    await expect(watched).resolves.toEqual(completed);
    const lateError = stream.onerror!;
    lateError.call(stream as unknown as EventSource, new Event("error"));

    expect(api.fetchPull).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(stream.closed).toBe(true);
  });
});
