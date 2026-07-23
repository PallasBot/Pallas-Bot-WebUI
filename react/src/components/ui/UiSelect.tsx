/**
 * @deprecated 新代码优先用原生 `<select className={cn(nativeSelectClassName)}>` 或 Radix `Select`。
 * 保留 `<option>` children API，样式对齐 shadcn Input 密度。
 */
import type { SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const nativeSelectClassName =
  "flex h-9 min-h-[var(--ui-ctrl-height,36px)] w-full appearance-none rounded-[var(--radius-control,8px)] border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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
      className={cn(nativeSelectClassName, invalid && "border-destructive focus-visible:ring-destructive", className)}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  );
}
