import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { Braces, Hash, List, TextCursorInput, ToggleLeft } from "lucide-react";
import type { PluginConfigField } from "@/api/console";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer";
import UiField from "@/components/ui/UiField";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { resolveConfigFieldLayout } from "@/utils/pluginConfigFieldModel";
import { fieldDisplayTitle, fieldHelpDefaultValue } from "@/utils/configFieldDisplay";

function fieldKindIcon(kind: string): LucideIcon {
  if (kind === "bool") return ToggleLeft;
  if (kind === "enum") return List;
  if (kind === "int" || kind === "float" || kind === "number") return Hash;
  if (kind === "json") return Braces;
  return TextCursorInput;
}

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 560;
}

function FieldHelpBody({ field, title }: { field: PluginConfigField; title: string }) {
  const desc = field.description?.trim();
  return (
    <>
      <div className="plugin-config-field-popover__section">
        <div className="plugin-config-field-popover__eyebrow">配置说明</div>
        <h4 className="plugin-config-field-popover__title">{title}</h4>
        {desc ? (
          <p className="plugin-config-field-popover__desc">{desc}</p>
        ) : (
          <p className="plugin-config-field-popover__desc plugin-config-field-popover__desc--muted">
            暂无详细说明。
          </p>
        )}
      </div>
      <dl className="plugin-config-field-popover__meta">
        <div>
          <dt>默认值</dt>
          <dd>
            <code>{fieldHelpDefaultValue(field)}</code>
          </dd>
        </div>
        <div>
          <dt>环境键</dt>
          <dd>
            <code>{field.env_key || "—"}</code>
          </dd>
        </div>
      </dl>
    </>
  );
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
  // 下方够用或比上方更宽裕时优先向下；否则翻到上方，并用可用高度限制 maxHeight。
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

export default function PluginConfigFieldShell({
  field,
  modelValue,
  onValueChange,
}: {
  field: PluginConfigField;
  modelValue: string;
  onValueChange: (value: string) => void;
}) {
  const layout = resolveConfigFieldLayout(field);
  const title = fieldDisplayTitle(field);
  const hasDesc = Boolean(field.description?.trim());
  const Icon = fieldKindIcon(field.kind);

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

  const onPopoverEnter = () => {
    clearCloseTimer();
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

  const helpExpanded = popoverOpen || dialogOpen;

  return (
    <UiField
      className={cn("plugin-config-form-item", `plugin-config-form-item--${layout}`)}
      label={title}
      required={Boolean(field.required)}
      secret={Boolean(field.secret)}
      labelStart={
        <span className="plugin-config-form-item__label-icon" aria-hidden="true">
          <Icon className="plugin-config-form-item__label-icon-svg" />
        </span>
      }
      labelEnd={
        <button
          type="button"
          className={cn(
            "plugin-config-form-item__help-btn",
            hasDesc && "plugin-config-form-item__help-btn--has-desc",
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
      }
    >
      <ConfigFieldRenderer
        field={field}
        modelValue={modelValue}
        onValueChange={onValueChange}
        showLabel={false}
        showMeta={false}
        showDescription={false}
        inputMaxWidth="100%"
      />

      {popoverOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={hostRef}
              className="plugin-config-field-popover"
              style={popoverStyle}
              role="tooltip"
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={onPopoverEnter}
              onMouseLeave={onHelpHoverLeave}
            >
              <div className="plugin-config-field-popover__scroll">
                <FieldHelpBody field={field} title={title} />
              </div>
            </div>,
            document.body,
          )
        : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="plugin-config-field-dialog max-w-[min(760px,calc(100vw-32px))]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>查看说明、默认值与环境键。</DialogDescription>
          </DialogHeader>
          <div className="plugin-config-field-popover plugin-config-field-popover--dialog">
            <FieldHelpBody field={field} title={title} />
          </div>
        </DialogContent>
      </Dialog>
    </UiField>
  );
}
