import type { ReactNode } from "react";

/** 看板分区小标题 + 右侧分割线（轻于外框，但须可见） */
export default function StatsSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="text-sm font-medium text-muted-foreground">{children}</div>
      <div
        className="min-w-0 flex-1 border-t border-[color:color-mix(in_srgb,var(--border-base,var(--border))_62%,transparent)]"
        aria-hidden
      />
    </div>
  );
}
