import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "@/styles/status-pending.css";

/** 行内数值/短文案：pending 时脉冲占位，就绪后淡入 */
export default function PendingValue({
  pending = false,
  narrow = true,
  className,
  children,
  ...props
}: {
  pending?: boolean;
  narrow?: boolean;
  children?: ReactNode;
} & HTMLAttributes<HTMLSpanElement>) {
  if (pending) {
    return (
      <span
        className={cn(
          "pending-value pending-value--skel skel-pulse",
          narrow ? "pending-value--narrow" : "pending-value--wide",
          className,
        )}
        aria-busy="true"
        aria-label="加载中"
        role="status"
        {...props}
      />
    );
  }
  return (
    <span className={cn("pending-value pending-value--ready", className)} {...props}>
      {children}
    </span>
  );
}
