import * as React from "react";
import { Description, Modal } from "@heroui/react";
import { Primitive } from "@radix-ui/react-primitive";
import { Slot } from "@radix-ui/react-slot";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  escapeVeto: React.MutableRefObject<boolean>;
  returnFocusTarget: React.MutableRefObject<HTMLElement | null>;
};

const DialogContext = React.createContext<DialogState | null>(null);
const DialogTextContext = React.createContext<{ titleId?: string; descriptionId?: string }>({});
const focusRestoreEventName = "react-aria-focus-scope-restore";

function findChildId(children: React.ReactNode, component: React.ElementType, fallback: string): string | undefined {
  let result: string | undefined;
  React.Children.forEach(children, (child) => {
    if (result || !React.isValidElement<{ id?: string; children?: React.ReactNode; asChild?: boolean }>(child)) return;
    const childProps = child.props;
    if (child.type === component) {
      const nestedId = childProps.asChild && React.isValidElement<{ id?: string }>(childProps.children)
        ? childProps.children.props.id
        : undefined;
      result = childProps.id ?? nestedId ?? fallback;
    } else if (child.type !== Dialog) {
      result = findChildId(childProps.children, component, fallback);
    }
  });
  return result;
}

type DialogProps = Omit<React.ComponentProps<typeof DialogPrimitive.Root>, "modal">;

function Dialog({ open: controlledOpen, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const escapeVeto = React.useRef(false);
  const returnFocusTarget = React.useRef<HTMLElement | null>(null);
  const wasOpen = React.useRef(false);

  if (open && !wasOpen.current && typeof document !== "undefined") {
    returnFocusTarget.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpen.current = open;

  const setOpen = (next: boolean) => {
    if (!next && escapeVeto.current) {
      escapeVeto.current = false;
      return;
    }
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return <DialogContext.Provider value={{ open, setOpen, escapeVeto, returnFocusTarget }}>{children}</DialogContext.Provider>;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>>(
  ({ onClick, type, ...props }, ref) => {
    const state = React.useContext(DialogContext);
    if (!state) throw new Error("DialogTrigger must be used within Dialog");
    return (
      <Primitive.button
        {...props}
        ref={ref}
        type={type ?? "button"}
        aria-haspopup="dialog"
        aria-expanded={state.open}
        data-state={state.open ? "open" : "closed"}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) state.setOpen(!state.open);
        }}
      />
    );
  },
);
DialogTrigger.displayName = DialogPrimitive.Trigger.displayName;

const DialogClose = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>>(
  ({ onClick, type, ...props }, ref) => {
    const state = React.useContext(DialogContext);
    if (!state) throw new Error("DialogClose must be used within Dialog");
    return (
      <Primitive.button
        {...props}
        ref={ref}
        type={type ?? "button"}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) state.setOpen(false);
        }}
      />
    );
  },
);
DialogClose.displayName = DialogPrimitive.Close.displayName;

const DialogPortal = ({ children }: React.PropsWithChildren) => <>{children}</>;

const DialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 ui-surface-dialog-overlay bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  ),
);
DialogOverlay.displayName = "DialogOverlay";

type DialogContentProps = Omit<
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  "onScroll" | "role"
> & {
  onScroll?: React.UIEventHandler<HTMLElement>;
  role?: "dialog" | "alertdialog";
};
type PointerOutsideEvent = Parameters<NonNullable<DialogContentProps["onPointerDownOutside"]>>[0];
type FocusOutsideEvent = Parameters<NonNullable<DialogContentProps["onFocusOutside"]>>[0];
type OutsideRequest = { target: EventTarget | null; prevented: boolean };

export function scheduleAfterFocusRestore(callback: () => void) {
  let finished = false;
  let timeout = 0;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timeout);
    callback();
  };
  timeout = window.setTimeout(finish, 1000);
  const nextFrame = (next: FrameRequestCallback) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(next);
    else window.setTimeout(next, 0);
  };
  nextFrame(() => nextFrame(finish));
}

