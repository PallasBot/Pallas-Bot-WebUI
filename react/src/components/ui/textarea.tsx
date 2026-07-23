import * as React from "react";

import { cn } from "@/lib/utils";
import { controlFocusClass } from "@/components/ui/input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[var(--radius-control,8px)] border border-[var(--control-edge)] bg-[var(--control-bg,hsl(var(--ui-background)))] px-3 py-2 text-sm text-[var(--text)] shadow-[var(--control-shadow)] placeholder:text-[var(--text-muted)]",
        controlFocusClass,
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
