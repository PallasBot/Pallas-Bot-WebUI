import * as React from "react";
import { AlertDialog as HeroAlertDialog } from "@heroui/react";
import { Primitive } from "@radix-ui/react-primitive";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { DialogCloseFocusLifecycle, scheduleAfterFocusRestore } from "@/components/ui/dialog";

type AlertState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  escapeVeto: React.MutableRefObject<boolean>;
  returnFocusTarget: React.MutableRefObject<HTMLElement | null>;
  cancelRef: React.MutableRefObject<HTMLButtonElement | null>;
};
const AlertContext = React.createContext<AlertState | null>(null);
const AlertTextContext = React.createContext<{ titleId?: string; descriptionId?: string }>({});

function findAlertPartId(children: React.ReactNode, component: React.ElementType, fallback: string): string | undefined {
  let result: string | undefined;
  React.Children.forEach(children, (child) => {
    if (result || !React.isValidElement(child)) return;
    const props = child.props as { id?: string; children?: React.ReactNode };
    if (child.type === component) result = props.id ?? fallback;
    else if (child.type !== AlertDialog) result = findAlertPartId(props.children, component, fallback);
  });
  return result;
}

function AlertDialog({ open: controlledOpen, defaultOpen = false, onOpenChange, children }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const escapeVeto = React.useRef(false);
  const returnFocusTarget = React.useRef<HTMLElement | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement | null>(null);
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

  return <AlertContext.Provider value={{ open, setOpen, escapeVeto, returnFocusTarget, cancelRef }}>{children}</AlertContext.Provider>;
}

const AlertDialogTrigger = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Trigger>>(({ onClick, type, ...props }, ref) => {
  const state = React.useContext(AlertContext);
  if (!state) throw new Error("AlertDialogTrigger must be used within AlertDialog");
  return <Primitive.button
    {...props}
    ref={ref}
    type={type ?? "button"}
    aria-haspopup="dialog"
    aria-expanded={state.open}
    data-state={state.open ? "open" : "closed"}
    onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) state.setOpen(!state.open); }}
  />;
});
AlertDialogTrigger.displayName = AlertDialogPrimitive.Trigger.displayName;

const AlertDialogPortal = ({ children }: React.PropsWithChildren) => <>{children}</>;
const AlertDialogOverlay = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("fixed inset-0 z-[300] ui-surface-dialog-overlay bg-black/60", className)} {...props} />;
AlertDialogOverlay.displayName = "AlertDialogOverlay";

type AlertDialogContentProps = React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>;

const AlertDialogContent = React.forwardRef<HTMLElement, AlertDialogContentProps>(({ className, children, onCloseAutoFocus, onEscapeKeyDown, onOpenAutoFocus, role, forceMount: _forceMount, ...props }, forwardedRef) => {
  void _forceMount;
  const state = React.useContext(AlertContext);
  if (!state) throw new Error("AlertDialogContent must be used within AlertDialog");
  const contentRef = React.useRef<HTMLElement | null>(null);
  const openAutoFocusCallback = React.useRef(onOpenAutoFocus);
  openAutoFocusCallback.current = onOpenAutoFocus;
  const wasOpen = React.useRef(false);
  const openAutoFocusVeto = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const labelledBy = props["aria-labelledby"] ?? findAlertPartId(children, AlertDialogTitle, titleId);
  const describedBy = props["aria-describedby"] ?? findAlertPartId(children, AlertDialogDescription, descriptionId);

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
      if (!event.defaultPrevented) {
        state.cancelRef.current?.focus({ preventScroll: true });
      } else if (document.activeElement === before) {
        // A veto that does not pick its own target keeps the previously-focused
        // element focusable (top-layer) and refocuses it once the engine moves focus.
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
  }, [state.open, state.cancelRef]);

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

  return <HeroAlertDialog.Backdrop className="ui-surface-dialog-overlay bg-black/60 z-[300] data-[entering]:animate-in data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[entering]:fade-in-0" isOpen={state.open} onOpenChange={state.setOpen} isDismissable={false} isKeyboardDismissDisabled={false}>
    <HeroAlertDialog.Container placement="center">
      <HeroAlertDialog.Dialog
        className={cn("ui-surface-dialog fixed left-1/2 top-1/2 z-[300] grid max-h-[min(90vh,calc(100dvh-32px))] w-[min(28rem,calc(100vw-32px))] max-w-[min(28rem,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-[var(--radius-md,12px)] border bg-pallas-background p-4 shadow-lg sm:p-6", "duration-200 data-[entering]:animate-in data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[entering]:fade-in-0 data-[exiting]:zoom-out-95 data-[entering]:zoom-in-95", className)}
        {...props}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        render={(renderProps) => (
          <section
            {...renderProps}
            role={role ?? renderProps.role}
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
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
                event.stopPropagation();
                state.escapeVeto.current = true;
                queueMicrotask(() => {
                  state.escapeVeto.current = false;
                });
              }
            }}
          />
        )}
      >
        <AlertTextContext.Provider value={{ titleId, descriptionId }}>{children}</AlertTextContext.Provider>
        <DialogCloseFocusLifecycle onCloseAutoFocus={onCloseAutoFocus} returnFocusTarget={state.returnFocusTarget} open={state.open} />
      </HeroAlertDialog.Dialog>
    </HeroAlertDialog.Container>
  </HeroAlertDialog.Backdrop>;
});
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <HeroAlertDialog.Header className={cn("flex flex-col space-y-2 text-left", className)} {...props} />;
AlertDialogHeader.displayName = "AlertDialogHeader";
const AlertDialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <HeroAlertDialog.Body className={cn("text-left", className)} {...props} />;
AlertDialogBody.displayName = "AlertDialogBody";
const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <HeroAlertDialog.Footer className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />;
AlertDialogFooter.displayName = "AlertDialogFooter";
const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>>(({ className, id, ...props }, ref) => {
  const ids = React.useContext(AlertTextContext);
  return <HeroAlertDialog.Heading ref={ref} id={id ?? ids.titleId} className={cn("text-left text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
});
AlertDialogTitle.displayName = "AlertDialogTitle";
const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>>(({ className, id, asChild: _asChild, ...props }, ref) => {
  void _asChild;
  const ids = React.useContext(AlertTextContext);
  return <p ref={ref} id={id ?? ids.descriptionId} className={cn("text-left text-sm text-muted-foreground", className)} {...props} />;
});
AlertDialogDescription.displayName = "AlertDialogDescription";
const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>>(({ className, onClick, ...props }, ref) => {
  const state = React.useContext(AlertContext);
  const { type, ...buttonProps } = props;
  return <Primitive.button ref={ref} className={cn(buttonVariants(), className)} {...buttonProps} type={type ?? "button"} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) state?.setOpen(false); }} />;
});
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;
const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>>(({ className, onClick, ...props }, ref) => {
  const state = React.useContext(AlertContext);
  const { type, ...buttonProps } = props;
  return <Primitive.button ref={(element) => {
    if (state) state.cancelRef.current = element;
    if (typeof ref === "function") ref(element);
    else if (ref) ref.current = element;
  }} className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)} {...buttonProps} type={type ?? "button"} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) state?.setOpen(false); }} />;
});
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export { AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel };
