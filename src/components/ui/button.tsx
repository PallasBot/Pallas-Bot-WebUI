import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import BtnIco, { type BtnIcoMotion } from "@/components/BtnIco";
import { cn } from "@/lib/utils";

/** BEM skin classes preserve native button events and the existing icon API. */
const buttonVariants = cva(
  "button min-h-[var(--ui-button-min-height)]",
  {
    variants: {
      variant: {
        default: "button--primary",
        destructive: "button--danger",
        outline: "button--outline",
        secondary: "button--secondary",
        ghost: "button--ghost",
        link: "button--ghost text-[var(--accent)] hover:bg-transparent active:bg-transparent underline-offset-4 hover:underline",
      },
      size: {
        default: "button--md",
        sm: "button--sm",
        lg: "button--lg",
        icon: "button--md button--icon-only",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  block?: boolean;
  /** 文案前 Lucide 图标（asChild 时忽略，请在子节点内放 BtnIco） */
  icon?: LucideIcon;
  iconMotion?: BtnIcoMotion;
  iconBusy?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      block,
      variant,
      size,
      asChild = false,
      icon,
      iconMotion,
      iconBusy,
      disabled,
      role,
      onClick,
      onBlur,
      onFocus,
      onBlurCapture,
      onFocusCapture,
      value,
      children,
      ...props
    },
    ref,
  ) => {
    const withIcon = Boolean(icon) && !asChild;
    // asChild 时 Slot 只接受单一 React 元素子节点；勿再塞 null/图标旁路
    if (asChild) {
      const childProps = {
        ...props,
        disabled,
        value,
        ...(role === undefined ? {} : { role }),
        onBlur,
        onFocus,
        onBlurCapture,
        onFocusCapture,
        ...(disabled ? { "aria-disabled": true, tabIndex: -1 } : {}),
        onClick: disabled
          ? (event: React.MouseEvent<HTMLElement>) => {
              event.preventDefault();
              event.stopPropagation();
            }
          : onClick,
      };
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }), block && "button--full-width w-full")}
          data-heroui-skin="true"
          ref={ref}
          {...childProps}
        >
          {children}
        </Slot>
      );
    }
    const buttonClassName = cn(buttonVariants({ variant, size, className }), block && "button--full-width w-full", withIcon && "group");
    // 默认分支渲染原生 <button>：HeroUI 的按下处理会拦截激活，无法满足原生键盘/事件契约。
    return (
      <button
        {...props}
        ref={ref}
        type={props.type ?? "submit"}
        value={value}
        role={role}
        disabled={disabled}
        className={buttonClassName}
        data-heroui-skin="true"
        onClick={onClick}
        onFocus={onFocus}
        onBlur={onBlur}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
      >
        {withIcon && icon ? <BtnIco icon={icon} motion={iconMotion} busy={iconBusy} /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
