import type { ReactNode } from "react";
import ChromeTools from "@/components/ChromeTools";

/**
 * @deprecated 请优先用 `ChromeTools`；保留别名以免存量 import 断裂。
 * Hub 页头下方紧凑工具条：单行横向滚动，可选 advanced 次行。
 */
export default function ConsoleChromeTools({
  children,
  advanced,
  className,
}: {
  children: ReactNode;
  advanced?: ReactNode;
  className?: string;
}) {
  return (
    <ChromeTools advanced={advanced} className={className}>
      {children}
    </ChromeTools>
  );
}
