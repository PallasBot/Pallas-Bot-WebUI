import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { useComposedRefs } from "@radix-ui/react-compose-refs";
import { Popover as HeroPopover } from "@heroui/react";
import { cn } from "@/lib/utils";

type RootProps = React.ComponentPropsWithoutRef<typeof HeroPopover.Root> & {
  open?: boolean;
  modal?: boolean;
};
const PopoverContext = React.createContext({ modal: false, open: false, close: () => {}, id: "", ancestors: [] as string[] });

const Popover = ({ open, isOpen, defaultOpen, onOpenChange, modal = false, ...props }: RootProps) => {
  const parent = React.useContext(PopoverContext);
  const controlledOpen = open ?? isOpen;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const currentOpen = controlledOpen ?? uncontrolledOpen;
  const id = React.useId();
  const handleOpenChange = React.useCallback((next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);
  const close = React.useCallback(() => handleOpenChange(false), [handleOpenChange]);

  return (
      <PopoverContext.Provider value={{ modal, open: currentOpen, close, id, ancestors: [...parent.ancestors, parent.id].filter(Boolean) }}>
      <HeroPopover.Root isOpen={currentOpen} onOpenChange={handleOpenChange} {...props} />
    </PopoverContext.Provider>
  );
};

type ButtonTriggerProps = React.ComponentProps<typeof HeroPopover.Trigger<"button">>;
type TriggerProps = Omit<ButtonTriggerProps, "children" | "render"> & {
  asChild?: boolean;
  children?: React.ReactNode;
};

const PopoverTrigger = ({ asChild, children, onClick, ...props }: TriggerProps) => {
  const { id } = React.useContext(PopoverContext);
  const child = React.isValidElement(children) ? children : null;
  const renderTrigger = (triggerProps: React.ComponentProps<"button">) => {
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event);
      if (!event.defaultPrevented) triggerProps.onClick?.(event);
    };

    if (asChild && child) {
      return (
        <Slot {...triggerProps} onClick={handleClick} data-pallas-popover-trigger={id}>
          {child}
        </Slot>
      );
    }
    return (
      <button {...triggerProps} onClick={handleClick} data-pallas-popover-trigger={id}>
        {children}
      </button>
    );
  };

  if (asChild && child) {
    return (
      <HeroPopover.Trigger<"button">
        {...props}
        render={renderTrigger}
      />
    );
  }
  return (
    <HeroPopover.Trigger<"button">
      {...props}
      render={renderTrigger}
    />
  );
};

type PopoverContentProps = React.ComponentPropsWithoutRef<typeof HeroPopover.Content> & {
  id?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  collisionPadding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  onOpenAutoFocus?: (event: Event) => void;
};

function collisionPadding(value: NonNullable<PopoverContentProps["collisionPadding"]>): number {
  if (typeof value === "number") return value;
  // React Aria accepts one container padding; the largest side preserves every requested minimum.
  return Math.max(value.top ?? 0, value.right ?? 0, value.bottom ?? 0, value.left ?? 0);
}

const placements = {
  top: { start: "top start", end: "top end" },
  bottom: { start: "bottom start", end: "bottom end" },
  left: { start: "left top", end: "left bottom" },
  right: { start: "right top", end: "right bottom" },
} satisfies Record<"top" | "right" | "bottom" | "left", Record<"start" | "end", NonNullable<PopoverContentProps["placement"]>>>;

