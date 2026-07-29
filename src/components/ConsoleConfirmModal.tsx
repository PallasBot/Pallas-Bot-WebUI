import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  title: string;
  subtitle: string;
  busy?: boolean;
  error?: string;
  warnings?: string[];
  confirmLabel?: string;
  busyLabel?: string;
  /** 默认 destructive；重启/停止等用 default */
  confirmVariant?: "destructive" | "default";
  titleId?: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** 单次危险操作二级确认（无需列表）。 */
export default function ConsoleConfirmModal({
  open,
  title,
  subtitle,
  busy = false,
  error,
  warnings,
  confirmLabel,
  busyLabel,
  confirmVariant = "destructive",
  titleId,
  onClose,
  onConfirm,
}: Props) {
  const headingId = titleId || "console-confirm-modal-title";
  const confirmText = busy
    ? busyLabel || (confirmVariant === "destructive" ? "处理中…" : "处理中…")
    : confirmLabel || (confirmVariant === "destructive" ? "确认" : "确认");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle id={headingId}>{title}</AlertDialogTitle>
          <AlertDialogDescription>{subtitle}</AlertDialogDescription>
        </AlertDialogHeader>

        {error ? <p className="alert alert--err m-0">{error}</p> : null}
        {(warnings ?? []).map((w, wi) => (
          <p key={`warn-${wi}`} className="alert alert--err m-0">
            {w}
          </p>
        ))}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <Button type="button" variant={confirmVariant} disabled={busy} onClick={onConfirm}>
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
