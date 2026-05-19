import { onMounted, onUnmounted } from "vue";

/** 配置页 Ctrl/Cmd+S 保存；组件卸载时自动移除监听。 */
export function useSaveHotkey(
  canSave: () => boolean,
  onSave: () => void | Promise<void>,
): void {
  function onKeydown(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
    if (!canSave()) return;
    e.preventDefault();
    void onSave();
  }

  onMounted(() => document.addEventListener("keydown", onKeydown));
  onUnmounted(() => document.removeEventListener("keydown", onKeydown));
}
