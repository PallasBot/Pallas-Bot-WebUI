import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Header, ListBox, Select as HeroSelect, Separator } from "@heroui/react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

type SelectRootProps = Omit<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>, "open" | "defaultOpen" | "onOpenChange"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};
type SelectCloseAutoFocusHandler = NonNullable<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>["onCloseAutoFocus"]>;
const SelectCloseAutoFocusContext = React.createContext<React.MutableRefObject<SelectCloseAutoFocusHandler | undefined> | null>(null);

function Select({
  value,
  defaultValue,
  onValueChange,
  open,
  defaultOpen,
  onOpenChange,
  disabled,
  required,
  children,
  ...props
}: SelectRootProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isOpen = open ?? uncontrolledOpen;
  const wasOpen = React.useRef(isOpen);
  const closeAutoFocus = React.useRef<SelectCloseAutoFocusHandler | undefined>(undefined);

  React.useEffect(() => {
    if (wasOpen.current && !isOpen) {
      const event = new Event("closeAutoFocus", { cancelable: true });
      closeAutoFocus.current?.(event);
      if (event.defaultPrevented) {
        const target = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        requestAnimationFrame(() => target?.isConnected && target.focus({ preventScroll: true }));
      }
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  return (
    <HeroSelect.Root
      {...props}
      value={value}
      defaultValue={defaultValue}
      onChange={(key) => onValueChange?.(key == null ? "" : String(key))}
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (open === undefined) setUncontrolledOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}
      isDisabled={disabled}
      isRequired={required}
    >
      <SelectCloseAutoFocusContext.Provider value={closeAutoFocus}>{children}</SelectCloseAutoFocusContext.Provider>
    </HeroSelect.Root>
  );
}

const SelectGroup = ListBox.Section;
type SelectValueProps = React.ComponentPropsWithoutRef<typeof HeroSelect.Value> & { placeholder?: string };
const SelectValue = ({ placeholder, children, ...props }: SelectValueProps) => (
  <HeroSelect.Value {...props}>
    {children ?? (({ isPlaceholder, selectedText }) => isPlaceholder ? placeholder : selectedText)}
  </HeroSelect.Value>
);
const SelectViewportContext = React.createContext<{
  ref: React.RefObject<HTMLDivElement | null>;
  canScrollUp: boolean;
  canScrollDown: boolean;
} | null>(null);

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof HeroSelect.Trigger>,
  Omit<React.ComponentPropsWithoutRef<typeof HeroSelect.Trigger>, "isDisabled" | "children"> & {
    disabled?: boolean;
    title?: string;
    children?: React.ReactNode;
  }
>(({ className, children, disabled, title, ...props }, ref) => (
  <HeroSelect.Trigger
    ref={ref}
    isDisabled={disabled}
    render={(triggerProps) => <button {...triggerProps} data-heroui-skin="true" title={title} />}
    className={cn(
      "min-h-[var(--ui-ctrl-height,36px)] w-full min-w-0 overflow-hidden [&>span]:flex [&>span]:h-full [&>span]:min-w-0 [&>span]:flex-1 [&>span]:items-center [&>span]:overflow-x-hidden [&>span]:overflow-y-visible [&>span]:text-left [&>span]:leading-[1.25] [&>span]:whitespace-nowrap [&>span]:text-ellipsis [&>span>*]:min-w-0 [&>span>*]:overflow-x-hidden [&>span>*]:overflow-y-visible [&>span>*]:text-ellipsis [&>span>*]:whitespace-nowrap [&>svg]:shrink-0 [&>svg]:self-center",
      className,
    )}
    {...props}
  >
    {children as React.ReactNode}
    <HeroSelect.Indicator>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </HeroSelect.Indicator>
  </HeroSelect.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

const ScrollButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { direction: -1 | 1 }
>(({ direction, className, ...props }, ref) => {
  const viewport = React.useContext(SelectViewportContext);
  const Icon = direction < 0 ? ChevronUp : ChevronDown;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={direction < 0 ? "Scroll options up" : "Scroll options down"}
      disabled={direction < 0 ? !viewport?.canScrollUp : !viewport?.canScrollDown}
      className={cn("flex w-full cursor-default items-center justify-center py-1 disabled:hidden", className)}
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        viewport?.ref.current?.scrollBy({ top: direction * 96, behavior: "smooth" });
      }}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
});

const SelectScrollUpButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  (props, ref) => <ScrollButton {...props} ref={ref} direction={-1} />,
);
SelectScrollUpButton.displayName = "SelectScrollUpButton";

const SelectScrollDownButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  (props, ref) => <ScrollButton {...props} ref={ref} direction={1} />,
);
SelectScrollDownButton.displayName = "SelectScrollDownButton";

