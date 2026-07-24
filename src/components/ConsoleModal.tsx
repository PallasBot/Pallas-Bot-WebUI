import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  titleId?: string;
  panelClass?: string;
  bodyClass?: string;
  busy?: boolean;
  onClose: () => void;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export default function ConsoleModal({
  open,
  titleId,
  panelClass,
  bodyClass,
  busy = false,
  onClose,
  header,
  footer,
  children,
}: Props) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="console-modal ui-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="console-modal__backdrop ui-dialog__backdrop"
        aria-label="关闭"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        className={["console-modal__dialog ui-dialog__panel", panelClass].filter(Boolean).join(" ")}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {header ? <div className="console-modal__hd ui-dialog__hd">{header}</div> : null}
        <div className={["console-modal__bd ui-dialog__bd", bodyClass].filter(Boolean).join(" ")}>
          {children}
        </div>
        {footer ? <div className="ui-dialog__ft">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