const PopoverContent = React.forwardRef<HTMLElement, PopoverContentProps>(
  (
    {
      className,
      align = "center",
      side = "bottom",
      sideOffset = 4,
      collisionPadding: padding = 8,
      children,
      id,
      onOpenAutoFocus,
      placement,
      render,
      ...props
    },
    ref,
  ) => {
    const { modal, open, close, id: triggerId, ancestors } = React.useContext(PopoverContext);
    const contentRef = React.useRef<HTMLElement>(null);
    const composedRef = useComposedRefs(ref, contentRef);
    const handledOpenAutoFocus = React.useRef(false);
    const wasOpen = React.useRef(open);
    const findTrigger = React.useCallback(() => {
      const ownerDocument = contentRef.current?.ownerDocument ?? document;
      return [...ownerDocument.querySelectorAll<HTMLElement>("[data-pallas-popover-trigger]")].find(
        (element) => element.getAttribute("data-pallas-popover-trigger") === triggerId,
      );
    }, [triggerId]);
    // Any open popover whose ancestry lists this layer is a nested descendant that owns dismissal.
    const hasOpenDescendant = React.useCallback(() => {
      const ownerDocument = contentRef.current?.ownerDocument ?? document;
      return [...ownerDocument.querySelectorAll<HTMLElement>("[data-pallas-popover-content]")].some((element) =>
        element.dataset.pallasPopoverAncestors?.split(/\s+/).includes(triggerId),
      );
    }, [triggerId]);
    const renderWithId: NonNullable<PopoverContentProps["render"]> = (elementProps, renderProps) => {
      const propsWithId = { ...elementProps, id };
      return render ? render(propsWithId, renderProps) : <div {...propsWithId} />;
    };

    React.useLayoutEffect(() => {
      const wasOpenBefore = wasOpen.current;
      wasOpen.current = open;
      if (!open) {
        handledOpenAutoFocus.current = false;
        if (wasOpenBefore && !modal) {
          const content = contentRef.current;
          if (content?.contains(content.ownerDocument.activeElement)) findTrigger()?.focus({ preventScroll: true });
        }
        return;
      }
      if (handledOpenAutoFocus.current) return;
      handledOpenAutoFocus.current = true;
      const event = new Event("openAutoFocus", { cancelable: true });
      onOpenAutoFocus?.(event);
      if (event.defaultPrevented || modal) return;

      const content = contentRef.current;
      if (!content || content.contains(content.ownerDocument.activeElement)) return;
      const target = content.querySelector<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      (target ?? content).focus({ preventScroll: true });
    }, [findTrigger, modal, onOpenAutoFocus, open]);

    React.useEffect(() => {
      if (!open || modal) return;

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        // Only the topmost layer handles Escape; a nested open popover owns this key press.
        if (hasOpenDescendant()) return;
        const focusWasInContent = contentRef.current?.contains(document.activeElement) ?? false;
        queueMicrotask(() => {
          const trigger = findTrigger();
          if (event.defaultPrevented) {
            if (focusWasInContent && trigger?.getAttribute("aria-expanded") === "false") {
              trigger.focus({ preventScroll: true });
            }
            return;
          }
          // Manual dismiss always hands focus back to the trigger, even when focus sat on <body>.
          trigger?.focus({ preventScroll: true });
          close();
        });
      };
      const onPointerDown = (event: PointerEvent) => {
        if (event.defaultPrevented || !(event.target instanceof Node)) return;
        const target = event.target;
        if (contentRef.current?.contains(target)) return;
        if (findTrigger()?.contains(target)) return;
        const targetElement = target instanceof Element ? target : target.parentElement;
        const nestedContent = targetElement?.closest<HTMLElement>("[data-pallas-popover-content]");
        if (nestedContent?.dataset.pallasPopoverAncestors?.split(/\s+/).includes(triggerId)) return;
        close();
      };

      document.addEventListener("keydown", onKeyDown, true);
      document.addEventListener("pointerdown", onPointerDown);
      return () => {
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("pointerdown", onPointerDown);
      };
    }, [close, findTrigger, hasOpenDescendant, modal, open]);

    // PreviewTrigger supplies dialog semantics while the wrapper handles nonmodal focus and dismissal.
    return (
      <HeroPopover.Content
        {...props}
        ref={composedRef}
        placement={placement ?? (align === "center" ? side : placements[side][align])}
        offset={sideOffset}
        containerPadding={collisionPadding(padding)}
        isNonModal={!modal}
        trigger={!modal ? "PreviewTrigger" : undefined}
        data-pallas-popover-content=""
        data-pallas-popover-ancestors={ancestors.join(" ")}
        render={id === undefined ? render : renderWithId}
        className={cn(
          "ui-surface-popover z-[500] w-72 max-h-[var(--visual-viewport-height,100dvh)] max-h-[var(--radix-popover-content-available-height,100dvh)] rounded-[var(--radius-control,8px)] border bg-popover p-4 text-popover-foreground shadow-md outline-none [--radix-popover-trigger-width:var(--trigger-width)]",
          className,
        )}
      >
        {children}
      </HeroPopover.Content>
    );
  },
);
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent };
