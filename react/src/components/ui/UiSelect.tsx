import type { SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & {
  value?: string;
  onValueChange?: (value: string) => void;
  invalid?: boolean;
  children: ReactNode;
};

export default function UiSelect({
  value = "",
  onValueChange,
  invalid = false,
  disabled,
  className,
  children,
  ...rest
}: Props) {
  return (
    <select
      {...rest}
      className={cn("sel ui-select", invalid && "ui-select--invalid", className)}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  );
}
