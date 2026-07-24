import type { ReactNode } from "react";
import ConsoleSwitch from "@/components/ConsoleSwitch";
import { cn } from "@/lib/utils";

export default function PluginRuntimeSwitchRow({
  title,
  checked,
  disabled = false,
  variant = "card",
  onCheckedChange,
  children,
}: {
  title: string;
  checked: boolean;
  disabled?: boolean;
  variant?: "card" | "plain";
  onCheckedChange: (next: boolean) => void;
  children?: ReactNode;
}) {
  const switchLabel = checked ? "开启" : "关闭";
  return (
    <div
      className={cn(
        "plugin-runtime-switch",
        disabled && "plugin-runtime-switch--disabled",
        variant === "plain" && "plugin-runtime-switch--plain",
      )}
    >
      <div className="plugin-runtime-switch__row">
        <span className="plugin-runtime-switch__title">{title}</span>
        <ConsoleSwitch
          checked={checked}
          label={switchLabel}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {children ? <div className="plugin-runtime-switch__desc">{children}</div> : null}
    </div>
  );
}
