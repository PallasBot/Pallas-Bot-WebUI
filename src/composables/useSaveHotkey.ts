import { onActivated, onDeactivated, onMounted, onUnmounted } from "vue";

type SaveHotkeyEntry = {
  canSave: () => boolean;
  onSave: () => void | Promise<void>;
};

const stack: SaveHotkeyEntry[] = [];
let listenerAttached = false;

function onGlobalKeydown(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    if (entry.canSave()) {
      e.preventDefault();
      void entry.onSave();
      return;
    }
  }
}

function ensureGlobalListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  document.addEventListener("keydown", onGlobalKeydown);
}

function maybeRemoveGlobalListener() {
  if (stack.length === 0 && listenerAttached) {
    document.removeEventListener("keydown", onGlobalKeydown);
    listenerAttached = false;
  }
}

function register(entry: SaveHotkeyEntry) {
  const idx = stack.indexOf(entry);
  if (idx >= 0) stack.splice(idx, 1);
  stack.push(entry);
  ensureGlobalListener();
}

function unregister(entry: SaveHotkeyEntry) {
  const idx = stack.indexOf(entry);
  if (idx >= 0) stack.splice(idx, 1);
  maybeRemoveGlobalListener();
}

/**
 * Ctrl/Cmd+S 保存。路由页在 keep-alive 下用 onActivated 注册，避免离页后仍响应快捷键。
 * 弹窗等非 keep-alive 子组件传 `lifecycle: "mount"`。
 */
export function useSaveHotkey(
  canSave: () => boolean,
  onSave: () => void | Promise<void>,
  options?: { lifecycle?: "activated" | "mount" },
): void {
  const entry: SaveHotkeyEntry = { canSave, onSave };
  const lifecycle = options?.lifecycle ?? "activated";

  if (lifecycle === "mount") {
    onMounted(() => register(entry));
    onUnmounted(() => unregister(entry));
    return;
  }

  onActivated(() => register(entry));
  onDeactivated(() => unregister(entry));
  onUnmounted(() => unregister(entry));
}
