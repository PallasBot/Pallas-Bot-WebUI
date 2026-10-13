import * as React from "react";
import { Input as HeroInput } from "@heroui/react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <HeroInput
      type={type}
      className={cn("w-full min-h-[var(--ui-ctrl-height,36px)]", className)}
      data-heroui-skin="true"
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
