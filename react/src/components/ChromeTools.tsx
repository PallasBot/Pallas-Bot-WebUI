import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 全站工具条壳：与 shadcn Card 同色同边（bg-card / border / shadow-none）。
 * 与下方面板间距由 `--console-chrome-tools-gap`（CSS）统一；勿再叠 Tailwind mb-*。
 */
export const CHROME_TOOLS_SURFACE =
  "rounded-lg border bg-card text-card-foreground shadow-none";

export default function ChromeTools({
  children,
  advanced,
  className,
}: {
  children: ReactNode;
  advanced?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "chrome-tools console-hub-page__chrome-tools flex min-w-0 flex-col gap-2 px-2.5 py-2",
        CHROME_TOOLS_SURFACE,
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto">{children}</div>
      {advanced ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-2">
          {advanced}
        </div>
      ) : null}
    </div>
  );
}
