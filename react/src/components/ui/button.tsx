import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * 密度跟 hub（--radius-control / h-9）；
 * 主色跟 hub --accent；手法跟 gsuid：
 * - default：扁实心 accent + accent-contrast 字（shadcn 黑白下为深底浅字 / 浅底深字）
 * - secondary / outline：control 实心底 + 浅边 + 正文色（常见操作，勿灰板）
 * hover 略压暗、active 更明确；勿胶囊 / 厚渐变 glow。
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[13px] font-medium transition-[background,border-color,box-shadow,transform,color] duration-150 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_12%,transparent)] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-[var(--radius-control,8px)] active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "border border-[color-mix(in_srgb,var(--accent)_38%,transparent)] bg-[var(--accent)] text-[var(--accent-contrast,#fff)] shadow-[0_1px_2px_color-mix(in_srgb,var(--accent)_22%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_90%,#000_10%)] hover:border-[color-mix(in_srgb,var(--accent)_48%,transparent)] hover:shadow-[0_1px_3px_color-mix(in_srgb,var(--accent)_16%,transparent)] active:bg-[color-mix(in_srgb,var(--accent)_82%,#000_18%)] active:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] active:shadow-none",
        destructive:
          "border border-[color-mix(in_srgb,#dc2626_38%,transparent)] bg-[#dc2626] text-white shadow-[0_1px_2px_rgba(220,38,38,0.22)] hover:bg-[color-mix(in_srgb,#dc2626_90%,#000_10%)] active:bg-[color-mix(in_srgb,#dc2626_82%,#000_18%)] active:shadow-none",
        outline:
          "border border-[color-mix(in_srgb,var(--foreground,var(--text))_10%,transparent)] bg-[var(--control-bg,#fff)] text-[var(--text)] shadow-[0_1px_2px_color-mix(in_srgb,var(--foreground,var(--text))_3%,transparent)] hover:bg-[color-mix(in_srgb,var(--text)_4%,var(--control-bg,#fff))] hover:border-[color-mix(in_srgb,var(--foreground,var(--text))_14%,transparent)] active:bg-[color-mix(in_srgb,var(--text)_7%,var(--control-bg,#fff))]",
        secondary:
          "border border-[color-mix(in_srgb,var(--foreground,var(--text))_10%,transparent)] bg-[var(--control-bg,#fff)] text-[var(--text)] shadow-[0_1px_2px_color-mix(in_srgb,var(--foreground,var(--text))_4%,transparent)] hover:bg-[color-mix(in_srgb,var(--text)_4%,var(--control-bg,#fff))] hover:border-[color-mix(in_srgb,var(--foreground,var(--text))_14%,transparent)] active:bg-[color-mix(in_srgb,var(--text)_7%,var(--control-bg,#fff))]",
        ghost:
          "border border-transparent bg-transparent text-[var(--text-muted)] shadow-none hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] hover:text-[var(--text)] active:bg-[color-mix(in_srgb,var(--text)_8%,transparent)]",
        link: "border-transparent bg-transparent text-[var(--accent)] underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-9 min-h-[var(--ui-ctrl-height,36px)] px-3 py-1.5",
        sm: "h-8 min-h-8 px-2.5 text-xs",
        lg: "h-10 min-h-[42px] px-3.5 text-sm",
        icon: "h-9 w-9 min-h-9 min-w-9 p-0",
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
