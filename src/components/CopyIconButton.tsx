import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyIconButtonProps = {
  /** 用于 title / aria-label，如「复制托管密钥」 */
  label: string;
  /** 返回 `false` 表示复制失败，不切换为打勾；`void` / `true` 视为成功 */
  onClick: () => void | boolean | Promise<void | boolean>;
  className?: string;
  disabled?: boolean;
};

const DONE_MS = 1600;

/** 协议弹窗同款：幽灵 + Copy 图标；成功后短暂变为打勾。全仓复制入口统一用这个。 */
export default function CopyIconButton({
  label,
  onClick,
  className,
  disabled,
}: CopyIconButtonProps) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), DONE_MS);
    return () => window.clearTimeout(t);
  }, [done]);

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn(
        "h-7 w-7 min-h-7 min-w-7 shrink-0 p-0 text-[var(--text-muted)]",
        className,
      )}
      title={done ? "已复制" : label}
      aria-label={done ? "已复制" : label}
      disabled={disabled}
      onClick={() => {
        void (async () => {
          try {
            const result = await onClick();
            if (result === false) return;
            setDone(true);
          } catch {
            /* 失败保持 Copy 图标 */
          }
        })();
      }}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
