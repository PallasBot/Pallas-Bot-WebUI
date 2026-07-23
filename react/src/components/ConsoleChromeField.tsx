import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import ChromeField from "@/components/ChromeField";

/**
 * @deprecated 请优先用 `ChromeField`；保留别名以免存量 import 断裂。
 * 工具条内：Select 前的类型短标签（如「视图」「分类」）。
 */
export default function ConsoleChromeField({
  label,
  icon,
  children,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ChromeField label={label} icon={icon} className={className}>
      {children}
    </ChromeField>
  );
}
