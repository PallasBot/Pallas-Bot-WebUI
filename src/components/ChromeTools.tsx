import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 全站工具条壳：Card + p-4 + 行内 gap-4 / h-9。
 * 与下方面板间距 = `--hub-page-gap`（via `--console-chrome-tools-gap`）；勿再叠 Tailwind mb-*。
 * 主行 nowrap + 横向滚动（同 `.console-hub-page__chrome-row`），宽度不够时不换行。
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
        "chrome-tools console-hub-page__chrome-tools flex min-w-0 flex-col gap-3 p-4",
        CHROME_TOOLS_SURFACE,
        className,
      )}
    >
      <div className="console-hub-page__chrome-row gap-4">
        {children}
      </div>
      {advanced ? (
        <div className="console-hub-page__chrome-row gap-2 border-t border-border pt-3">
          {advanced}
        </div>
      ) : null}
    </div>
  );
}
