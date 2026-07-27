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
  "affect_refine",
  "turn_decision",
] as const;

export const ALL_ROUTABLE_TASKS = [...HIGH_TIER_TASKS, ...LOW_TIER_TASKS] as const;

export type RoutableTask = (typeof ALL_ROUTABLE_TASKS)[number];

export const TIER_TASKS: Record<RoutingTier, readonly string[]> = {
  high: HIGH_TIER_TASKS,
  low: LOW_TIER_TASKS,
};

export const TASK_ROUTE_META: Record<
  RoutableTask,
  { title: string; description: string; kind: RoutingTier }
> = {
  llm_chat: {
    title: "@ LLM 对话",
    description: "群里 @ 牛牛、口令聊天等主对话，建议用更强模型",
    kind: "high",
  },
  drunk: {
    title: "醉聊",
    description: "酒后玩法专用对话；与日常 @ 分开配模型",
    kind: "high",
  },
  repeater_polish: {
    title: "接话润色",
    description: "强场景下把接话整段改得更顺，相对更费",
    kind: "high",
  },
  repeater_select: {
    title: "接话选句",
    description: "从已有语料里挑一句发出，轻量常用",
    kind: "low",
  },
  repeater_polish_lite: {
    title: "轻润色",
    description: "语料命中后只轻轻改口气，比完整润色便宜",
    kind: "low",
  },
  repeater_fallback: {
    title: "接话兜底",
    description: "语料不够用时现编一句，避免冷场",
    kind: "low",
  },
  affect_refine: {
    title: "群情感 refine",
    description: "后台微调本群情绪偏移，不直接对用户说话",
    kind: "low",
  },
  turn_decision: {
    title: "本轮动作决策",
    description: "回复前先判断：回、跳过，还是走工具；须在对话策略里开启才会请求",
    kind: "low",
  },
};

export type TaskRouteSlotState = {
  primary: TierProviderSlot;
  backup: TierProviderSlot;
};

export type TaskRoutesState = Record<RoutableTask, TaskRouteSlotState>;

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
    /** 全任务编排：按任务覆盖备用提供方 */
    task_backups?: Record<string, string>;
    /** 全任务编排：按任务覆盖备用模型 */
    task_backup_models?: Record<string, string>;
    /**
     * 最近一次编排写入来源（UI 提示用）。
     * 运行时主路由始终读 tasks；备用先 task_backups，再退回 tier_backups。
     */
    route_source?: "tiers" | "tasks";
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

/** 是否曾用全任务视图细调过（仅 UI 提示；不影响高低档写回） */
export function hasTaskRouteAuthority(doc: {
  routing?: {
    route_source?: string;
    task_backups?: Record<string, string>;
    task_backup_models?: Record<string, string>;
  };
}): boolean {
  const routing = doc.routing || {};
  return String(routing.route_source || "").trim() === "tasks";
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

/** 将高低主备展开写回 tasks / task_backups / chain_fallback / provider.task_models */
export function applyTaskTiers<P extends ProviderLike, D extends ProvidersDocLike<P>>(
  doc: D,
  tiers: TaskTierState,
): D {
  const highBackupId = tiers.high.backup.providerId.trim();
  const lowBackupId = tiers.low.backup.providerId.trim();
  const highPrimaryId = tiers.high.primary.providerId.trim();
  const lowPrimaryId = tiers.low.primary.providerId.trim();
  const highBackupModel = tiers.high.backup.model.trim();
  const lowBackupModel = tiers.low.backup.model.trim();

  const tier_backups: { high?: string; low?: string } = {};
  const tier_backup_models: { high?: string; low?: string } = {};
  if (highBackupId) {
    tier_backups.high = highBackupId;
    if (highBackupModel) tier_backup_models.high = highBackupModel;
  }
  if (lowBackupId) {
    tier_backups.low = lowBackupId;
    if (lowBackupModel) tier_backup_models.low = lowBackupModel;
  }

  const tasks: Record<string, string> = { ...(doc.routing.tasks || {}) };
  const task_backups: Record<string, string> = {};
  const task_backup_models: Record<string, string> = {};
  for (const task of HIGH_TIER_TASKS) {
    if (highPrimaryId) tasks[task] = highPrimaryId;
    else delete tasks[task];
    if (highBackupId) {
      task_backups[task] = highBackupId;
      if (highBackupModel) task_backup_models[task] = highBackupModel;
    }
  }
  for (const task of LOW_TIER_TASKS) {
    if (lowPrimaryId) tasks[task] = lowPrimaryId;
    else delete tasks[task];
    if (lowBackupId) {
      task_backups[task] = lowBackupId;
      if (lowBackupModel) task_backup_models[task] = lowBackupModel;
    }
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

  return {
    ...doc,
    providers,
    routing: {
      ...doc.routing,
      tasks,
      chain_fallback,
      tier_backups,
      tier_backup_models,
      task_backups,
      task_backup_models,
      route_source: "tiers",
    },
  };
}

function emptyTaskRouteSlot(): TaskRouteSlotState {
  return { primary: emptySlot(), backup: emptySlot() };
}

export function emptyTaskRoutesState(): TaskRoutesState {
  const out = {} as TaskRoutesState;
  for (const task of ALL_ROUTABLE_TASKS) {
    out[task] = emptyTaskRouteSlot();
  }
  return out;
}

/** 从 routing / providers 展开为逐任务主备 */
export function foldTaskRoutes<P extends ProviderLike>(doc: ProvidersDocLike<P>): TaskRoutesState {
  const tasks = doc.routing.tasks || {};
  const taskBackups = doc.routing.task_backups || {};
  const taskBackupModels = doc.routing.task_backup_models || {};
  const hasTaskBackups = Object.prototype.hasOwnProperty.call(doc.routing, "task_backups");
  const out = emptyTaskRoutesState();

  for (const task of ALL_ROUTABLE_TASKS) {
    const kind = TASK_ROUTE_META[task].kind;
    const primaryId = String(tasks[task] || "").trim();
    let backupId = "";
    let backupModel = "";
    if (hasTaskBackups) {
      backupId = String(taskBackups[task] || "").trim();
      backupModel = String(taskBackupModels[task] || "").trim();
    } else {
      backupId = String(doc.routing.tier_backups?.[kind] || "").trim();
      backupModel = String(doc.routing.tier_backup_models?.[kind] || "").trim();
    }
    out[task] = {
      primary: {
        providerId: primaryId,
        model: providerTaskModel(doc.providers, primaryId, [task]),
      },
      backup: {
        providerId: backupId,
        model: (() => {
          if (!backupId) return "";
          if (backupModel) return backupModel;
          if (backupId === primaryId) return "";
          return providerTaskModel(doc.providers, backupId, [task], { fallbackDefault: false });
        })(),
      },
    };
  }
  return out;
}

/** 将逐任务主备写回 tasks / task_backups / provider.task_models，并同步高低档摘要 */
export function applyTaskRoutes<P extends ProviderLike, D extends ProvidersDocLike<P>>(
  doc: D,
  routes: TaskRoutesState,
): D {
  const tasks: Record<string, string> = { ...(doc.routing.tasks || {}) };
  const task_backups: Record<string, string> = {};
  const task_backup_models: Record<string, string> = {};

  let providers = doc.providers.map((p) => ({
    ...p,
    task_models: { ...(p.task_models || {}) },
  })) as P[];

  for (const task of ALL_ROUTABLE_TASKS) {
    const slot = routes[task] || emptyTaskRouteSlot();
    const primaryId = slot.primary.providerId.trim();
    const backupId = slot.backup.providerId.trim();
    const primaryModel = slot.primary.model.trim();
    const backupModel = slot.backup.model.trim();

    if (primaryId) tasks[task] = primaryId;
    else delete tasks[task];

    if (backupId) {
      task_backups[task] = backupId;
      if (backupModel) task_backup_models[task] = backupModel;
    }

    providers = setProviderTaskModels(providers, primaryId, [task], primaryModel);
    if (backupId && backupId !== primaryId) {
      providers = setProviderTaskModels(providers, backupId, [task], backupModel);
    }
  }

  const chain_fallback = uniquePreserve(
    ALL_ROUTABLE_TASKS.flatMap((task) => {
      const slot = routes[task] || emptyTaskRouteSlot();
      return [slot.primary.providerId, slot.backup.providerId];
    }),
  );

  const highBackup = majorityProvider(task_backups, HIGH_TIER_TASKS);
  const lowBackup = majorityProvider(task_backups, LOW_TIER_TASKS);
  const tier_backups: { high?: string; low?: string } = {};
  const tier_backup_models: { high?: string; low?: string } = {};
  if (highBackup) {
    tier_backups.high = highBackup;
    for (const task of HIGH_TIER_TASKS) {
      const model = String(task_backup_models[task] || "").trim();
      if (model) {
        tier_backup_models.high = model;
        break;
      }
    }
  }
  if (lowBackup) {
    tier_backups.low = lowBackup;
    for (const task of LOW_TIER_TASKS) {
      const model = String(task_backup_models[task] || "").trim();
      if (model) {
        tier_backup_models.low = model;
        break;
      }
    }
  }

  return {
    ...doc,
    providers,
    routing: {
      ...doc.routing,
      tasks,
      chain_fallback,
      tier_backups,
      tier_backup_models,
      task_backups,
      task_backup_models,
      route_source: "tasks",
    },
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
