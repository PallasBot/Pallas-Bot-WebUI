/**
 * @deprecated 新代码请直接用 `@/components/ui/button` 的 `Button`。
 * 本文件仅作兼容层，映射 Vue 期 UiButton API → shadcn Button。
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UiButtonVariant = "default" | "primary" | "destructive" | "outline" | "ghost";
export type UiButtonSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UiButtonVariant;
  size?: UiButtonSize;
  block?: boolean;
  children: ReactNode;
};

function mapVariant(v: UiButtonVariant): "default" | "secondary" | "destructive" | "outline" | "ghost" {
  if (v === "primary") return "default";
  if (v === "default") return "secondary";
  return v;
}

function mapSize(s: UiButtonSize): "default" | "sm" | "lg" {
  if (s === "md") return "default";
  return s;
}

export default function UiButton({
  variant = "default",
  size = "md",
  block = false,
  className,
  type = "button",
  children,
  ...rest
}: Props) {
  return (
    <Button
      {...rest}
      type={type}
      variant={mapVariant(variant)}
      size={mapSize(size)}
      className={cn(block && "w-full", className)}
    >
      {children}
    </Button>
  );
}
