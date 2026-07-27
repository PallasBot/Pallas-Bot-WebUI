import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "@/styles/console-page-skel.css";

export default function ConsolePageSkeleton({ panels = 3 }: { panels?: number }) {
  const count = Math.max(1, Math.min(6, panels));
  return (
    <div className="console-page-skel" aria-busy="true" aria-label="加载中" role="status">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="console-page-skel__panel">
          <div className="console-page-skel__hd skel-pulse" />
          <div className="console-page-skel__bd">
            <div className="console-page-skel__line skel-pulse" />
            <div className="console-page-skel__line skel-pulse console-page-skel__line--mid" />
            {i < 2 ? (
              <div className="console-page-skel__line skel-pulse console-page-skel__line--short" />
            ) : null}
          </div>
        </div>
      ))}
      <span className="visually-hidden">加载中</span>
    </div>
  );
}

/** 面板 / 列表区内联骨架（替代「加载中…」纯文案） */
export function ConsoleBlockSkeleton({
  lines = 3,
  label = "加载中",
  className,
}: {
  lines?: number;
  label?: string;
  className?: string;
}) {
  const count = Math.max(1, Math.min(8, lines));
  return (
    <div
      className={cn("console-block-skel", className)}
      aria-busy="true"
      aria-label={label}
      role="status"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn(
            "console-block-skel__line skel-pulse",
            i === 1 && count > 1 && "console-block-skel__line--mid",
            i === count - 1 && count > 2 && "console-block-skel__line--short",
          )}
        />
      ))}
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

/** 数值位脉冲条，替代字段里的「…」 */
export function SkelValue({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("skel-value skel-pulse", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
