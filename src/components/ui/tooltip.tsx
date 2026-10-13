import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { composeRefs } from "@radix-ui/react-compose-refs";
import { Tooltip as HeroTooltip } from "@heroui/react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type TooltipProviderProps = Omit<React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>, "skipDelayDuration">;
const TooltipDelayContext = React.createContext(700);

function TooltipProvider({ delayDuration = 700, children }: TooltipProviderProps) {
  return <TooltipDelayContext.Provider value={delayDuration}>{children}</TooltipDelayContext.Provider>;
}

type TooltipProps = Pick<React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>, "open" | "defaultOpen" | "onOpenChange" | "children"> &
  Pick<React.ComponentPropsWithoutRef<typeof HeroTooltip.Root>, "delay" | "closeDelay" | "isDisabled">;
function Tooltip({ delay, closeDelay, isDisabled, open, defaultOpen, onOpenChange, children }: TooltipProps) {
  const providerDelay = React.useContext(TooltipDelayContext);
  return (
    <HeroTooltip.Root
      delay={delay ?? providerDelay}
      closeDelay={closeDelay}
      isDisabled={isDisabled}
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      {children}
    </HeroTooltip.Root>
  );
}

type TooltipTriggerProps = Omit<React.ComponentPropsWithoutRef<typeof HeroTooltip.Trigger>, "render" | "children"> & {
  asChild?: boolean;
  children?: React.ReactNode;
};
const TooltipTrigger = React.forwardRef<React.ElementRef<typeof TooltipPrimitive.Trigger>, TooltipTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    const renderTrigger = (domProps: React.ComponentPropsWithRef<"div">) => {
      const triggerProps = {
        ...domProps,
        ref: composeRefs(domProps.ref, ref as React.Ref<HTMLDivElement>),
      };
      return asChild ? <Slot {...triggerProps}>{children}</Slot> : <div {...triggerProps}>{children}</div>;
    };

    return React.createElement(HeroTooltip.Trigger as React.ComponentType<any>, { ...props, render: renderTrigger });
  },
);
TooltipTrigger.displayName = "TooltipTrigger";

type TooltipContentProps = Omit<React.ComponentPropsWithoutRef<typeof HeroTooltip.Content>, "placement" | "offset"> & {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
};
type TooltipPlacement = NonNullable<React.ComponentProps<typeof HeroTooltip.Content>["placement"]>;
const tooltipPlacements: Record<"top" | "bottom" | "left" | "right", Record<"start" | "center" | "end", TooltipPlacement>> = {
  top: { start: "top start", center: "top", end: "top end" },
  bottom: { start: "bottom start", center: "bottom", end: "bottom end" },
  left: { start: "left top", center: "left", end: "left bottom" },
  right: { start: "right top", center: "right", end: "right bottom" },
};
const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = "top", sideOffset = 4, align = "center", children, ...props }, ref) => {
    return (
      <HeroTooltip.Content
        ref={ref}
        placement={tooltipPlacements[side][align]}
        offset={sideOffset}
        className={cn(
          "z-[60] overflow-hidden rounded-pallas-md border bg-popover text-popover-foreground px-3 py-1.5 text-sm shadow-md animate-in fade-in-0 zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      >
        {children}
      </HeroTooltip.Content>
    );
  },
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
