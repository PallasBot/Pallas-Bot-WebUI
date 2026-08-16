import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  ArrowUp,
  Braces,
  ChevronDown,
  Download,
  Eye,
  File,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  Pencil,
  Plus,
  Save,
  ScrollText,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import {
  createFileItem,
  deleteFileItem,
  downloadFileItem,
  fetchFileContent,
  fetchFileList,
  fetchImageFile,
  renameFileItem,
  uploadFileItem,
  writeFileContent,
} from "@/api/consoleApi";
import type { FilesEntry } from "@/api/pallasTypes";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal";
import PageFill from "@/components/layout/PageFill";
import PageMasthead from "@/components/PageMasthead";
import PagePinned from "@/components/layout/PagePinned";
import RefreshIconButton from "@/components/RefreshIconButton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { pushConsoleToast } from "@/utils/consoleToast";
import "./fileManager.css";

function formatBytes(value: number): string {
  if (value <= 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB"];
  let index = 0;
  let n = value;
  while (n >= 1024 && index < units.length - 1) {
    n /= 1024;
    index += 1;
  }
  return `${n.toFixed(index === 0 ? 0 : n >= 100 ? 0 : 1)} ${units[index]}`;
}

function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "avif"]);
const CODE_EXTS = new Set(["py", "js", "ts", "tsx", "jsx", "vue", "go", "rs", "c", "cpp", "sql", "sh", "html", "css"]);
const CONFIG_EXTS = new Set(["toml", "yaml", "yml", "ini", "conf", "env", "gitignore"]);
const ARCHIVE_EXTS = new Set(["zip", "7z", "rar", "tar", "gz", "xz", "bz2"]);

function fileVisual(entry: FilesEntry): { Icon: LucideIcon; color: string } {
  if (entry.is_dir) return { Icon: Folder, color: "var(--accent)" };
  const ext = entry.name.includes(".") ? entry.name.split(".").pop()!.toLowerCase() : "";
  if (IMAGE_EXTS.has(ext)) return { Icon: FileImage, color: "var(--success)" };
  if (ext === "json" || ext === "jsonl") return { Icon: Braces, color: "var(--warn)" };
  if (ext === "log") return { Icon: ScrollText, color: "var(--accent)" };
  if (CONFIG_EXTS.has(ext)) return { Icon: Settings2, color: "var(--warn)" };
  if (CODE_EXTS.has(ext)) return { Icon: FileCode2, color: "var(--accent)" };
  if (ARCHIVE_EXTS.has(ext)) return { Icon: Archive, color: "var(--warn)" };
  if (ext === "md" || ext === "txt") return { Icon: FileText, color: "var(--text-muted)" };
  return { Icon: File, color: "var(--text-muted)" };
}

