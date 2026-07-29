import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_ARM_MS = 3000;

/**
 * 「再点一次确认」：首次点击武装，超时解除；同 key 再点执行 action。
 * 适用于单账号停/重启等中危操作。
 */
export function useConfirmAgain(timeoutMs = DEFAULT_ARM_MS) {
  const [armedKey, setArmedKey] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setArmedKey(null);
  }, []);

  useEffect(() => () => clear(), [clear]);

  const run = useCallback(
    (key: string, action: () => void | Promise<void>) => {
      if (armedKey === key) {
        clear();
        void action();
        return true;
      }
      setArmedKey(key);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setArmedKey(null);
        timerRef.current = null;
      }, timeoutMs);
      return false;
    },
    [armedKey, clear, timeoutMs],
  );

  const isArmed = useCallback((key: string) => armedKey === key, [armedKey]);

  const label = useCallback(
    (key: string, idleLabel: string, armedLabel = "再点一次确认") =>
      armedKey === key ? armedLabel : idleLabel,
    [armedKey],
  );

  return { armedKey, isArmed, run, label, clear };
}
