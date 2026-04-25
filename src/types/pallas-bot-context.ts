import type { InjectionKey, Ref } from "vue";

export interface PallasBotContext {
  selectedBotSelfId: Ref<string | null>;
  setSelectedBotSelfId: (selfId: string | null) => void;
}

export const pallasBotContextKey: InjectionKey<PallasBotContext> = Symbol("pallasBotContext");

