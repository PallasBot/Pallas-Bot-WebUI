// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchJob: vi.fn(),
  listImages: vi.fn(),
  start: vi.fn(),
  stream: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/api/protocol", () => ({
  protocolApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  protocolFetchSnowlumaRuntimeImageSwitchJob: api.fetchJob,
  protocolListDockerImages: api.listImages,
  protocolStartSnowlumaRuntimeImageSwitch: api.start,
  protocolStreamSnowlumaRuntimeImageSwitchJob: api.stream,
}));
vi.mock("@/utils/consoleToast", () => ({ pushConsoleToast: api.toast }));

import ProtocolRuntimeImageSwitchDialog from "@/components/ProtocolRuntimeImageSwitchDialog";

type Job = { job_id: string; status: string; message?: string };

class StubEventSource {
  static readonly CLOSED = 2;
  readyState = 1;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  listeners = new Map<string, Set<EventListener>>();
  close = vi.fn(() => { this.readyState = StubEventSource.CLOSED; });

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback = typeof listener === "function" ? listener : (event: Event) => listener.handleEvent(event);
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(callback);
    this.listeners.set(type, listeners);
  }

  emit(type: string, job: Job): void {
    const event = new MessageEvent(type, { data: JSON.stringify(job) });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const runningJob: Job = { job_id: "image-job", status: "running", message: "fixture running" };

function props(overrides: Partial<ComponentProps<typeof ProtocolRuntimeImageSwitchDialog>> = {}) {
  return {
    open: true,
    mountUrl: "http://protocol.test/old/protocol/console",
    runtimeCount: 1,
    onClose: vi.fn(),
    onFinished: vi.fn(),
    onBusyChange: vi.fn(),
    ...overrides,
  };
}

async function chooseImageAndStart(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "Docker 镜像" }));
  const input = await screen.findByPlaceholderText("输入镜像名，Enter 确认");
  await user.type(input, "fixture/new:latest");
  await user.keyboard("{Enter}");
  await user.click(screen.getByRole("radio", { name: /下次启动时使用/ }));
  await user.click(screen.getByRole("button", { name: "保存并等待下次启动" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listImages.mockResolvedValue({ ok: true, images: [] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("ignores a start response that arrives after unmount", async () => {
  const user = userEvent.setup();
  const start = deferred<{ job_id: string; job: Job }>();
  api.start.mockReturnValue(start.promise);
  const pageProps = props();
  const view = render(<ProtocolRuntimeImageSwitchDialog {...pageProps} />);

  await chooseImageAndStart(user);
  await waitFor(() => expect(api.start).toHaveBeenCalledTimes(1));
  view.unmount();
  await act(async () => {
    start.resolve({ job_id: "late-job", job: { job_id: "late-job", status: "completed" } });
    await start.promise;
  });

  expect(api.stream).not.toHaveBeenCalled();
  expect(pageProps.onFinished).not.toHaveBeenCalled();
  expect(api.toast).not.toHaveBeenCalled();
});

it("does not let an old start response replace a reopened dialog on a new mount", async () => {
  const user = userEvent.setup();
  const oldStart = deferred<{ job_id: string; job: Job }>();
  const newStart = deferred<{ job_id: string; job: Job }>();
  const newStream = new StubEventSource();
  api.start.mockReturnValueOnce(oldStart.promise).mockReturnValueOnce(newStart.promise);
  api.stream.mockReturnValue(newStream);
  const pageProps = props();
  const view = render(<ProtocolRuntimeImageSwitchDialog {...pageProps} />);

  await chooseImageAndStart(user);
  await waitFor(() => expect(api.start).toHaveBeenCalledTimes(1));
  view.rerender(<ProtocolRuntimeImageSwitchDialog {...pageProps} open={false} />);
  view.rerender(<ProtocolRuntimeImageSwitchDialog {...pageProps} open mountUrl="http://protocol.test/new/protocol/console" />);
  await chooseImageAndStart(user);
  await waitFor(() => expect(api.start).toHaveBeenCalledTimes(2));

  await act(async () => {
    oldStart.resolve({ job_id: "old-job", job: { job_id: "old-job", status: "running" } });
    await oldStart.promise;
  });
  expect(api.stream).not.toHaveBeenCalled();
  expect(pageProps.onFinished).not.toHaveBeenCalled();

  await act(async () => {
    newStart.resolve({ job_id: "new-job", job: { job_id: "new-job", status: "running" } });
    await newStart.promise;
  });
  await waitFor(() => expect(api.stream).toHaveBeenCalledWith("http://protocol.test/new/protocol/console", "new-job"));
});

it("does not reapply terminal SSE callbacks or re-arm inactivity fallback", async () => {
  const user = userEvent.setup();
  const stream = new StubEventSource();
  api.start.mockResolvedValue({ job_id: runningJob.job_id, job: runningJob });
  api.stream.mockReturnValue(stream);
  const pageProps = props();
  const setTimeoutSpy = vi.spyOn(window, "setTimeout");
  render(<ProtocolRuntimeImageSwitchDialog {...pageProps} />);

  await chooseImageAndStart(user);
  await waitFor(() => expect(api.stream).toHaveBeenCalledTimes(1));
  const completed = { ...runningJob, status: "completed", message: "fixture complete" };
  act(() => stream.emit("snapshot", completed));
  await waitFor(() => expect(pageProps.onFinished).toHaveBeenCalledTimes(1));
  expect(setTimeoutSpy.mock.calls.filter((call) => call[1] === 5_000)).toHaveLength(1);

  act(() => {
    stream.emit("progress", runningJob);
    stream.onerror?.call(stream as unknown as EventSource, new Event("error"));
  });
  await act(async () => { await Promise.resolve(); });

  expect(api.fetchJob).not.toHaveBeenCalled();
  expect(pageProps.onFinished).toHaveBeenCalledTimes(1);
  expect(api.toast).toHaveBeenCalledTimes(1);
  expect(setTimeoutSpy.mock.calls.filter((call) => call[1] === 5_000)).toHaveLength(1);
});

it("closes a running watcher on close and ignores its callbacks after reopening", async () => {
  const user = userEvent.setup();
  const stream = new StubEventSource();
  api.start.mockResolvedValue({ job_id: runningJob.job_id, job: runningJob });
  api.stream.mockReturnValue(stream);
  const pageProps = props();
  const view = render(<ProtocolRuntimeImageSwitchDialog {...pageProps} />);

  await chooseImageAndStart(user);
  await waitFor(() => expect(api.stream).toHaveBeenCalledTimes(1));
  const lateError = stream.onerror!;
  view.rerender(<ProtocolRuntimeImageSwitchDialog {...pageProps} open={false} />);
  expect(stream.close).toHaveBeenCalledTimes(1);
  view.rerender(<ProtocolRuntimeImageSwitchDialog {...pageProps} open />);

  act(() => {
    stream.emit("progress", { ...runningJob, status: "completed" });
    lateError.call(stream as unknown as EventSource, new Event("error"));
  });
  await act(async () => { await Promise.resolve(); });

  expect(api.stream).toHaveBeenCalledTimes(1);
  expect(api.fetchJob).not.toHaveBeenCalled();
  expect(pageProps.onFinished).not.toHaveBeenCalled();
  expect(api.toast).not.toHaveBeenCalled();
});

it("does not schedule fallback after a pending status request fails following close", async () => {
  const user = userEvent.setup();
  const status = deferred<Job>();
  const stream = new StubEventSource();
  api.start.mockResolvedValue({ job_id: runningJob.job_id, job: runningJob });
  api.stream.mockReturnValue(stream);
  api.fetchJob.mockReturnValue(status.promise);
  const pageProps = props();
  const setTimeoutSpy = vi.spyOn(window, "setTimeout");
  const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
  const view = render(<ProtocolRuntimeImageSwitchDialog {...pageProps} />);

  await chooseImageAndStart(user);
  await waitFor(() => expect(api.stream).toHaveBeenCalledTimes(1));
  stream.readyState = StubEventSource.CLOSED;
  act(() => stream.onerror?.call(stream as unknown as EventSource, new Event("error")));
  await waitFor(() => expect(api.fetchJob).toHaveBeenCalledTimes(1));
  view.rerender(<ProtocolRuntimeImageSwitchDialog {...pageProps} open={false} />);
  status.reject(new Error("fixture status failure"));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });

  expect(setTimeoutSpy.mock.calls.filter((call) => call[1] === 900 || call[1] === 2_000)).toHaveLength(0);
  expect(api.toast).not.toHaveBeenCalled();
  expect(clearTimeoutSpy).toHaveBeenCalled();
});
