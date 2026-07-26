import type { ReactNode } from "react";
import ConfigFieldHelp from "@/components/config/ConfigFieldHelp";
import UiField from "@/components/ui/UiField";
import { cn } from "@/lib/utils";

/** 配置表单字段：加粗标签 + 可选「?」说明，对齐插件配置页。 */
export default function SettingsFormField({
  label,
  hint,
  className,
  secret = false,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  secret?: boolean;
  children: ReactNode;
}) {
  const desc = hint?.trim();
  return (
    <UiField
      className={cn("field", "plugin-config-form-item", className)}
      label={label}
      secret={secret}
      labelEnd={desc ? <ConfigFieldHelp title={label} description={desc} /> : undefined}
    >
      {children}
    </UiField>
  );
}
