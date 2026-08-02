import { useEffect, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { fetchDbBackupBrowse } from "@/api/fullConsole";
import type { DbBackupBrowseData } from "@/api/pallasTypes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CornerLeftUp, FolderCheck, Home, X } from "lucide-react";

/** 备份目录选择：shadcn Dialog，标题左对齐。 */
export default function BackupDirPicker({
  open,
  initialPath,
  onClose,
  onSelect,
}: {
  open: boolean;
  initialPath?: string;
  onClose: () => void;
  onSelect: (path: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [browse, setBrowse] = useState<DbBackupBrowseData | null>(null);

  async function loadBrowse(path?: string) {
    setBusy(true);
    setErr("");
    try {
      setBrowse(await fetchDbBackupBrowse(path?.trim() || null));
    } catch (e) {
      setErr(axiosErrorDetail(e));
      setBrowse(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void loadBrowse(initialPath);
  }, [open, initialPath]);

  function chooseCurrent() {
    const current = browse?.current;
    if (!current) return;
    onSelect(current);
    onClose();
  }

  const pathTail = browse?.current
    ? browse.current.split(/[/\\]/).filter(Boolean).pop() || browse.current
    : "加载中…";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        className="backup-dir-picker__dialog flex max-h-[min(92vh,640px)] w-[min(480px,96vw)] max-w-[min(480px,96vw)] gap-0 overflow-hidden bg-card p-0"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left">
          <DialogTitle id="backup-dir-picker-title">选择备份父目录</DialogTitle>
          <DialogDescription className="muted">在允许的目录范围内浏览并选择输出位置</DialogDescription>
        </DialogHeader>

        <div className="backup-dir-picker__bd min-h-0 flex-1 space-y-3 overflow-auto px-4 py-3">
          {err ? <div className="alert alert--err backup-dir-picker__alert">{err}</div> : null}
          <div
            className="backup-dir-picker__path muted backup-dir-picker__path-hover"
            title={browse?.current || ""}
          >
            {pathTail}
          </div>
          <div className="backup-dir-picker__toolbar row-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={CornerLeftUp}
              iconMotion="up"
              disabled={busy || !browse?.parent}
              onClick={() => void loadBrowse(browse?.parent || undefined)}
            >
              上一级
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Home}
              disabled={busy || !browse?.default_path}
              onClick={() => void loadBrowse(browse?.default_path || "")}
            >
              默认目录
            </Button>
          </div>
          <ul className="backup-dir-picker__list" aria-label="子目录">
            {busy && !browse?.entries?.length ? (
              <li className="backup-dir-picker__empty muted">正在读取目录…</li>
            ) : !browse?.entries?.length ? (
              <li className="backup-dir-picker__empty muted">当前目录下没有可进入的子文件夹</li>
            ) : (
              browse.entries.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    className="backup-dir-picker__item"
                    disabled={busy}
                    title={entry.path}
                    onClick={() => void loadBrowse(entry.path)}
                  >
                    <span className="backup-dir-picker__item-ico" aria-hidden="true">
                      📁
                    </span>
                    <span className="backup-dir-picker__item-name">{entry.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <DialogFooter className="backup-dir-picker__actions border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 sm:justify-end">
          <Button type="button" variant="outline" size="sm" icon={X} iconMotion="close" disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button type="button" size="sm" icon={FolderCheck} disabled={busy || !browse?.current} onClick={chooseCurrent}>
            选择此目录
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
