import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { PluginConfigField } from "@/api/pallasTypes";
import {
  fieldDisplayName,
  fieldHelpDefaultValue,
  fieldTypeLabel,
} from "@/utils/pluginConfigWorkspaceModel";

export function usePluginConfigFieldPopover(fields: () => PluginConfigField[]) {
  const fieldPopoverHost = ref<HTMLElement | null>(null);
  const activeFieldPopoverName = ref<string | null>(null);
  const fieldPopoverStyle = ref<Record<string, string>>({});
  const fieldPopoverPinned = ref(false);
  const activeFieldDialogName = ref<string | null>(null);
  const activeFieldDialogMode = ref<"help" | "edit">("help");
  let helpHoverCloseTimer: ReturnType<typeof setTimeout> | null = null;

  function findField(name: string | null): PluginConfigField | null {
    if (!name) return null;
    return fields().find((item) => item.name === name) ?? null;
  }

  const activeFieldPopover = computed(() => findField(activeFieldPopoverName.value));
  const activeFieldDialog = computed(() => findField(activeFieldDialogName.value));

  function isMobileViewport(): boolean {
    return typeof window !== "undefined" && window.innerWidth <= 560;
  }

  function updateFieldPopoverPosition(anchor: HTMLElement) {
    if (typeof window === "undefined") return;
    const rect = anchor.getBoundingClientRect();
    const isMobile = window.innerWidth <= 560;
    const maxWidth = Math.min(380, window.innerWidth - 16);
    if (isMobile) {
      fieldPopoverStyle.value = {
        position: "fixed",
        left: "8px",
        right: "8px",
        bottom: "8px",
        width: "calc(100vw - 16px)",
        maxHeight: "min(72vh, 640px)",
      };
      return;
    }
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - maxWidth - 8));
    const top = Math.min(rect.bottom + 10, window.innerHeight - 16);
    fieldPopoverStyle.value = {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `min(${maxWidth}px, calc(100vw - 16px))`,
      maxHeight: "min(72vh, 640px)",
    };
  }

  function closeFieldPopover() {
    activeFieldPopoverName.value = null;
    fieldPopoverPinned.value = false;
    if (helpHoverCloseTimer) {
      clearTimeout(helpHoverCloseTimer);
      helpHoverCloseTimer = null;
    }
  }

  function closeFieldDialog() {
    activeFieldDialogName.value = null;
    activeFieldDialogMode.value = "help";
  }

  function closeFieldInteraction() {
    closeFieldPopover();
    closeFieldDialog();
  }

  function openFieldPopover(fieldName: string, event: MouseEvent) {
    const anchor = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (!anchor) return;
    if (activeFieldPopoverName.value === fieldName && fieldPopoverPinned.value) {
      closeFieldPopover();
      return;
    }
    if (helpHoverCloseTimer) {
      clearTimeout(helpHoverCloseTimer);
      helpHoverCloseTimer = null;
    }
    activeFieldPopoverName.value = fieldName;
    fieldPopoverPinned.value = true;
    updateFieldPopoverPosition(anchor);
  }

  function openFieldDialog(fieldName: string, mode: "help" | "edit") {
    closeFieldPopover();
    activeFieldDialogName.value = fieldName;
    activeFieldDialogMode.value = mode;
  }

  function onHelpHover(fieldName: string, event: MouseEvent) {
    const anchor = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (!anchor) return;
    if (helpHoverCloseTimer) {
      clearTimeout(helpHoverCloseTimer);
      helpHoverCloseTimer = null;
    }
    if (fieldPopoverPinned.value && activeFieldPopoverName.value !== fieldName) return;
    activeFieldPopoverName.value = fieldName;
    fieldPopoverPinned.value = false;
    updateFieldPopoverPosition(anchor);
  }

  function onHelpHoverLeave() {
    if (fieldPopoverPinned.value) return;
    if (helpHoverCloseTimer) clearTimeout(helpHoverCloseTimer);
    helpHoverCloseTimer = setTimeout(() => {
      if (!fieldPopoverPinned.value) closeFieldPopover();
    }, 120);
  }

  function onPopoverEnter() {
    if (helpHoverCloseTimer) {
      clearTimeout(helpHoverCloseTimer);
      helpHoverCloseTimer = null;
    }
  }

  function onFieldHelpClick(fieldName: string, event: MouseEvent) {
    if (isMobileViewport()) {
      openFieldDialog(fieldName, "help");
      return;
    }
    openFieldPopover(fieldName, event);
  }

  function onFieldHelpHover(fieldName: string, event: MouseEvent) {
    if (isMobileViewport()) return;
    onHelpHover(fieldName, event);
  }

  function onFieldEditClick(fieldName: string) {
    openFieldDialog(fieldName, "edit");
  }

  function onFieldDialogEditRequest() {
    if (!activeFieldDialog.value) return;
    activeFieldDialogMode.value = "edit";
  }

  function onWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") closeFieldInteraction();
  }

  function onWindowPointerdown(event: MouseEvent) {
    if (!activeFieldPopover.value) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (fieldPopoverHost.value?.contains(target)) return;
    closeFieldPopover();
  }

  function onWindowResize() {
    closeFieldPopover();
  }

  watch(fields, () => {
    if (activeFieldDialogName.value && !findField(activeFieldDialogName.value)) {
      closeFieldDialog();
    }
    if (activeFieldPopoverName.value && !findField(activeFieldPopoverName.value)) {
      closeFieldPopover();
    }
  });

  onMounted(() => {
    window.addEventListener("keydown", onWindowKeydown);
    window.addEventListener("mousedown", onWindowPointerdown);
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("scroll", onWindowResize, true);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onWindowKeydown);
    window.removeEventListener("mousedown", onWindowPointerdown);
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("scroll", onWindowResize, true);
    if (helpHoverCloseTimer) {
      clearTimeout(helpHoverCloseTimer);
      helpHoverCloseTimer = null;
    }
  });

  return {
    fieldPopoverHost,
    activeFieldPopoverName,
    activeFieldPopover,
    activeFieldDialog,
    activeFieldDialogMode,
    fieldPopoverStyle,
    fieldDisplayName,
    fieldHelpDefaultValue,
    fieldTypeLabel,
    onFieldHelpClick,
    onFieldHelpHover,
    onFieldEditClick,
    onHelpHoverLeave,
    onPopoverEnter,
    onFieldDialogEditRequest,
    closeFieldPopover,
    closeFieldDialog,
    closeFieldInteraction,
  };
}
