import { cn } from "@/lib/utils";

export default function AiProgressBar({
  value,
  color,
  fillClassName,
  className,
  ariaLabel = "占比",
}: {
  value: number;
  color?: string;
  fillClassName?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const percent = Math.min(100, Math.max(0, value));
  const width = Math.min(100, Math.max(percent, percent > 0 ? 1.5 : 0));
  return (
    <div
      className={cn("h-2.5 overflow-hidden rounded-full border border-border/80 bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={ariaLabel}
    >
      <div
        className={cn("h-full rounded-full transition-[width]", fillClassName)}
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}