export function DialogCloseFocusLifecycle({
  onCloseAutoFocus,
  returnFocusTarget,
  open,
}: {
  onCloseAutoFocus?: (event: Event) => void;
  returnFocusTarget: React.MutableRefObject<HTMLElement | null>;
  open: boolean;
}) {
  const callback = React.useRef(onCloseAutoFocus);
  callback.current = onCloseAutoFocus;
  const openRef = React.useRef(open);
  openRef.current = open;
  const generation = React.useRef(0);
  const invoked = React.useRef(false);

  const invoke = React.useCallback((restoreEvent?: Event) => {
    if (invoked.current) return;
    invoked.current = true;
    const event = new Event("closeAutoFocus", { cancelable: true });
    callback.current?.(event);

    const target = returnFocusTarget.current;
    if (event.defaultPrevented) {
      restoreEvent?.preventDefault();
      if (!restoreEvent && target?.isConnected) {
        const preventRestore = (event: Event) => event.preventDefault();
        target.addEventListener(focusRestoreEventName, preventRestore, { once: true });
        scheduleAfterFocusRestore(() => target.removeEventListener(focusRestoreEventName, preventRestore));
      }
    }
    returnFocusTarget.current = null;
  }, [returnFocusTarget]);

  React.useLayoutEffect(() => {
    const effectGeneration = ++generation.current;
    return () => {
      if (!openRef.current) {
        invoke();
        return;
      }

      const target = returnFocusTarget.current;
      const onRestore = (event: Event) => {
        target?.removeEventListener(focusRestoreEventName, onRestore);
        if (generation.current === effectGeneration) invoke(event);
      };
      if (target?.isConnected) target.addEventListener(focusRestoreEventName, onRestore);
      scheduleAfterFocusRestore(() => {
        target?.removeEventListener(focusRestoreEventName, onRestore);
        if (generation.current === effectGeneration) invoke();
      });
    };
  }, [invoke, returnFocusTarget]);

  return null;
}

