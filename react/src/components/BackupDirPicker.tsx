import { useEffect, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { fetchDbBackupBrowse } from "@/api/fullConsole";
import type { DbBackupBrowseData } from "@pallas-vue/api/pallasTypes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="backup-dir-picker__dialog max-w-lg">
        <DialogHeader>
          <DialogTitle id="backup-dir-picker-title">选择备份父目录</DialogTitle>
          <p className="muted text-sm">在允许的目录范围内浏览并选择输出位置</p>
        </DialogHeader>
        <div className="backup-dir-picker__bd">
          {err ? <div className="alert alert--err backup-dir-picker__alert">{err}</div> : null}
          <div className="backup-dir-picker__path muted backup-dir-picker__path-hover" title={browse?.current || ""}>
            {pathTail}
          </div>
          <div className="backup-dir-picker__toolbar row-actions">
            <button type="button" className="btn" disabled={busy || !browse?.parent} onClick={() => void loadBrowse(browse?.parent || undefined)}>
              上一级
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || !browse?.default_path}
              onClick={() => void loadBrowse(browse?.default_path || "")}
            >
              默认目录
            </button>
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
          <div className="row-actions backup-dir-picker__actions">
            <button type="button" className="btn" disabled={busy} onClick={onClose}>
              取消
            </button>
            <button type="button" className="btn btn--primary" disabled={busy || !browse?.current} onClick={chooseCurrent}>
              选择此目录
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
