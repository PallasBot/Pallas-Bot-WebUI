import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 控制台通用软提醒：虚线框 + muted 文案（与 AI 记忆页作用域提示同款）。
 * 用于引导/说明/暂不可用，勿替代 alert--err / alert--warn 等强告警。
 */
export default function ConsoleHint({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("console-hint", className)} role="status" {...rest}>
      {children}
    </div>
  );
}
