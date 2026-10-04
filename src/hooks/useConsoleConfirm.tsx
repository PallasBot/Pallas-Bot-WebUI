import { useCallback, useRef, useState } from "react";
import ConsoleConfirmModal from "@/components/ConsoleConfirmModal";

export type ConsoleConfirmOptions = {
  title: string;
  subtitle: string;
  warnings?: string[];
  confirmLabel?: string;
  confirmVariant?: "destructive" | "default";
};

/**
 * Promise 版确认框，便于替换 `window.confirm`。
 * 须在组件树中渲染返回的 `confirmDialog`。
 */
export function useConsoleConfirm() {
  const [opts, setOpts] = useState<(ConsoleConfirmOptions & { open: boolean }) | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const returnFocusTarget = useRef<HTMLElement | null>(null);
  const restoreFocusOnClose = useRef(false);

  const finish = useCallback((value: boolean) => {
    restoreFocusOnClose.current = !value;
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  const confirm = useCallback((options: ConsoleConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const active = document.activeElement;
      returnFocusTarget.current = active instanceof HTMLElement ? active : null;
      restoreFocusOnClose.current = false;
      resolver.current?.(false);
      resolver.current = resolve;
      setOpts({ ...options, open: true });
    });
  }, []);

  const confirmDialog = (
    <ConsoleConfirmModal
      open={Boolean(opts?.open)}
      title={opts?.title ?? ""}
      subtitle={opts?.subtitle ?? ""}
      warnings={opts?.warnings}
      confirmLabel={opts?.confirmLabel}
      confirmVariant={opts?.confirmVariant ?? "destructive"}
      onCloseAutoFocus={(event) => {
        if (!restoreFocusOnClose.current) return;
        const target = returnFocusTarget.current;
        if (target?.isConnected) {
          event.preventDefault();
          target.focus({ preventScroll: true });
        }
        returnFocusTarget.current = null;
        restoreFocusOnClose.current = false;
      }}
      onClose={() => finish(false)}
      onConfirm={() => finish(true)}
    />
  );

  return { confirm, confirmDialog };
}
