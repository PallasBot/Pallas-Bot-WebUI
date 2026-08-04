export interface IngressWorkQueueSource {
  learn_buffered?: number;
  learn_persisted?: number;
  learn_skipped_full?: number;
  learn_dropped_shutdown?: number;
}

export function ingressWorkQueueMetrics(source: IngressWorkQueueSource | undefined) {
  return {
    buffered: source?.learn_buffered ?? 0,
    persisted: source?.learn_persisted ?? 0,
    droppedFull: source?.learn_skipped_full ?? 0,
    droppedShutdown: source?.learn_dropped_shutdown ?? 0,
  };
}
