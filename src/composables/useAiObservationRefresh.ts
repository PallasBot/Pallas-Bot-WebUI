import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  type InjectionKey,
  type Ref,
} from "vue";

type RefreshFn = () => void | Promise<void>;

interface AiObservationRefreshContext {
  register: (fn: RefreshFn, options?: { isBusy?: () => boolean }) => void;
  unregister: (fn: RefreshFn) => void;
  trigger: () => Promise<void>;
  mastheadBusy: Ref<boolean>;
}

const AI_OBSERVATION_REFRESH_KEY: InjectionKey<AiObservationRefreshContext> = Symbol("aiObservationRefresh");

export function provideAiObservationRefresh() {
  const triggering = ref(false);
  let currentFn: RefreshFn | null = null;
  let isBusyFn: (() => boolean) | null = null;

  const mastheadBusy = computed(() => triggering.value || (isBusyFn?.() ?? false));

  const ctx: AiObservationRefreshContext = {
    mastheadBusy,
    register(fn, options) {
      currentFn = fn;
      isBusyFn = options?.isBusy ?? null;
    },
    unregister(fn) {
      if (currentFn !== fn) return;
      currentFn = null;
      isBusyFn = null;
    },
    async trigger() {
      if (!currentFn || triggering.value) return;
      triggering.value = true;
      try {
        await currentFn();
      } finally {
        triggering.value = false;
      }
    },
  };

  provide(AI_OBSERVATION_REFRESH_KEY, ctx);
  return ctx;
}

export function useAiObservationRefresh(refreshFn: RefreshFn, options?: { isBusy?: () => boolean }) {
  const ctx = inject(AI_OBSERVATION_REFRESH_KEY, null);
  onMounted(() => {
    ctx?.register(refreshFn, options);
  });
  onBeforeUnmount(() => {
    ctx?.unregister(refreshFn);
  });
}
