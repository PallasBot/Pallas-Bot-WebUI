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
import { Trash2 } from "lucide-react";

export type ConsoleDeleteListItem = {
  key: string;
  label: string;
};

type Props = {
  open: boolean;
  title: string;
  subtitle: string;
  items: ConsoleDeleteListItem[];
  busy?: boolean;
  error?: string;
  warnings?: string[];
  confirmLabel?: string;
  busyLabel?: string;
  listLabel?: string;
  /** 默认 destructive（删除）；重启/停止等用 default */
  confirmVariant?: "destructive" | "default";
  titleId?: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** 批量操作二级确认：shadcn AlertDialog（展示账号列表与可选警告）。 */
export default function ConsoleDeleteConfirmModal({
  open,
  title,
  subtitle,
  items,
  busy = false,
  error,
  warnings,
  confirmLabel,
  busyLabel,
  listLabel = "账号列表",
  confirmVariant = "destructive",
  titleId,
  onClose,
  onConfirm,
}: Props) {
  const headingId = titleId || "console-delete-modal-title";
  const confirmText = busy
    ? busyLabel || (confirmVariant === "destructive" ? "删除中…" : "处理中…")
    : confirmLabel || (confirmVariant === "destructive" ? "确认删除" : "确认");

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

        <div className="space-y-2">
          <p className="m-0 text-[13px] text-muted-foreground">{listLabel}</p>
          <ul className="inst-delete-account-list muted m-0">
            {items.map((item) => (
              <li key={item.key}>{item.label}</li>
            ))}
          </ul>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <Button type="button" variant={confirmVariant} icon={Trash2} disabled={busy} onClick={onConfirm}>
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
