import { computed, ref } from "vue";
import {
  botRestartPhaseLabel,
  type BotRestartPhase,
} from "@/utils/botRestartProgress";

export const botRestartDialogOpen = ref(false);
export const botRestartBusy = ref(false);
export const botRestartPhase = ref<BotRestartPhase>("idle");
export const botRestartMsg = ref("");
export const botRestartErr = ref("");
export const botRestartProgressPercent = ref(0);

export const botRestartInProgress = computed(
  () =>
    botRestartBusy.value
    || (botRestartDialogOpen.value && botRestartPhase.value !== "online")
    || (botRestartPhase.value !== "idle"
      && botRestartPhase.value !== "online"
      && botRestartPhase.value !== "timeout"
      && botRestartPhase.value !== "failed"),
);

export const botRestartProgressLabel = computed(() => {
  const fromPhase = botRestartPhaseLabel(botRestartPhase.value);
  return fromPhase || botRestartMsg.value;
});

export function patchBotRestartSession(patch: {
  open?: boolean;
  busy?: boolean;
  phase?: BotRestartPhase;
  msg?: string;
  err?: string;
  progressPercent?: number;
}): void {
  if (patch.open !== undefined) botRestartDialogOpen.value = patch.open;
  if (patch.busy !== undefined) botRestartBusy.value = patch.busy;
  if (patch.phase !== undefined) botRestartPhase.value = patch.phase;
  if (patch.msg !== undefined) botRestartMsg.value = patch.msg;
  if (patch.err !== undefined) botRestartErr.value = patch.err;
  if (patch.progressPercent !== undefined) botRestartProgressPercent.value = patch.progressPercent;
}

export function resetBotRestartSession(): void {
  botRestartDialogOpen.value = false;
  botRestartBusy.value = false;
  botRestartPhase.value = "idle";
  botRestartMsg.value = "";
  botRestartErr.value = "";
  botRestartProgressPercent.value = 0;
}
