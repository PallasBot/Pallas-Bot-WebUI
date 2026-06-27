import { ref } from "vue";
import { protocolApiErrorMessage, protocolStartAccountBatch, type ProtocolBatchRequest } from "@/api/protocolApi";
import {
  protocolBatchPhaseLabel,
  protocolBatchProgressPercent,
  waitForProtocolBatchJob,
  type ProtocolBatchJob,
} from "@/utils/protocolBatchProgress";

export function useProtocolAccountBatch(mountUrl: () => string | null) {
  const batchBusy = ref(false);
  const batchJob = ref<ProtocolBatchJob | null>(null);
  const batchErr = ref("");
  const batchOpen = ref(false);

  async function runBatch(body: ProtocolBatchRequest, confirmText?: string): Promise<ProtocolBatchJob | null> {
    const mount = mountUrl();
    if (!mount) {
      batchErr.value = "协议端未启用";
      return null;
    }
    if (confirmText && typeof window !== "undefined" && !window.confirm(confirmText)) {
      return null;
    }
    batchBusy.value = true;
    batchErr.value = "";
    batchOpen.value = true;
    batchJob.value = null;
    try {
      const started = await protocolStartAccountBatch(mount, body);
      const job = await waitForProtocolBatchJob(mount, started.job_id, {
        onProgress: (j) => {
          batchJob.value = j;
        },
      });
      batchJob.value = job;
      return job;
    } catch (e) {
      batchErr.value = protocolApiErrorMessage(e, "批量操作失败");
      return null;
    } finally {
      batchBusy.value = false;
    }
  }

  function closeBatchPanel() {
    if (batchBusy.value) return;
    batchOpen.value = false;
    batchJob.value = null;
    batchErr.value = "";
  }

  return {
    batchBusy,
    batchJob,
    batchErr,
    batchOpen,
    batchProgressPercent: () => protocolBatchProgressPercent(batchJob.value),
    batchPhaseLabel: () => protocolBatchPhaseLabel(batchJob.value),
    runBatch,
    closeBatchPanel,
  };
}
