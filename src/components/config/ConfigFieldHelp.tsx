import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 560;
}

function popoverPositionStyle(anchor: HTMLElement): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const maxWidth = Math.min(380, window.innerWidth - 16);
  const gap = 10;
  const edge = 8;
  if (window.innerWidth <= 560) {
    return {
      position: "fixed",
      left: 8,
      right: 8,
      bottom: 8,
      width: "calc(100vw - 16px)",
      maxHeight: "min(72vh, 640px)",
    };
  }
  const left = Math.min(Math.max(edge, rect.left), Math.max(edge, window.innerWidth - maxWidth - edge));
  const preferredMax = Math.min(window.innerHeight * 0.72, 640);
  const spaceBelow = window.innerHeight - rect.bottom - gap - edge;
  const spaceAbove = rect.top - gap - edge;
  const placeBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
  if (placeBelow) {
    return {
      position: "fixed",
      top: rect.bottom + gap,
      left,
      width: `min(${maxWidth}px, calc(100vw - 16px))`,
      maxHeight: Math.max(96, Math.min(preferredMax, spaceBelow)),
    };
  }
  return {
    position: "fixed",
    bottom: window.innerHeight - rect.top + gap,
    left,
    width: `min(${maxWidth}px, calc(100vw - 16px))`,
    maxHeight: Math.max(96, Math.min(preferredMax, spaceAbove)),
  };
}

function HelpBody({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className="plugin-config-field-popover__section">
      <div className="plugin-config-field-popover__eyebrow">配置说明</div>
      <h4 className="plugin-config-field-popover__title">{title}</h4>
      <div className="plugin-config-field-popover__desc">{description}</div>
    </div>
  );
}

/** 字段/段头标题旁「?」：桌面 hover/点击浮层，窄屏 Dialog。 */
export default function ConfigFieldHelp({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  const empty =
    description == null
    || description === false
    || (typeof description === "string" && !description.trim());
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closePopover = useCallback(() => {
    setPopoverOpen(false);
    pinnedRef.current = false;
    clearCloseTimer();
  }, [clearCloseTimer]);

  const openPopover = useCallback(
    (anchor: HTMLElement, nextPinned: boolean) => {
      clearCloseTimer();
      setPopoverOpen(true);
      pinnedRef.current = nextPinned;
      setPopoverStyle(popoverPositionStyle(anchor));
    },
    [clearCloseTimer],
  );

  const onHelpClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const anchor = event.currentTarget;
    if (isMobileViewport()) {
      closePopover();
      setDialogOpen(true);
      return;
    }
    if (popoverOpen && pinnedRef.current) {
      closePopover();
      return;
    }
    openPopover(anchor, true);
  };

  const onHelpHover = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isMobileViewport()) return;
    const anchor = event.currentTarget;
    clearCloseTimer();
    if (pinnedRef.current && popoverOpen) return;
    openPopover(anchor, false);
  };

  const onHelpHoverLeave = () => {
    if (pinnedRef.current) return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      if (!pinnedRef.current) closePopover();
    }, 120);
  };

  useEffect(() => {
    if (!popoverOpen) return;

    function onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") closePopover();
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (hostRef.current?.contains(target)) return;
      closePopover();
    }
    function onViewportChange() {
      closePopover();
    }

    window.addEventListener("keydown", onKeydown);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [popoverOpen, closePopover]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  if (empty) return null;

  const helpExpanded = popoverOpen || dialogOpen;

  return (
    <>
      <button
        type="button"
        className={cn(
          "plugin-config-form-item__help-btn",
          "plugin-config-form-item__help-btn--has-desc",
        )}
        aria-expanded={helpExpanded}
        aria-haspopup="dialog"
        aria-label={`查看 ${title} 说明`}
        onClick={onHelpClick}
        onMouseEnter={onHelpHover}
        onMouseLeave={onHelpHoverLeave}
      >
        ?
      </button>

      {popoverOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={hostRef}
              className="plugin-config-field-popover"
              style={popoverStyle}
              role="tooltip"
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={clearCloseTimer}
              onMouseLeave={onHelpHoverLeave}
            >
              <div className="plugin-config-field-popover__scroll">
                <HelpBody title={title} description={description} />
              </div>
            </div>,
            document.body,
          )
        : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="plugin-config-field-dialog max-w-[min(760px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>查看说明。</DialogDescription>
          </DialogHeader>
          <div className="plugin-config-field-popover plugin-config-field-popover--dialog">
            <HelpBody title={title} description={description} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
