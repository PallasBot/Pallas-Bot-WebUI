/** 任务编排 / 本地路由：高低档门面 ↔ 现有多任务 / moe 字段 */

export type RoutingTier = "high" | "low";

export type TierProviderSlot = {
  providerId: string;
  model: string;
};

export type TaskTierState = {
  high: { primary: TierProviderSlot; backup: TierProviderSlot };
  low: { primary: TierProviderSlot; backup: TierProviderSlot };
};

export type LocalTierState = {
  high: { primary: string; backup: string };
  low: { primary: string; backup: string };
};

export const HIGH_TIER_TASKS = ["llm_chat", "drunk", "repeater_polish"] as const;
export const LOW_TIER_TASKS = [
  "repeater_select",
  "repeater_polish_lite",
  "repeater_fallback",
] as const;

export const TIER_TASKS: Record<RoutingTier, readonly string[]> = {
  high: HIGH_TIER_TASKS,
  low: LOW_TIER_TASKS,
};

type ProviderLike = {
  id: string;
  task_models?: Record<string, string>;
  default_model?: string;
};

type ProvidersDocLike<P extends ProviderLike = ProviderLike> = {
  providers: P[];
  routing: {
    chain_fallback: string[];
    tasks: Record<string, string>;
    /** 高低档备用提供方；可与主配置相同（同提供方不同模型） */
    tier_backups?: { high?: string; low?: string };
    /** 高低档备用模型；同提供方时必须靠此字段，避免覆盖主配置 task_models */
    tier_backup_models?: { high?: string; low?: string };
  };
};

type LocalDoc = {
  llm_model?: string;
  local_multi_model_enabled?: boolean;
  moe_models?: Record<string, string>;
  task_models?: Record<string, string>;
};

function emptySlot(): TierProviderSlot {
  return { providerId: "", model: "" };
}

export function emptyTaskTierState(): TaskTierState {
  return {
    high: { primary: emptySlot(), backup: emptySlot() },
    low: { primary: emptySlot(), backup: emptySlot() },
  };
}

export function emptyLocalTierState(): LocalTierState {
  return {
    high: { primary: "", backup: "" },
    low: { primary: "", backup: "" },
  };
}

function majorityProvider(tasks: Record<string, string>, keys: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const key of keys) {
    const pid = String(tasks[key] || "").trim();
    if (!pid) continue;
    counts.set(pid, (counts.get(pid) || 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [pid, count] of counts) {
    if (count > bestCount) {
      best = pid;
      bestCount = count;
    }
  }
  return best;
}

function providerTaskModel(
  providers: ProviderLike[],
  providerId: string,
  taskKeys: readonly string[],
  options?: { fallbackDefault?: boolean },
): string {
  if (!providerId) return "";
  const row = providers.find((p) => p.id === providerId);
  if (!row) return "";
  const models = row.task_models || {};
  for (const task of taskKeys) {
    const model = String(models[task] || "").trim();
    if (model) return model;
  }
  if (options?.fallbackDefault === false) return "";
  return String(row.default_model || "").trim();
}

function uniquePreserve(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** 从现有 routing / providers 折叠为高低主备 */
export function foldTaskTiers<P extends ProviderLike>(doc: ProvidersDocLike<P>): TaskTierState {
  const tasks = doc.routing.tasks || {};
  const chain = (doc.routing.chain_fallback || []).map((id) => String(id || "").trim()).filter(Boolean);
  const highPrimary = majorityProvider(tasks, HIGH_TIER_TASKS);
  const lowPrimary = majorityProvider(tasks, LOW_TIER_TASKS);

  const storedHigh = String(doc.routing.tier_backups?.high || "").trim();
  const storedLow = String(doc.routing.tier_backups?.low || "").trim();
  const storedHighModel = String(doc.routing.tier_backup_models?.high || "").trim();
  const storedLowModel = String(doc.routing.tier_backup_models?.low || "").trim();
  // 有显式字段（含空对象）则不再从 chain 推断，避免交叉主备时选不中
  const hasStoredBackups = Object.prototype.hasOwnProperty.call(doc.routing, "tier_backups");

  let highBackupId = "";
  let lowBackupId = "";
  if (hasStoredBackups) {
    // 允许与主配置同一提供方（用不同模型作备用）
    highBackupId = storedHigh;
    lowBackupId = storedLow;
  } else {
    // 兼容旧配置：从 chain 推断（旧逻辑无法表达同提供方备用）
    const highBackup = chain.find((id) => id !== highPrimary) || "";
    let lowBackup = "";
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      const id = chain[i]!;
      if (id !== lowPrimary) {
        lowBackup = id;
        break;
      }
    }
    highBackupId = highBackup && highBackup !== highPrimary ? highBackup : "";
    lowBackupId = lowBackup && lowBackup !== lowPrimary ? lowBackup : "";
  }

  function backupModel(
    providerId: string,
    primaryId: string,
    taskKeys: readonly string[],
    storedModel: string,
  ): string {
    if (!providerId) return "";
    if (storedModel) return storedModel;
    // 同提供方时不能读 task_models（那是主配置）
    if (providerId === primaryId) return "";
    return providerTaskModel(doc.providers, providerId, taskKeys, { fallbackDefault: false });
  }

  return {
    high: {
      primary: {
        providerId: highPrimary,
        model: providerTaskModel(doc.providers, highPrimary, HIGH_TIER_TASKS),
      },
      backup: {
        providerId: highBackupId,
        model: backupModel(highBackupId, highPrimary, HIGH_TIER_TASKS, storedHighModel),
      },
    },
    low: {
      primary: {
        providerId: lowPrimary,
        model: providerTaskModel(doc.providers, lowPrimary, LOW_TIER_TASKS),
      },
      backup: {
        providerId: lowBackupId,
        model: backupModel(lowBackupId, lowPrimary, LOW_TIER_TASKS, storedLowModel),
      },
    },
  };
}

function setProviderTaskModels<P extends ProviderLike>(
  providers: P[],
  providerId: string,
  taskKeys: readonly string[],
  model: string,
  options?: { clearWhenEmpty?: boolean },
): P[] {
  if (!providerId) return providers;
  const idx = providers.findIndex((p) => p.id === providerId);
  if (idx < 0) return providers;
  const next = [...providers];
  const row = next[idx]!;
  const task_models = { ...(row.task_models || {}) };
  const trimmed = model.trim();
  const clearWhenEmpty = options?.clearWhenEmpty !== false;
  for (const task of taskKeys) {
    if (trimmed) task_models[task] = trimmed;
    else if (clearWhenEmpty) delete task_models[task];
  }
  next[idx] = { ...row, task_models };
  return next;
}

/** 将高低主备展开写回 tasks / chain_fallback / provider.task_models */
export function applyTaskTiers<P extends ProviderLike, D extends ProvidersDocLike<P>>(
  doc: D,
  tiers: TaskTierState,
): D {
  const tasks: Record<string, string> = { ...(doc.routing.tasks || {}) };
  for (const task of HIGH_TIER_TASKS) {
    const pid = tiers.high.primary.providerId.trim();
    if (pid) tasks[task] = pid;
    else delete tasks[task];
  }
  for (const task of LOW_TIER_TASKS) {
    const pid = tiers.low.primary.providerId.trim();
    if (pid) tasks[task] = pid;
    else delete tasks[task];
  }

  let providers = doc.providers.map((p) => ({
    ...p,
    task_models: { ...(p.task_models || {}) },
  })) as P[];

  // 先写主配置；备用提供方不同时再写其 task_models（同提供方改写会覆盖主模型）
  providers = setProviderTaskModels(
    providers,
    tiers.high.primary.providerId,
    HIGH_TIER_TASKS,
    tiers.high.primary.model,
  );
  providers = setProviderTaskModels(
    providers,
    tiers.low.primary.providerId,
    LOW_TIER_TASKS,
    tiers.low.primary.model,
  );
  const highBackupId = tiers.high.backup.providerId.trim();
  const lowBackupId = tiers.low.backup.providerId.trim();
  const highPrimaryId = tiers.high.primary.providerId.trim();
  const lowPrimaryId = tiers.low.primary.providerId.trim();
  if (highBackupId && highBackupId !== highPrimaryId) {
    providers = setProviderTaskModels(
      providers,
      highBackupId,
      HIGH_TIER_TASKS,
      tiers.high.backup.model,
    );
  }
  if (lowBackupId && lowBackupId !== lowPrimaryId) {
    providers = setProviderTaskModels(
      providers,
      lowBackupId,
      LOW_TIER_TASKS,
      tiers.low.backup.model,
    );
  }

  const chain_fallback = uniquePreserve([
    tiers.high.primary.providerId,
    tiers.high.backup.providerId,
    tiers.low.primary.providerId,
    tiers.low.backup.providerId,
  ]);

  const tier_backups: { high?: string; low?: string } = {};
  const tier_backup_models: { high?: string; low?: string } = {};
  if (highBackupId) {
    tier_backups.high = highBackupId;
    const model = tiers.high.backup.model.trim();
    if (model) tier_backup_models.high = model;
  }
  if (lowBackupId) {
    tier_backups.low = lowBackupId;
    const model = tiers.low.backup.model.trim();
    if (model) tier_backup_models.low = model;
  }

  return {
    ...doc,
    providers,
    routing: { tasks, chain_fallback, tier_backups, tier_backup_models },
  };
}

/**
 * 本地档位折叠。
 * 备用落盘：高级备用 → vision，低级备用 → simple（可与主档相同，表示显式同模型）。
 */
export function foldLocalTiers(doc: LocalDoc): LocalTierState {
  const moe = doc.moe_models || {};
  const highPrimary = String(moe.complex || doc.llm_model || "").trim();
  const highVision = String(moe.vision || "").trim();
  const lowPrimary = String(moe.medium || doc.llm_model || "").trim();
  const lowSimple = String(moe.simple || "").trim();
  return {
    high: {
      primary: highPrimary,
      // 与主档相同视为未单独配置（保存时回落到复杂档）
      backup: highVision && highVision !== highPrimary ? highVision : "",
    },
    low: {
      primary: lowPrimary,
      backup: lowSimple && lowSimple !== lowPrimary ? lowSimple : "",
    },
  };
}

/** 本地档位展开到 moe / task_models / llm_model */
export function applyLocalTiers<D extends LocalDoc>(doc: D, tiers: LocalTierState): D {
  const highPrimary = tiers.high.primary.trim();
  const highBackup = tiers.high.backup.trim() || highPrimary;
  const lowPrimary = tiers.low.primary.trim();
  const lowBackup = tiers.low.backup.trim() || lowPrimary;

  const moe_models = {
    ...(doc.moe_models || {}),
    complex: highPrimary,
    vision: highBackup,
    medium: lowPrimary,
    simple: lowBackup,
  };

  const task_models = { ...(doc.task_models || {}) };
  for (const task of HIGH_TIER_TASKS) {
    if (highPrimary) task_models[task] = highPrimary;
    else delete task_models[task];
  }
  for (const task of LOW_TIER_TASKS) {
    if (lowPrimary) task_models[task] = lowPrimary;
    else delete task_models[task];
  }

  const llm_model = lowPrimary || highPrimary || String(doc.llm_model || "").trim();

  return {
    ...doc,
    llm_model,
    moe_models,
    task_models,
  };
}
