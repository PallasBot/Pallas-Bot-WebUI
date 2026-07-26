import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyIconButtonProps = {
  /** 用于 title / aria-label，如「复制托管口令」 */
  label: string;
  onClick: () => void | Promise<void>;
  className?: string;
  disabled?: boolean;
};

/** 协议弹窗同款：幽灵 + Copy 图标，全仓复制入口统一用这个。 */
export default function CopyIconButton({
  label,
  onClick,
  className,
  disabled,
}: CopyIconButtonProps) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn(
        "h-7 w-7 min-h-7 min-w-7 shrink-0 p-0 text-[var(--text-muted)]",
        className,
      )}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={() => void onClick()}
    >
      <Copy className="size-3.5" />
    </Button>
  );
}
