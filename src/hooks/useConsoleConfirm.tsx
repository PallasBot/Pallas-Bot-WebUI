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

  const finish = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  const confirm = useCallback((options: ConsoleConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
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
      onClose={() => finish(false)}
      onConfirm={() => finish(true)}
    />
  );

  return { confirm, confirmDialog };
}
