import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 刷新：走 shadcn Button（扁平），勿再用太鼓的 `.ui-btn` 胶囊。
 * 默认 outline 实体按钮；仅面板标题旁图标刷新可传 `embedded` 用 ghost。
 */
export default function RefreshIconButton({
  busy = false,
  disabled = false,
  label = "刷新",
  busyLabel = "刷新中…",
  showLabel = false,
  embedded = false,
  className,
  onClick,
}: {
  busy?: boolean;
  disabled?: boolean;
  label?: string;
  busyLabel?: string;
  showLabel?: boolean;
  /** true：幽灵图标按钮（面板标题栏）；工具条请保持 false（outline 实体） */
  embedded?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  function handleClick() {
    if (busy || disabled) return;
    onClick?.();
  }

  return (
    <Button
      type="button"
      variant={embedded ? "ghost" : "outline"}
      size={showLabel ? "sm" : "icon"}
      className={cn(
        "btn-refresh-action shrink-0",
        embedded && "btn-refresh-action--embedded",
        busy && "btn-refresh-action--busy",
        !showLabel && "btn-refresh-action--icon-only",
        showLabel && "gap-1.5",
        className,
      )}
      disabled={disabled || busy}
      aria-label={label}
      title={label}
      onClick={handleClick}
    >
      <RefreshCw
        className={cn("btn-refresh-action__ico size-3.5", busy && "btn-refresh-action__ico--spin")}
        aria-hidden
      />
      {showLabel ? <span className="btn-refresh-action__text">{busy ? busyLabel : label}</span> : null}
    </Button>
  );
}
