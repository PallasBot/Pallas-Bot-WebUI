<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    subtitle?: string;
    titleId?: string;
    panelClass?: string;
    rootClass?: string;
    headerClass?: string;
    bodyClass?: string;
    closeOnBackdrop?: boolean;
    busy?: boolean;
    showClose?: boolean;
  }>(),
  {
    title: "",
    subtitle: "",
    titleId: "",
    panelClass: "",
    rootClass: "",
    headerClass: "",
    bodyClass: "",
    closeOnBackdrop: true,
    busy: false,
    showClose: true,
  },
);

const emit = defineEmits<{ close: [] }>();

const headingId = computed(() => props.titleId || "ui-dialog-title");
const panelRef = ref<HTMLElement | null>(null);
let previousFocused: Element | null = null;

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function getFocusable(): HTMLElement[] {
  if (!panelRef.value) return [];
  return Array.from(panelRef.value.querySelectorAll<HTMLElement>(FOCUSABLE));
}

function trapFocus(ev: KeyboardEvent) {
  if (ev.key !== "Tab" || !panelRef.value) return;
  const els = getFocusable();
  if (!els.length) { ev.preventDefault(); return; }
  const first = els[0]!;
  const last = els[els.length - 1]!;
  if (ev.shiftKey && document.activeElement === first) {
    ev.preventDefault();
    last.focus();
  } else if (!ev.shiftKey && document.activeElement === last) {
    ev.preventDefault();
    first.focus();
  }
}

function requestClose() {
  if (props.busy) return;
  emit("close");
}

function onBackdropClick() {
  if (!props.closeOnBackdrop) return;
  requestClose();
}

watch(
  () => props.open,
  async (open) => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      previousFocused = document.activeElement;
      await nextTick();
      if (panelRef.value) {
        const els = getFocusable();
        if (els.length) els[0]!.focus();
        else panelRef.value.focus();
      }
      document.addEventListener("keydown", trapFocus);
    } else {
      document.removeEventListener("keydown", trapFocus);
      if (previousFocused instanceof HTMLElement) {
        previousFocused.focus();
      }
      previousFocused = null;
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
    document.removeEventListener("keydown", trapFocus);
  }
  if (previousFocused instanceof HTMLElement) {
    previousFocused.focus();
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="ui-dialog">
      <div
        v-if="open"
        class="ui-dialog console-modal"
        :class="rootClass"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="headingId"
        @keydown.esc.prevent="requestClose"
        @keydown="trapFocus"
      >
        <button
          type="button"
          class="ui-dialog__backdrop console-modal__backdrop"
          aria-label="关闭"
          :disabled="busy"
          @click="onBackdropClick"
        />
        <div
          ref="panelRef"
          class="ui-dialog__panel console-modal__dialog"
          :class="panelClass"
          tabindex="-1"
          @click.stop
        >
          <div
            v-if="$slots.header || title || showClose"
            class="ui-dialog__hd console-modal__hd"
            :class="headerClass"
          >
            <slot name="header">
              <div class="console-modal__head-text">
                <h2
                  :id="headingId"
                  class="console-modal__title"
                >
                  {{ title }}
                </h2>
                <p
                  v-if="subtitle"
                  class="console-modal__subtitle muted"
                >
                  {{ subtitle }}
                </p>
              </div>
              <button
                v-if="showClose"
                type="button"
                class="console-modal__close"
                aria-label="关闭"
                :disabled="busy"
                @click="requestClose"
              >
                ×
              </button>
            </slot>
          </div>
          <div
            class="ui-dialog__bd console-modal__bd"
            :class="bodyClass"
          >
            <slot />
          </div>
          <div
            v-if="$slots.footer"
            class="ui-dialog__ft"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