type SelectContentProps = Omit<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>, "position">;
type SelectPlacement = NonNullable<React.ComponentProps<typeof HeroSelect.Popover>["placement"]>;
const selectPlacements: Record<"top" | "bottom" | "left" | "right", Record<"start" | "center" | "end", SelectPlacement>> = {
  top: { start: "top start", center: "top", end: "top end" },
  bottom: { start: "bottom start", center: "bottom", end: "bottom end" },
  left: { start: "left top", center: "left", end: "left bottom" },
  right: { start: "right top", center: "right", end: "right bottom" },
};
const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(function SelectContent(
  { className, children, align = "start", side = "bottom", sideOffset = 4, onCloseAutoFocus, ...props },
  ref,
) {
  const closeAutoFocus = React.useContext(SelectCloseAutoFocusContext);
  if (closeAutoFocus) closeAutoFocus.current = onCloseAutoFocus;
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = React.useState<HTMLDivElement | null>(null);
  const [scrollable, setScrollable] = React.useState({ up: false, down: false });
  const setViewportRef = React.useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    setViewport(node);
  }, []);
  React.useEffect(() => {
    if (!viewport) return;
    const updateScrollButtons = () => setScrollable({
      up: viewport.scrollTop > 0,
      down: Math.ceil(viewport.scrollTop + viewport.clientHeight) < viewport.scrollHeight,
    });
    updateScrollButtons();
    viewport.addEventListener("scroll", updateScrollButtons);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollButtons);
    observer?.observe(viewport);
    return () => {
      viewport.removeEventListener("scroll", updateScrollButtons);
      observer?.disconnect();
    };
  }, [viewport]);
  return (
    <HeroSelect.Popover
      ref={ref}
      placement={selectPlacements[side][align]}
      offset={sideOffset}
      className={cn(
      "relative z-[500] flex min-h-0 min-w-[8rem] flex-col overflow-hidden data-[entering]:animate-in data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[entering]:fade-in-0 data-[exiting]:zoom-out-95 data-[entering]:zoom-in-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    >
      <SelectViewportContext.Provider value={{ ref: viewportRef, canScrollUp: scrollable.up, canScrollDown: scrollable.down }}>
        <SelectScrollUpButton />
        <ListBox ref={setViewportRef} className="min-h-0 flex-1 overflow-auto p-1">{children}</ListBox>
        <SelectScrollDownButton />
      </SelectViewportContext.Provider>
    </HeroSelect.Popover>
  );
});
SelectContent.displayName = "SelectContent";

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof Header>,
  React.ComponentPropsWithoutRef<typeof Header>
>(({ className, ...props }, ref) => (
  <Header
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-[11px] font-medium tracking-wide text-[var(--accent)]", className)}
    {...props}
  />
));
SelectLabel.displayName = "SelectLabel";

function textValue(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textValue).join(" ");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textValue(node.props.children);
  return "";
}

type SelectItemProps = Omit<React.ComponentPropsWithoutRef<typeof ListBox.Item>, "id" | "textValue" | "isDisabled" | "children"> & {
  value: string;
  textValue?: string;
  disabled?: boolean;
  children?: React.ReactNode;
};
const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, value, textValue: suppliedTextValue, children, disabled, ...props }, ref) => (
    <ListBox.Item
      ref={ref}
      id={value}
      textValue={suppliedTextValue || textValue(children) || value}
      isDisabled={disabled}
      className={cn(
        "relative flex w-full cursor-default select-none items-center py-1.5 pl-8 pr-2",
        className,
      )}
      {...(props as React.ComponentPropsWithoutRef<typeof ListBox.Item>)}
    >
      <ListBox.ItemIndicator className="start-2 end-auto">
        <Check className="h-4 w-4 text-[var(--accent)]" />
      </ListBox.ItemIndicator>
      {children}
    </ListBox.Item>
  ),
);
SelectItem.displayName = "SelectItem";

const SelectSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-pallas-muted", className)} {...props} />
  ),
);
SelectSeparator.displayName = "SelectSeparator";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
