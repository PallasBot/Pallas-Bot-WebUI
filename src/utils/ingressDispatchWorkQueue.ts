export interface IngressWorkQueueSource {
  learn_enqueued?: number;
  learn_buffered?: number;
  learn_persisted?: number;
  learn_skipped_full?: number;
  learn_dropped_shutdown?: number;
}

export interface IngressWorkAuxSource {
  pending?: number;
  leased?: number;
  oldest_pending_age_sec?: number | null;
  consumers?: number;
  heartbeat_age_sec?: number;
  completed_since_start?: number;
  failed_since_start?: number;
  retried_since_start?: number;
  dead_lettered_since_start?: number;
}

export interface IngressSchedulerSource {
  pending?: number;
  pending_peak?: number;
  active?: number;
  active_peak?: number;
  ready_peak?: number;
  wait_ms_p95?: number | null;
  backpressure_waits?: number;
}

export interface IngressLaneSource {
  limit?: number;
  in_use?: number;
}

export interface IngressCapacityCounters {
  selected?: number;
  completed?: number;
  laneBusy?: number;
}

export function ingressWorkQueueMetrics(source: IngressWorkQueueSource | undefined) {
  return {
    enqueued: source?.learn_enqueued ?? 0,
    buffered: source?.learn_buffered ?? 0,
    persisted: source?.learn_persisted ?? 0,
    droppedFull: source?.learn_skipped_full ?? 0,
    droppedShutdown: source?.learn_dropped_shutdown ?? 0,
  };
}

export function ingressWorkAuxMetrics(source: IngressWorkAuxSource | undefined) {
  return {
    pending: source?.pending ?? 0,
    leased: source?.leased ?? 0,
    oldestPendingAgeSec: source?.oldest_pending_age_sec ?? 0,
    consumers: source?.consumers ?? 0,
    heartbeatAgeSec: source?.heartbeat_age_sec ?? 0,
    completedSinceStart: source?.completed_since_start ?? 0,
    failedSinceStart: source?.failed_since_start ?? 0,
    retriedSinceStart: source?.retried_since_start ?? 0,
    deadLetteredSinceStart: source?.dead_lettered_since_start ?? 0,
  };
}

export function ingressSchedulerMetrics(source: IngressSchedulerSource | undefined) {
  return {
    pending: source?.pending ?? 0,
    pendingPeak: source?.pending_peak ?? 0,
    active: source?.active ?? 0,
    activePeak: source?.active_peak ?? 0,
    readyPeak: source?.ready_peak ?? 0,
    waitP95Ms: source?.wait_ms_p95 ?? 0,
    backpressureWaits: source?.backpressure_waits ?? 0,
  };
}

export function ingressCapacityMetrics(
  lanes: Record<string, IngressLaneSource> | undefined,
  counters: IngressCapacityCounters,
) {
  const selected = counters.selected ?? 0;
  const completed = counters.completed ?? 0;
  const chatLane = lanes?.chat;
  return {
    completionRate: selected > 0 ? completed / selected : null,
    completed,
    selected,
    laneBusy: counters.laneBusy ?? 0,
    chatInUse: chatLane?.in_use ?? 0,
    chatLimit: chatLane?.limit ?? 0,
  };
}
