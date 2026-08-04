export interface IngressWorkQueueSource {
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
}

export function ingressWorkQueueMetrics(source: IngressWorkQueueSource | undefined) {
  return {
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
  };
}
