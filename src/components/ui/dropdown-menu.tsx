import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Dropdown as HeroDropdown, Header, Separator } from "@heroui/react";
import { Check, ChevronRight, Circle } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

const DropdownCloseContext = React.createContext<(() => void) | null>(null);

type DropdownMenuRootProps = Omit<React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>, "modal">;
function DropdownMenu({ open, defaultOpen, onOpenChange, children, ...props }: DropdownMenuRootProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const isOpen = open ?? internalOpen;
  const setOpen = React.useCallback((next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [open, onOpenChange]);
  return (
    <DropdownCloseContext.Provider value={() => setOpen(false)}>
      <HeroDropdown.Root {...props} isOpen={isOpen} onOpenChange={setOpen}>
        {children}
      </HeroDropdown.Root>
    </DropdownCloseContext.Provider>
  );
}

type DropdownMenuTriggerProps = Omit<React.ComponentPropsWithoutRef<typeof HeroDropdown.Trigger>, "render" | "children"> & {
  asChild?: boolean;
  children?: React.ReactNode;
};
const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ asChild, children, ...props }, ref) => (
    <HeroDropdown.Trigger
      {...props}
      ref={ref}
      render={asChild ? (domProps) => <Slot {...domProps}>{children}</Slot> : undefined}
    >
      {asChild ? null : children as React.ReactNode}
    </HeroDropdown.Trigger>
  ),
);
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuGroup = HeroDropdown.Section;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-pallas-sm px-2 py-1.5 text-sm outline-hidden data-[state=open]:bg-pallas-accent focus:bg-pallas-accent",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "ui-surface-popover z-[500] min-w-[8rem] overflow-hidden rounded-[var(--radius-control,8px)] border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

type DropdownContentProps = Omit<React.ComponentPropsWithoutRef<typeof HeroDropdown.Popover>, "placement" | "offset"> & {
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
};
type DropdownPlacement = NonNullable<React.ComponentProps<typeof HeroDropdown.Popover>["placement"]>;
const dropdownPlacements: Record<"top" | "bottom" | "left" | "right", Record<"start" | "center" | "end", DropdownPlacement>> = {
  top: { start: "top start", center: "top", end: "top end" },
  bottom: { start: "bottom start", center: "bottom", end: "bottom end" },
  left: { start: "left top", center: "left", end: "left bottom" },
  right: { start: "right top", center: "right", end: "right bottom" },
};
const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownContentProps>(
  ({ className, side = "bottom", align = "center", sideOffset = 4, children, ...props }, ref) => (
    <HeroDropdown.Popover
      ref={ref}
      placement={dropdownPlacements[side][align]}
      offset={sideOffset}
      className={cn(
        "ui-surface-popover z-[500] min-w-[8rem] overflow-hidden rounded-[var(--radius-control,8px)] border bg-popover p-1 text-popover-foreground shadow-md data-[entering]:animate-in data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[entering]:fade-in-0 data-[exiting]:zoom-out-95 data-[entering]:zoom-in-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    >
      <HeroDropdown.Menu className="w-full">{children}</HeroDropdown.Menu>
    </HeroDropdown.Popover>
  ),
);
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

type DropdownMenuItemProps = Omit<React.ComponentPropsWithoutRef<typeof HeroDropdown.Item>, "onAction" | "id" | "textValue" | "isDisabled" | "children"> & {
  /** Stable collection key and visible typeahead label required by HeroUI Menu. */
  id: string;
  textValue: string;
  onSelect?: (event: Event) => void;
  inset?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
};
const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, inset, id, textValue, disabled, onSelect, children, ...props }, ref) => {
    const close = React.useContext(DropdownCloseContext);
    return (
      <HeroDropdown.Item
        key={id}
        ref={ref}
        id={id}
        textValue={textValue}
        isDisabled={disabled}
        shouldCloseOnSelect={false}
        onAction={() => {
          const event = new Event("menu-item-select", { cancelable: true });
          onSelect?.(event);
          if (!event.defaultPrevented) close?.();
        }}
        className={cn(
          "relative flex cursor-default select-none items-center rounded-pallas-sm px-2 py-1.5 text-sm outline-hidden transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[focus-visible=true]:bg-pallas-accent data-[focus-visible=true]:text-pallas-accent-foreground data-[focused=true]:bg-pallas-accent data-[focused=true]:text-pallas-accent-foreground",
          inset && "pl-8",
          className,
        )}
        {...(props as React.ComponentPropsWithoutRef<typeof HeroDropdown.Item>)}
      >
        {children}
      </HeroDropdown.Item>
    );
  },
);
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-pallas-sm py-1.5 pl-8 pr-2 text-sm outline-hidden transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-pallas-accent focus:text-pallas-accent-foreground",
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-pallas-sm py-1.5 pl-8 pr-2 text-sm outline-hidden transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-pallas-accent focus:text-pallas-accent-foreground",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<React.ElementRef<typeof Header>, React.ComponentPropsWithoutRef<typeof Header> & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => (
    <Header ref={ref} className={cn("px-2 py-1.5 text-sm font-medium", inset && "pl-8", className)} {...props} />
  ),
);
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<React.ElementRef<typeof Separator>, React.ComponentPropsWithoutRef<typeof Separator>>(
  ({ className, ...props }, ref) => <Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-pallas-muted", className)} {...props} />,
);
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />;
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