const DialogContent = React.forwardRef<HTMLElement, DialogContentProps>(
  (
    {
      className,
      children,
      onScroll,
      onEscapeKeyDown,
      onOpenAutoFocus,
      onPointerDownOutside,
      onFocusOutside,
      onInteractOutside,
      onCloseAutoFocus,
      role,
      forceMount: _forceMount,
      ...props
    },
    forwardedRef,
  ) => {
    void _forceMount;
    const state = React.useContext(DialogContext);
    if (!state) throw new Error("DialogContent must be used within Dialog");

    const contentRef = React.useRef<HTMLElement | null>(null);
    const backdropRef = React.useRef<HTMLDivElement | null>(null);
    const outsideRequest = React.useRef<OutsideRequest | null>(null);
    const outsideCallbacks = React.useRef({ onPointerDownOutside, onInteractOutside });
    outsideCallbacks.current = { onPointerDownOutside, onInteractOutside };
    const openAutoFocusCallback = React.useRef(onOpenAutoFocus);
    openAutoFocusCallback.current = onOpenAutoFocus;
    const wasOpen = React.useRef(false);
    const openAutoFocusVeto = React.useRef<HTMLElement | null>(null);
    const titleId = React.useId();
    const descriptionId = React.useId();
    const labelledBy = props["aria-labelledby"] ?? findChildId(children, DialogTitle, titleId);
    const describedBy = props["aria-describedby"] ?? findChildId(children, DialogDescription, descriptionId);
    const {
      "aria-labelledby": _ariaLabelledBy,
      "aria-describedby": _ariaDescribedBy,
      ...dialogProps
    } = props;
    void _ariaLabelledBy;
    void _ariaDescribedBy;
    const ariaLabelProps = {
      ...(labelledBy === undefined ? {} : { "aria-labelledby": labelledBy }),
      ...(describedBy === undefined ? {} : { "aria-describedby": describedBy }),
    };

    React.useLayoutEffect(() => {
      if (!state.open) {
        wasOpen.current = false;
        openAutoFocusVeto.current = null;
        return;
      }
      if (!wasOpen.current) {
        wasOpen.current = true;
        openAutoFocusVeto.current = null;
        const before = document.activeElement;
        const event = new Event("openAutoFocus", { cancelable: true });
        openAutoFocusCallback.current?.(event);
        // HeroUI focuses the dialog itself in a later effect, and marks everything
        // outside it inert. To honor a veto that does not pick its own target, keep
        // the previously-focused element focusable (as a top-layer node) before the
        // engine hides the rest of the page, then refocus it once focus has moved.
        if (event.defaultPrevented && document.activeElement === before) {
          const target = state.returnFocusTarget.current;
          if (target?.isConnected) openAutoFocusVeto.current = target;
        }
      }
      const target = openAutoFocusVeto.current;
      if (!target) return;
      target.setAttribute("data-react-aria-top-layer", "");
      target.focus({ preventScroll: true });
      return () => {
        target.removeAttribute("data-react-aria-top-layer");
      };
    }, [state.open]);

    React.useEffect(() => {
      const target = openAutoFocusVeto.current;
      if (!state.open || !target) return;
      const restore = () => {
        if (target.isConnected) target.focus({ preventScroll: true });
      };
      restore();
      scheduleAfterFocusRestore(() => {
        if (contentRef.current?.contains(document.activeElement)) restore();
      });
    }, [state.open]);

    React.useEffect(() => {
      if (!state.open) return;
      let clearClickListener: (() => void) | null = null;

      const clearOutsideRequest = () => {
        outsideRequest.current = null;
        if (clearClickListener) document.removeEventListener("click", clearClickListener, true);
        clearClickListener = null;
      };

      const handlePointerDown = (event: PointerEvent) => {
        clearOutsideRequest();
        if (event.button > 0) return;
        const target = event.target;
        if (!(target instanceof Node) || !backdropRef.current?.contains(target) || contentRef.current?.contains(target)) return;
        if (target instanceof Element && target.closest("[data-react-aria-top-layer]")) return;

        const outsideEvent = new CustomEvent("pointerDownOutside", {
          cancelable: true,
          detail: { originalEvent: event },
        }) as PointerOutsideEvent;
        const callbacks = outsideCallbacks.current;
        callbacks.onPointerDownOutside?.(outsideEvent);
        callbacks.onInteractOutside?.(outsideEvent);
        const request: OutsideRequest = { target, prevented: outsideEvent.defaultPrevented || event.ctrlKey };
        outsideRequest.current = request;

        const clearAfterClick = () => {
          if (outsideRequest.current === request) outsideRequest.current = null;
          document.removeEventListener("click", clearAfterClick, true);
          if (clearClickListener === clearAfterClick) clearClickListener = null;
        };
        clearClickListener = clearAfterClick;
        document.addEventListener("click", clearAfterClick, true);
      };

      const handleClick = (event: MouseEvent) => {
        const request = outsideRequest.current;
        if (!request) return;
        request.target = event.target;
      };

      window.addEventListener("pointerdown", handlePointerDown, true);
      window.addEventListener("click", handleClick, true);
      window.addEventListener("pointercancel", clearOutsideRequest, true);
      return () => {
        window.removeEventListener("pointerdown", handlePointerDown, true);
        window.removeEventListener("click", handleClick, true);
        window.removeEventListener("pointercancel", clearOutsideRequest, true);
        clearOutsideRequest();
      };
    }, [state.open]);

    const handleFocusOutside = (event: React.FocusEvent<HTMLElement>) => {
      const target = event.relatedTarget;
      if (!(target instanceof Node) || contentRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-react-aria-top-layer]")) return;
      const outsideEvent = new CustomEvent("focusOutside", {
        cancelable: true,
        detail: { originalEvent: event.nativeEvent },
      }) as FocusOutsideEvent;
      onFocusOutside?.(outsideEvent);
      onInteractOutside?.(outsideEvent);
    };

    return (
      <Modal.Backdrop
        ref={backdropRef}
        className="fixed inset-0 z-50 ui-surface-dialog-overlay bg-black/60 data-[entering]:animate-in data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[entering]:fade-in-0"
        isOpen={state.open}
        onOpenChange={state.setOpen}
        isDismissable
        shouldCloseOnInteractOutside={(target) => {
          const request = outsideRequest.current;
          if (request && request.target === target) return !request.prevented;
          return true;
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog
            className={cn(
              "ui-surface-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[min(90vh,calc(100dvh-32px),52rem)] w-[min(42rem,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-[var(--radius-md,12px)] border bg-background p-4 shadow-lg",
              "data-[entering]:animate-in data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[entering]:fade-in-0 data-[exiting]:zoom-out-95 data-[entering]:zoom-in-95",
              className,
            )}
            {...dialogProps}
            {...ariaLabelProps}
            render={(renderProps) => (
              <section
                {...renderProps}
                role={role ?? renderProps.role}
                {...ariaLabelProps}
                ref={(element) => {
                  contentRef.current = element;
                  if (typeof renderProps.ref === "function") renderProps.ref(element);
                  else if (renderProps.ref) renderProps.ref.current = element;
                  if (typeof forwardedRef === "function") forwardedRef(element);
                  else if (forwardedRef) forwardedRef.current = element;
                }}
                onKeyDownCapture={(event) => {
                  if (event.key !== "Escape" || !contentRef.current?.contains(event.target as Node)) return;
                  onEscapeKeyDown?.(event.nativeEvent);
                  if (event.nativeEvent.defaultPrevented) {
                    state.escapeVeto.current = true;
                    queueMicrotask(() => {
                      state.escapeVeto.current = false;
                    });
                  }
                }}
                onBlurCapture={handleFocusOutside}
                onScroll={(event) => {
                  if (event.currentTarget.scrollTop !== 0) event.currentTarget.scrollTop = 0;
                  if (event.currentTarget.scrollLeft !== 0) event.currentTarget.scrollLeft = 0;
                  onScroll?.(event);
                }}
              >
                <DialogTextContext.Provider value={{ titleId, descriptionId }}>
                  {children}
                  <DialogClose className="ui-surface-dialog__close absolute right-3 top-3 flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-70 ring-offset-background transition-[color,background-color,opacity,transform] hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)] hover:text-foreground hover:opacity-100 active:scale-95 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring forced-colors:focus-visible:outline-solid forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-offset-2 forced-colors:focus-visible:outline-[Highlight]">
                    <X className="size-4" />
                    <span className="sr-only">关闭</span>
                  </DialogClose>
                  <DialogCloseFocusLifecycle
                    onCloseAutoFocus={onCloseAutoFocus}
                    returnFocusTarget={state.returnFocusTarget}
                    open={state.open}
                  />
                </DialogTextContext.Provider>
              </section>
            )}
          />
        </Modal.Container>
      </Modal.Backdrop>
    );
  },
);
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 pr-8 text-left", className)} {...props} />;
}

function DialogTitle({ className, id, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  const ids = React.useContext(DialogTextContext);
  return <Modal.Heading id={id ?? ids.titleId} className={cn("text-left text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
}

type DialogDescriptionProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & { asChild?: boolean };

function DialogDescription({ className, children, asChild, id, ...props }: DialogDescriptionProps) {
  const ids = React.useContext(DialogTextContext);
  if (!asChild) {
    return <Description elementType="p" id={id ?? ids.descriptionId} className={cn("text-left text-sm text-muted-foreground", className)} {...props}>{children}</Description>;
  }

  const child = React.Children.only(children);
  if (!React.isValidElement<{ id?: string }>(child)) return null;
  const childId = child.props.id;
  return (
    <Description
      elementType={typeof child.type === "string" ? child.type : "span"}
      id={id ?? childId ?? ids.descriptionId}
      className={cn("text-left text-sm text-muted-foreground", className)}
      {...props}
      render={(renderProps) => <Slot {...renderProps}>{child}</Slot>}
    />
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
