import * as React from "react";
import { cn } from "@/lib/utils";

/** 轻边 + 软 focus（无 ring / ring-offset），对齐 gsuid 与 hub `.inp:focus` */
const controlFocusClass =
  "focus-visible:outline-none focus-visible:border-[color-mix(in_srgb,var(--accent)_16%,var(--control-border))] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_8%,transparent)]";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 min-h-[var(--ui-ctrl-height,36px)] w-full rounded-[var(--radius-control,8px)] border border-[var(--control-edge)] bg-[var(--control-bg,hsl(var(--ui-background)))] px-3 py-1.5 text-sm text-[var(--text)] shadow-[var(--control-shadow)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--text-muted)]",
        controlFocusClass,
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input, controlFocusClass };
