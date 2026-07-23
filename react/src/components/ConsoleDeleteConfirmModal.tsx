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
  titleId?: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** 删除确认：shadcn AlertDialog（实心底；异步删除期间由 `open`/`busy` 控制关闭）。 */
export default function ConsoleDeleteConfirmModal({
  open,
  title,
  subtitle,
  items,
  busy = false,
  error,
  warnings,
  confirmLabel,
  titleId,
  onClose,
  onConfirm,
}: Props) {
  const headingId = titleId || "console-delete-modal-title";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <AlertDialogContent className="bg-card sm:max-w-md">
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
          <p className="m-0 text-[13px] text-muted-foreground">账号列表</p>
          <ul className="inst-delete-account-list muted m-0">
            {items.map((item) => (
              <li key={item.key}>{item.label}</li>
            ))}
          </ul>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm}>
            {busy ? "删除中…" : confirmLabel || "确认删除"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
