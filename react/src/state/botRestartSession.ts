import {
  botRestartPhaseLabel,
  type BotRestartPhase,
} from "@/utils/botRestartProgress";

export type { BotRestartPhase };

type Listener = () => void;

type Session = {
  open: boolean;
  busy: boolean;
  phase: BotRestartPhase;
  msg: string;
  err: string;
  progressPercent: number;
};

let session: Session = {
  open: false,
  busy: false,
  phase: "idle",
  msg: "",
  err: "",
  progressPercent: 0,
};

const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

export function getBotRestartSession(): Session {
  return session;
}

export function subscribeBotRestartSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function syncRestartSession(patch: Partial<Session>) {
  session = { ...session, ...patch };
  emit();
}

export function resetBotRestartSession() {
  session = {
    open: false,
    busy: false,
    phase: "idle",
    msg: "",
    err: "",
    progressPercent: 0,
  };
  emit();
}

export function botRestartInProgress(s: Session = session): boolean {
  return (
    s.busy
    || (s.open && s.phase !== "online")
    || (s.phase !== "idle"
      && s.phase !== "online"
      && s.phase !== "timeout"
      && s.phase !== "failed")
  );
}

export function botRestartProgressLabel(s: Session = session): string {
  return botRestartPhaseLabel(s.phase) || s.msg;
}
