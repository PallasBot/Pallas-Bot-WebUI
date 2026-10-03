import { afterEach, expect, it, vi } from "vitest";

const probe = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/api/consoleOpenapiClient", () => ({ consoleOpenapiGet: probe.get }));

async function loadProbe() {
  vi.resetModules();
  return import("./consoleStreamAuth");
}

afterEach(() => {
  vi.restoreAllMocks();
});

it("identifies only an explicit protected-request 401 as expired authentication", async () => {
  const auth = await loadProbe();
  let now = 1_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const unauthorized = Object.assign(new Error("expired"), { isAxiosError: true, response: { status: 401 } });
  probe.get.mockRejectedValueOnce(unauthorized).mockRejectedValueOnce(new Error("offline"));

  await expect(auth.probeConsoleStreamUnauthorized()).resolves.toBe(true);
  now = 3_000;
  await expect(auth.probeConsoleStreamUnauthorized()).resolves.toBe(false);
  expect(probe.get).toHaveBeenCalledWith("/system", { timeout: 2_000 });
  expect(probe.get).toHaveBeenCalledTimes(2);
});

it("shares concurrent probes and rate-limits recurring network failures", async () => {
  const auth = await loadProbe();
  let resolve!: () => void;
  probe.get.mockReturnValueOnce(new Promise<void>((yes) => { resolve = yes; }));

  const first = auth.probeConsoleStreamUnauthorized();
  const concurrent = auth.probeConsoleStreamUnauthorized();
  expect(probe.get).toHaveBeenCalledTimes(1);
  resolve();
  await expect(Promise.all([first, concurrent])).resolves.toEqual([false, false]);
  await expect(auth.probeConsoleStreamUnauthorized()).resolves.toBe(false);
  expect(probe.get).toHaveBeenCalledTimes(1);
});