export default function FileManagerPage() {
  const queryClient = useQueryClient();
  const [path, setPath] = useState("");
  const [menuChildren, setMenuChildren] = useState<Record<string, string[] | undefined>>({});
  const [editPath, setEditPath] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editOriginal, setEditOriginal] = useState("");
  const [editingBusy, setEditingBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createIsDir, setCreateIsDir] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameEntry, setRenameEntry] = useState<FilesEntry | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteEntry, setDeleteEntry] = useState<FilesEntry | null>(null);
  const [error, setError] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const listQ = useQuery({
    queryKey: ["file-manager-list", path],
    queryFn: () => fetchFileList(path),
    refetchInterval: 30_000,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["file-manager-list"] });

  const enterDir = (dirPath: string) => setPath(dirPath);

  const loadMenuChildren = async (dirPath: string) => {
    if (menuChildren[dirPath] !== undefined) return;
    try {
      const data = await fetchFileList(dirPath);
      setMenuChildren((prev) => ({
        ...prev,
        [dirPath]: data.entries.filter((entry) => entry.is_dir).map((entry) => entry.name),
      }));
    } catch {
      setMenuChildren((prev) => ({ ...prev, [dirPath]: [] }));
    }
  };

  const doDelete = async () => {
    if (!deleteEntry) return;
    try {
      await deleteFileItem(joinPath(path, deleteEntry.name));
      pushConsoleToast(`已删除 ${deleteEntry.name}`, "ok");
      setDeleteEntry(null);
      invalidate();
    } catch (cause) {
      pushConsoleToast(axiosErrorDetail(cause) || "删除失败", "err");
    }
  };

  const openEntry = async (entry: FilesEntry) => {
    if (entry.is_dir) {
      enterDir(joinPath(path, entry.name));
      return;
    }
    if (entry.is_image) {
      try {
        const blob = await fetchImageFile(joinPath(path, entry.name));
        setImageName(entry.name);
        setImageUrl(URL.createObjectURL(blob));
      } catch (cause) {
        pushConsoleToast(axiosErrorDetail(cause) || "图片预览失败", "err");
      }
      return;
    }
    try {
      const data = await fetchFileContent(joinPath(path, entry.name));
      setEditPath(joinPath(path, entry.name));
      setEditContent(data.content);
      setEditOriginal(data.content);
      setError("");
    } catch (cause) {
      pushConsoleToast(axiosErrorDetail(cause) || "无法打开文件", "err");
    }
  };

  const saveEdit = async () => {
    if (!editPath) return;
    setEditingBusy(true);
    try {
      await writeFileContent(editPath, editContent);
      pushConsoleToast("已保存", "ok");
      setEditPath(null);
    } catch (cause) {
      setError(axiosErrorDetail(cause) || "保存失败");
    } finally {
      setEditingBusy(false);
    }
  };

  const formatJson = () => {
    try {
      setEditContent(JSON.stringify(JSON.parse(editContent), null, 2));
    } catch {
      pushConsoleToast("内容不是合法 JSON", "err");
    }
  };

  const doCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    try {
      await createFileItem(path, name, createIsDir);
      pushConsoleToast(`已创建 ${createIsDir ? "文件夹" : "文件"} ${name}`, "ok");
      setCreateOpen(false);
      setCreateName("");
      invalidate();
    } catch (cause) {
      pushConsoleToast(axiosErrorDetail(cause) || "创建失败", "err");
    }
  };

  const doRename = async () => {
    if (!renameEntry) return;
    const newName = renameName.trim();
    if (!newName) return;
    try {
      await renameFileItem(joinPath(path, renameEntry.name), newName);
      pushConsoleToast("已重命名", "ok");
      setRenameEntry(null);
      invalidate();
    } catch (cause) {
      pushConsoleToast(axiosErrorDetail(cause) || "重命名失败", "err");
    }
  };

  const doUpload = async (file: File) => {
    try {
      await uploadFileItem(path, file);
      pushConsoleToast(`已上传 ${file.name}`, "ok");
      invalidate();
    } catch (cause) {
      pushConsoleToast(axiosErrorDetail(cause) || "上传失败", "err");
    }
  };

  const doDownload = async (entry: FilesEntry) => {
    try {
      const blob = await downloadFileItem(joinPath(path, entry.name));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = entry.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      pushConsoleToast(axiosErrorDetail(cause) || "下载失败", "err");
    }
  };

  const entries = listQ.data?.entries ?? [];
  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
        return a.name.localeCompare(b.name, "zh-CN");
      }),
    [entries],
  );
  const editingIsJson = editPath?.toLowerCase().endsWith(".json") === true;
  const parts = useMemo(() => (path ? path.split("/") : []), [path]);
  const segments = useMemo(() => {
    const result: { path: string; label: string }[] = [{ path: "", label: "项目根" }];
    parts.forEach((part, index) => {
      result.push({ path: parts.slice(0, index + 1).join("/"), label: part });
    });
    return result;
  }, [parts]);

  const renderCrumbMenu = (segment: { path: string; label: string }) => {
    const children = menuChildren[segment.path];
    return (
      <DropdownMenu onOpenChange={(open) => open && loadMenuChildren(segment.path)}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="file-manager__crumb-caret" aria-label={`${segment.label} 子目录`} title="子目录">
            <ChevronDown aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="file-manager__crumb-menu">
          {children === undefined ? (
            <DropdownMenuItem disabled>加载中…</DropdownMenuItem>
          ) : children.length === 0 ? (
            <DropdownMenuItem disabled>无子目录</DropdownMenuItem>
          ) : (
            children.map((name) => (
              <DropdownMenuItem key={name} onSelect={() => enterDir(joinPath(segment.path, name))}>
                <Folder aria-hidden="true" className="file-manager__crumb-menu-icon" />
                <span className="file-manager__crumb-menu-name">{name}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <PageFill className="file-manager">
      <PagePinned>
        <PageMasthead
          title="文件管理"
          description="浏览项目根目录下的文件与数据；文本可直接编辑保存。"
          actions={<RefreshIconButton busy={listQ.isFetching} label="刷新" showLabel onClick={invalidate} />}
        />
        <div className="file-manager__breadcrumb" aria-label="当前路径">
          {segments.map((segment, index) => {
            const active = index === segments.length - 1;
            return (
              <span key={segment.path} className="file-manager__crumb">
                <button
                  type="button"
                  className={cn("file-manager__crumb-link", active && "file-manager__crumb--active")}
                  onClick={() => enterDir(segment.path)}
                >
                  {segment.label}
                </button>
                {renderCrumbMenu(segment)}
              </span>
            );
          })}
        </div>
        <div className="file-manager__actions">
          <Button type="button" variant="outline" size="sm" onClick={() => enterDir(parts.slice(0, -1).join("/"))} disabled={!path} icon={ArrowUp}>
            上级
          </Button>
          <span className="file-manager__actions-sep" />
          <Button type="button" size="sm" variant="outline" icon={FolderPlus} onClick={() => { setCreateIsDir(true); setCreateName(""); setCreateOpen(true); }}>
            新建文件夹
          </Button>
          <Button type="button" size="sm" variant="outline" icon={Plus} onClick={() => { setCreateIsDir(false); setCreateName(""); setCreateOpen(true); }}>
            新建文件
          </Button>
          <Button type="button" size="sm" icon={Upload} onClick={() => uploadInputRef.current?.click()}>
            上传
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            className="file-manager__hidden-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void doUpload(file);
              event.target.value = "";
            }}
          />
        </div>
      </PagePinned>

      {error ? <div className="alert alert--err">{error}</div> : null}
      {listQ.isLoading ? (
        <p className="muted">正在读取目录…</p>
      ) : (
        <div className="file-manager__list">
          {sortedEntries.map((entry) => {
            const { Icon, color } = fileVisual(entry);
            return (
              <div
                key={entry.name}
                className="file-manager__item"
                onClick={() => void openEntry(entry)}
              >
                <span className="file-manager__item-icon" style={{ color }}>
                  <Icon aria-hidden="true" />
                </span>
                <span className="file-manager__item-name" title={entry.name}>{entry.name}</span>
                <span className="file-manager__item-size">{entry.is_dir ? "" : formatBytes(entry.size)}</span>
                <span className="file-manager__item-mtime">
                  {new Date(entry.mtime * 1000).toLocaleString("zh-CN", { hour12: false })}
                </span>
                <span className="file-manager__item-actions" onClick={(event) => event.stopPropagation()}>
                  {entry.is_image ? (
                    <Button type="button" size="icon" variant="ghost" title="预览" onClick={() => void openEntry(entry)}>
                      <Eye aria-hidden="true" />
                    </Button>
                  ) : null}
                  {!entry.is_dir ? (
                    <Button type="button" size="icon" variant="ghost" title="下载" onClick={() => void doDownload(entry)}>
                      <Download aria-hidden="true" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="重命名"
                    onClick={() => { setRenameEntry(entry); setRenameName(entry.name); }}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" title="删除" onClick={() => setDeleteEntry(entry)}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </span>
              </div>
            );
          })}
          {sortedEntries.length === 0 ? <p className="muted file-manager__empty">目录为空</p> : null}
        </div>
      )}

      <Dialog open={Boolean(editPath)} onOpenChange={(open) => !open && setEditPath(null)}>
        <DialogContent className="file-manager__edit-dialog gap-0 overflow-hidden bg-card p-0">
          <DialogHeader className="border-b px-4 py-3 text-left">
            <DialogTitle>编辑文件</DialogTitle>
            <p className="muted m-0 text-sm break-all">{editPath}</p>
          </DialogHeader>
          {editPath ? (
            <div className="file-manager__edit-body">
              <textarea
                className="file-manager__editor"
                value={editContent}
                onChange={(event) => setEditContent(event.target.value)}
                spellCheck={false}
              />
              {error ? <p className="alert alert--err m-0">{error}</p> : null}
              <div className="file-manager__edit-actions">
                {editingIsJson ? (
                  <Button type="button" variant="outline" icon={Braces} onClick={formatJson}>
                    格式化 JSON
                  </Button>
                ) : null}
                <span className="file-manager__edit-actions-spacer" />
                {editContent !== editOriginal ? (
                  <Button type="button" variant="outline" onClick={() => setEditContent(editOriginal)}>
                    撤销修改
                  </Button>
                ) : null}
                <Button type="button" icon={Save} onClick={() => void saveEdit()} disabled={editingBusy}>
                  {editingBusy ? "保存中…" : "保存"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(imageUrl)} onOpenChange={(open) => !open && setImageUrl(null)}>
        <DialogContent className="file-manager__image-dialog gap-0 overflow-hidden bg-card p-0">
          <DialogHeader className="border-b px-4 py-3 text-left">
            <DialogTitle>图片预览</DialogTitle>
            <p className="muted m-0 text-sm break-all">{imageName}</p>
          </DialogHeader>
          <div className="file-manager__image-body">
            {imageUrl ? <img src={imageUrl} alt={imageName} /> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
        <DialogContent className="file-manager__small-dialog gap-0 overflow-hidden bg-card p-0">
          <DialogHeader className="border-b px-4 py-3 text-left">
            <DialogTitle>{createIsDir ? "新建文件夹" : "新建文件"}</DialogTitle>
            <p className="muted m-0 text-sm break-all">{path || "项目根"}</p>
          </DialogHeader>
          <div className="file-manager__small-body">
            <Input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder={createIsDir ? "文件夹名" : "文件名"} autoFocus />
            <div className="file-manager__edit-actions">
              <span className="file-manager__edit-actions-spacer" />
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button type="button" onClick={() => void doCreate()} disabled={!createName.trim()}>创建</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameEntry)} onOpenChange={(open) => !open && setRenameEntry(null)}>
        <DialogContent className="file-manager__small-dialog gap-0 overflow-hidden bg-card p-0">
          <DialogHeader className="border-b px-4 py-3 text-left">
            <DialogTitle>重命名</DialogTitle>
            <p className="muted m-0 text-sm break-all">{path || "项目根"}</p>
          </DialogHeader>
          <div className="file-manager__small-body">
            <Input value={renameName} onChange={(event) => setRenameName(event.target.value)} placeholder="新名称" autoFocus />
            <div className="file-manager__edit-actions">
              <span className="file-manager__edit-actions-spacer" />
              <Button type="button" variant="outline" onClick={() => setRenameEntry(null)}>取消</Button>
              <Button type="button" onClick={() => void doRename()} disabled={!renameName.trim()}>重命名</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConsoleDeleteConfirmModal
        open={Boolean(deleteEntry)}
        title={`删除${deleteEntry?.is_dir ? "文件夹" : "文件"}`}
        subtitle={deleteEntry?.is_dir ? "文件夹及其全部内容将被永久删除，操作不可逆。" : "文件将被永久删除，操作不可逆。"}
        items={[{ key: deleteEntry?.name ?? "", label: deleteEntry?.name ?? "" }]}
        warnings={["删除操作不可撤销，请确认路径无误。"]}
        onClose={() => setDeleteEntry(null)}
        onConfirm={() => void doDelete()}
      />
    </PageFill>
  );
}
