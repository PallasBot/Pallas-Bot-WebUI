import { isAxiosError } from "axios";
import { consoleOpenapiGet, type ConsoleOpenapiPaths } from "@/api/consoleOpenapiClient";

const PROBE_COOLDOWN_MS = 2_000;
let authProbe: Promise<boolean> | null = null;
let lastProbeAt = Number.NEGATIVE_INFINITY;

/** EventSource hides HTTP status; probe an existing protected, low-cost read through the shared 401 interceptor. */
export function probeConsoleStreamUnauthorized(): Promise<boolean> {
  if (authProbe) return authProbe;
  if (Date.now() - lastProbeAt < PROBE_COOLDOWN_MS) return Promise.resolve(false);
  lastProbeAt = Date.now();

  let request: Promise<boolean>;
  request = consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/system"]["get"]>("/system", { timeout: 2_000 })
    .then(() => false)
    .catch((error) => isAxiosError(error) && error.response?.status === 401)
    .finally(() => {
      if (authProbe === request) authProbe = null;
    });
  authProbe = request;
  return request;
}
