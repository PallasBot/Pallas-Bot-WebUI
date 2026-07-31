/** 控制台异步 job：sessionStorage 记住进行中的 job_id，切页后可续看进度。 */

export type ActiveJobKind =
  | "media-assets-download"
  | "ai-install"
  | "update-apply"
  | "plugin-store";

export type ActiveJobEntry = {
  jobId: string;
  updatedAt: number;
  meta?: Record<string, string>;
};

const STORAGE_KEY = "pallas.console.activeJobs.v1";

function readAll(): Partial<Record<ActiveJobKind, ActiveJobEntry>> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<ActiveJobKind, ActiveJobEntry>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(next: Partial<Record<ActiveJobKind, ActiveJobEntry>>): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

export function setActiveJob(
  kind: ActiveJobKind,
  jobId: string,
  meta?: Record<string, string>,
): void {
  const id = String(jobId || "").trim();
  if (!id) return;
  const all = readAll();
  all[kind] = { jobId: id, updatedAt: Date.now(), meta };
  writeAll(all);
}

export function clearActiveJob(kind: ActiveJobKind, jobId?: string): void {
  const all = readAll();
  const cur = all[kind];
  if (!cur) return;
  if (jobId && cur.jobId !== String(jobId).trim()) return;
  delete all[kind];
  writeAll(all);
}

export function getActiveJob(kind: ActiveJobKind): ActiveJobEntry | null {
  const cur = readAll()[kind];
  if (!cur?.jobId) return null;
  return cur;
}

export function listActiveJobs(): Array<ActiveJobEntry & { kind: ActiveJobKind }> {
  const all = readAll();
  const out: Array<ActiveJobEntry & { kind: ActiveJobKind }> = [];
  for (const kind of Object.keys(all) as ActiveJobKind[]) {
    const entry = all[kind];
    if (entry?.jobId) out.push({ kind, ...entry });
  }
  return out;
}
