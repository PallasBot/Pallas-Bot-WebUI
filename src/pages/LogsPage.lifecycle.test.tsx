// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LogsPage from "@/pages/LogsPage";
import LogVirtualFeed from "@/components/LogVirtualFeed";
import type { LogEntry } from "@/api/pallasTypes";

const api = vi.hoisted(() => ({ fetchLogs: vi.fn(), openLogsEventSource: vi.fn() }));
const streamAuth = vi.hoisted(() => ({ probe: vi.fn() }));
const clipboard = vi.hoisted(() => ({ copy: vi.fn(async (_text: string) => true) }));

vi.mock("@/api/fullConsole", () => api);
vi.mock("@/api/consoleApi", () => ({
  fetchCommonConfig: vi.fn(async () => ({ fields: [] })),
  putCommonConfig: vi.fn(),
}));
vi.mock("@/utils/consoleStreamAuth", () => ({ probeConsoleStreamUnauthorized: streamAuth.probe }));
vi.mock("@/utils/clipboard", () => ({ copyTextToClipboard: clipboard.copy }));

class StubEventSource {
  static instances: StubEventSource[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly source: string) {
    StubEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emit(data: string, lastEventId = "") {
    this.onmessage?.({ data, lastEventId } as MessageEvent);
  }
}

function logs(source: string, sources = ["hub", "work"]) {
  return {
    entries: [{ id: 1, time: "2026-10-03 12:00:00", level: "info", scope: source, message: `${source} response` }],
    lines: [],
    log_sources: sources,
    sharded_logs: true,
    max: 200,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  StubEventSource.instances = [];
  sessionStorage.clear();
  streamAuth.probe.mockResolvedValue(false);
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.setPointerCapture ??= () => {};
  HTMLElement.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  api.openLogsEventSource.mockImplementation((scope: string, source: string) => new StubEventSource(`${scope}:${source}`));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("keeps the pinned log snapshot when a reused ID is filtered or evicted", async () => {
  const user = userEvent.setup();
  const before: LogEntry = { id: 1, time: "2026-10-03 12:00:00", level: "info", scope: "hub", message: "old process log" };
  const after: LogEntry = { ...before, time: "2026-10-03 12:02:00", message: "new process log" };
  const view = render(<LogVirtualFeed rows={[before, after]} followTail={false} />);
  await user.click(screen.getByRole("button", { name: /old process log/ }));
  expect(view.container.querySelector(".log-virtual-feed__detail-body")?.textContent).toBe(before.message);

  view.rerender(<LogVirtualFeed rows={[after]} followTail={false} />);
  expect(view.container.querySelector(".log-virtual-feed__detail-body")?.textContent).toBe(before.message);
  expect(view.container.querySelector(".log-line--virtual-pinned")).toBeNull();
  await user.click(screen.getByRole("button", { name: "复制整行日志" }));
  await waitFor(() => expect(clipboard.copy).toHaveBeenCalledTimes(1));
  expect(clipboard.copy.mock.calls[0][0]).toContain(before.message);
  expect(clipboard.copy.mock.calls[0][0]).not.toContain(after.message);
  await user.click(screen.getByRole("button", { name: "取消固定" }));
  expect(view.container.querySelector(".log-virtual-feed__detail-body")).toBeNull();
});

it("keeps a pinned log updated when its continuation is appended", async () => {
  const user = userEvent.setup();
  const before: LogEntry = {
    id: 8,
    time: "2026-10-03 12:00:00",
    level: "error",
    scope: "hub",
    message: "Traceback (most recent call last):",
  };
  const after: LogEntry = {
    ...before,
    message: `${before.message}\n  File \"app.py\", line 8, in run`,
  };
  const view = render(<LogVirtualFeed rows={[before]} followTail={false} />);
  await user.click(screen.getByRole("button", { name: /Traceback/ }));

  view.rerender(<LogVirtualFeed rows={[after]} followTail={false} />);

  expect(view.container.querySelector(".log-virtual-feed__detail-body")?.textContent).toBe(after.message);
  expect(view.container.querySelector(".log-line--virtual-pinned")).not.toBeNull();
});

it("keeps the selected source when an older HTTP response arrives late", async () => {
  const user = userEvent.setup();
  const oldHub = deferred<ReturnType<typeof logs>>();
  let hubCalls = 0;
  api.fetchLogs.mockImplementation((_n: number, _scope: string, source: string) => {
    if (source === "work") return Promise.resolve(logs("work"));
    hubCalls += 1;
    return hubCalls === 1 ? oldHub.promise : Promise.resolve(logs("hub"));
  });

  render(<MemoryRouter><LogsPage /></MemoryRouter>);
  await screen.findByText("hub response");
  await user.click(screen.getByRole("button", { name: /筛选/ }));
  await user.click(screen.getByRole("combobox", { name: "日志来源" }));
  await user.click(screen.getByRole("option", { name: "work aux" }));
  await screen.findByText("work response");

  oldHub.resolve({ ...logs("hub"), log_sources: ["hub", "stale-source"] });
  await waitFor(() => expect(screen.queryByRole("option", { name: "stale-source" })).toBeNull());
  await user.click(screen.getByRole("combobox", { name: "日志来源" }));
  expect(screen.getByRole("option", { name: "work aux" })).toBeTruthy();
});

it("ignores ready, malformed, and already-consumed SSE event IDs", async () => {
  api.fetchLogs.mockImplementation((_n: number, _scope: string, source: string) => Promise.resolve(logs(source || "hub")));
  render(<MemoryRouter><LogsPage /></MemoryRouter>);
  await screen.findByText(/(?:hub|work) response/);
  await waitFor(() => expect(StubEventSource.instances.length).toBeGreaterThan(0));
  const stream = StubEventSource.instances.at(-1)!;
  const source = stream.source.split(":").at(-1)!;
  const row = { id: 42, time: "2026-10-03 12:01:00", level: "info", scope: source, message: "duplicate-safe" };

  stream.emit(JSON.stringify({ type: "ready" }));
  stream.emit("{");
  stream.emit(JSON.stringify(row), "42");
  stream.emit(JSON.stringify(row), "42");

  await screen.findByText("+1 实时");
  expect(screen.queryByText("+2 实时")).toBeNull();
  expect(sessionStorage.getItem(`pallas:logs:last-event-id:all:${source}`)).toBe("42");
});

it("accepts out-of-order and reused IDs with new content while suppressing exact duplicates", async () => {
  api.fetchLogs.mockImplementation((_n: number, _scope: string, source: string) => Promise.resolve(logs(source || "hub")));
  render(<MemoryRouter><LogsPage /></MemoryRouter>);
  await screen.findByText(/(?:hub|work) response/);
  await waitFor(() => expect(StubEventSource.instances.length).toBeGreaterThan(0));
  const stream = StubEventSource.instances.at(-1)!;
  const source = stream.source.split(":").at(-1)!;
  const row = (id: number, message: string) => ({
    id,
    time: "2026-10-03 12:01:00",
    level: "info",
    scope: source,
    message,
  });

  stream.emit(JSON.stringify(row(42, "event 42")), "42");
  stream.emit(JSON.stringify(row(41, "event 41")), "41");
  stream.emit(JSON.stringify(row(42, "event 42")), "42");
  stream.emit(JSON.stringify(row(41, "reused event 41")), "41");

  await screen.findByText("+3 实时");
  expect(screen.queryByText("+4 实时")).toBeNull();
  expect(sessionStorage.getItem(`pallas:logs:last-event-id:all:${source}`)).toBe("41");
});

it("ignores an old stream callback after a source switch and closes both streams on navigation away", async () => {
  const user = userEvent.setup();
  api.fetchLogs.mockImplementation((_n: number, _scope: string, source: string) => Promise.resolve(logs(source || "hub")));
  const view = render(<MemoryRouter><LogsPage /></MemoryRouter>);
  await screen.findByText(/(?:hub|work) response/);
  await user.click(screen.getByRole("button", { name: /筛选/ }));
  const sourceTrigger = screen.getByRole("combobox", { name: "日志来源" });
  const initialSource = sourceTrigger.textContent?.includes("work aux") ? "work" : "hub";
  const oldStream = StubEventSource.instances.at(-1)!;
  const nextSource = initialSource === "hub" ? "work" : "hub";

  await user.click(screen.getByRole("combobox", { name: "日志来源" }));
  await user.click(screen.getByRole("option", { name: nextSource === "work" ? "work aux" : "主进程" }));
  await screen.findByText(`${nextSource} response`);
  const currentStream = StubEventSource.instances.at(-1)!;
  expect(oldStream.closed).toBe(true);

  oldStream.emit(JSON.stringify({ id: 999, time: "2026-10-03 12:01:00", level: "error", scope: initialSource, message: "late source" }), "999");
  expect(sessionStorage.getItem(`pallas:logs:last-event-id:all:${initialSource}`)).toBeNull();

  view.unmount();
  expect(currentStream.closed).toBe(true);
});

it("accepts new log IDs after the server restarts and resets its sequence", async () => {
  api.fetchLogs.mockImplementation((_n: number, _scope: string, source: string) => Promise.resolve(logs(source || "hub")));
  render(<MemoryRouter><LogsPage /></MemoryRouter>);
  await screen.findByText(/(?:hub|work) response/);
  await waitFor(() => expect(StubEventSource.instances.length).toBeGreaterThan(0));
  const stream = StubEventSource.instances.at(-1)!;
  const source = stream.source.split(":").at(-1)!;
  stream.emit(JSON.stringify({ id: 9000, time: "2026-10-03 12:01:00", level: "info", scope: source, message: "before restart" }), "9000");
  await screen.findByText("before restart");
  stream.emit(JSON.stringify({ type: "ready" }));
  stream.emit(JSON.stringify({ id: 1, time: "2026-10-03 12:02:00", level: "info", scope: source, message: "after restart" }), "1");
  await screen.findByText("after restart");
  expect(sessionStorage.getItem(`pallas:logs:last-event-id:all:${source}`)).toBe("1");
});

it("resumes through a real reconnect after the server resets its event sequence", async () => {
  api.fetchLogs.mockImplementation((_n: number, _scope: string, source: string) => Promise.resolve(logs(source || "hub")));
  render(<MemoryRouter><LogsPage /></MemoryRouter>);
  await screen.findByText(/(?:hub|work) response/);
  await waitFor(() => expect(StubEventSource.instances.length).toBeGreaterThan(0));
  const oldStream = StubEventSource.instances.at(-1)!;
  const source = oldStream.source.split(":").at(-1)!;
  const oldRow = { id: 9000, time: "2026-10-03 12:01:00", level: "info", scope: source, message: "before restart" };
  oldStream.emit(JSON.stringify(oldRow), "9000");
  await screen.findByText("before restart");

  const setTimeoutSpy = vi.spyOn(window, "setTimeout");
  try {
    await act(async () => {
      oldStream.onerror?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 3000)).toBe(true));
    const reconnectIndex = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === 3000);
    const reconnectTimer = setTimeoutSpy.mock.results[reconnectIndex].value as number;
    const reconnect = setTimeoutSpy.mock.calls[reconnectIndex][0] as () => void;
    window.clearTimeout(reconnectTimer);
    await act(async () => reconnect());

    expect(oldStream.closed).toBe(true);
    expect(StubEventSource.instances).toHaveLength(2);
    const newStream = StubEventSource.instances.at(-1)!;
    newStream.emit(JSON.stringify({ type: "ready" }));
    expect(sessionStorage.getItem(`pallas:logs:last-event-id:all:${source}`)).toBe("9000");
    newStream.emit(JSON.stringify(oldRow), "9000");
    await screen.findByText("+1 实时");
    newStream.emit(JSON.stringify({
      id: 1,
      time: "2026-10-03 12:02:00",
      level: "info",
      scope: source,
      message: "after reconnect restart",
    }), "1");
    await screen.findByText("after reconnect restart");
    expect(sessionStorage.getItem(`pallas:logs:last-event-id:all:${source}`)).toBe("1");
  } finally {
    setTimeoutSpy.mockRestore();
  }
});
