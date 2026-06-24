import { ref } from "vue";
import { fetchConsoleSetupStatus } from "@/api/consoleApi";
import type { ConsoleSetupStatus } from "@/api/pallasTypes";

const CONSOLE_SETUP_FRESH_MS = 15_000;

export const consoleSetupStatus = ref<ConsoleSetupStatus | null>(null);
export const consoleSetupLoading = ref(false);
export const consoleSetupStatusKnown = ref(false);
export const consoleSetupStatusError = ref("");

let consoleSetupFetchedAt = 0;
let consoleSetupInflight: Promise<ConsoleSetupStatus | null> | null = null;

export function patchConsoleSetupStatus(status: ConsoleSetupStatus | null): void {
  consoleSetupStatus.value = status;
  consoleSetupStatusKnown.value = status !== null;
  consoleSetupStatusError.value = "";
  consoleSetupFetchedAt = status ? Date.now() : 0;
}

export async function loadConsoleSetupStatus(options?: { force?: boolean }): Promise<ConsoleSetupStatus | null> {
  const force = options?.force ?? false;
  const fresh = consoleSetupStatus.value && Date.now() - consoleSetupFetchedAt < CONSOLE_SETUP_FRESH_MS;
  if (!force && fresh) {
    return consoleSetupStatus.value;
  }
  if (consoleSetupInflight) {
    return consoleSetupInflight;
  }
  consoleSetupLoading.value = true;
  consoleSetupStatusError.value = "";
  consoleSetupInflight = fetchConsoleSetupStatus()
    .then((status) => {
      patchConsoleSetupStatus(status);
      return status;
    })
    .catch((error) => {
      consoleSetupStatusKnown.value = consoleSetupStatus.value !== null;
      consoleSetupStatusError.value = error instanceof Error ? error.message : String(error);
      return consoleSetupStatus.value;
    })
    .finally(() => {
      consoleSetupLoading.value = false;
      consoleSetupInflight = null;
    });
  return consoleSetupInflight;
}

export function requiresConsoleSetup(status: ConsoleSetupStatus | null | undefined): boolean {
  return Boolean(status?.requires_setup);
}

export function consoleSetupSatisfied(status: ConsoleSetupStatus | null | undefined): boolean {
  return Boolean(status?.setup_completed && !status?.requires_setup);
}
