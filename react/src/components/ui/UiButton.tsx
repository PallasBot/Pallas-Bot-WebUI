import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type UiButtonVariant = "default" | "primary" | "destructive" | "outline" | "ghost";
export type UiButtonSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UiButtonVariant;
  size?: UiButtonSize;
  block?: boolean;
  children: ReactNode;
};

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
    <button
      {...rest}
      type={type}
      className={cn(
        "ui-btn",
        `ui-btn--${variant}`,
        size === "sm" && "ui-btn--sm",
        size === "lg" && "ui-btn--lg",
        block && "ui-btn--block",
        className,
      )}
    >
      {children}
    </button>
  );
}
