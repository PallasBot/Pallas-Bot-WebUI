import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { Check, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import {
  protocolApiErrorMessage,
  protocolListDockerImages,
  type ProtocolDockerImageRow,
} from "@/api/protocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function normalizeDockerImages(raw: unknown): ProtocolDockerImageRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    if (typeof item === "string") {
      const name = item.trim();
      return name ? { name } : { name: `<unknown-${index}>` };
    }
    if (item && typeof item === "object") {
      const row = item as ProtocolDockerImageRow;
      return {
        name: String(row.name ?? "").trim() || undefined,
        id: row.id != null ? String(row.id) : undefined,
        created_since: row.created_since != null ? String(row.created_since) : undefined,
        size: row.size != null ? String(row.size) : undefined,
      };
    }
    return { name: `<unknown-${index}>` };
  });
}

/** NapCat / SnowLuma Docker 镜像：浮层可手输，或选本地已有镜像。 */
export default function ProtocolDockerImageSelect({
  mountUrl,
  protocol,
  value,
  onValueChange,
  placeholder = "选择或输入镜像",
  inputPlaceholder = "输入镜像名，Enter 确认",
  disabled = false,
  className,
  id,
}: {
  mountUrl: string | null | undefined;
  protocol: "napcat" | "snowluma";
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  inputPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState<ProtocolDockerImageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadedOnceRef = useRef(false);

  const safeValue = (value || "").trim();
  const lower = draft.trim().toLowerCase();

  const filtered = useMemo(() => {
    const names = images
      .map((img) => String(img.name ?? "").trim())
      .filter(Boolean);
    const uniq = [...new Set(names)];
    if (!lower) return uniq;
    return uniq.filter((name) => name.toLowerCase().includes(lower));
  }, [images, lower]);

  const imageMeta = useMemo(() => {
    const map = new Map<string, ProtocolDockerImageRow>();
    for (const img of images) {
      const name = String(img.name ?? "").trim();
      if (name && !map.has(name)) map.set(name, img);
    }
    return map;
  }, [images]);

  const loadImages = useCallback(async () => {
    if (!mountUrl) {
      setListError("协议 API 未就绪");
      setImages([]);
      return;
    }
    setLoading(true);
    setListError(null);
    try {
      const res = await protocolListDockerImages(mountUrl, protocol);
      setImages(normalizeDockerImages(res.images));
      if (!res.ok && res.detail) setListError(res.detail);
    } catch (e) {
      setImages([]);
      setListError(protocolApiErrorMessage(e, "查询本地镜像失败"));
    } finally {
      setLoading(false);
    }
  }, [mountUrl, protocol]);

  useEffect(() => {
    if (!open) {
      setDraft("");
      loadedOnceRef.current = false;
      return;
    }
    setDraft(safeValue);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    if (!loadedOnceRef.current) {
      loadedOnceRef.current = true;
      void loadImages();
    }
  }, [open, safeValue, loadImages]);

  const commit = useCallback(
    (next: string) => {
      onValueChange(next.trim());
      setOpen(false);
    },
    [onValueChange],
  );

  const commitDraft = useCallback(() => {
    commit(draft);
  }, [commit, draft]);

  // Dialog RemoveScroll 在 document 捕获阶段对 Portal 外节点 preventDefault，原生滚动失效，需手写 scrollTop。
  const onListWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const el = e.currentTarget;
    if (el.scrollHeight <= el.clientHeight) return;
    el.scrollTop += e.deltaY;
  }, []);

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Docker 镜像"
          disabled={disabled || !mountUrl}
          className={cn("h-9 w-full justify-between px-3 font-normal", className)}
        >
          <span className={cn("min-w-0 flex-1 truncate text-left", !safeValue && "text-muted-foreground")}>
            {safeValue || placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="flex w-[var(--radix-popover-trigger-width)] min-w-[min(22rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b p-2">
          <Input
            ref={inputRef}
            value={draft}
            disabled={disabled}
            placeholder={inputPlaceholder}
            className="h-9"
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              }
            }}
          />
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            可直接输入完整镜像名，或从下方本地列表选择。
          </p>
        </div>
        <div className="h-[220px] shrink-0 overflow-hidden">
          <div
            className="h-full overflow-y-auto overscroll-contain py-1"
            onWheel={onListWheel}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                正在读取本地镜像…
              </div>
            ) : listError ? (
              <div className="space-y-2 px-3 py-3">
                <p className="text-sm text-destructive">{listError}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon={RefreshCw}
                  iconMotion="spin"
                  iconBusy={loading}
                  onClick={() => void loadImages()}
                >
                  重试
                </Button>
              </div>
            ) : !filtered.length ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                {draft.trim() ? "无匹配本地镜像，Enter 使用当前输入" : "本地暂无匹配镜像"}
              </p>
            ) : (
              filtered.map((name) => {
                const selected = safeValue === name;
                const meta = imageMeta.get(name);
                const hint = [meta?.size, meta?.created_since].filter(Boolean).join(" · ");
                return (
                  <button
                    key={name}
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                      selected && "bg-accent",
                    )}
                    onClick={() => commit(name)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{name}</span>
                      {hint ? (
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {hint}
                        </span>
                      ) : null}
                    </span>
                    {selected ? <Check className="mt-0.5 size-3.5 shrink-0 text-primary" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
        {draft.trim() && draft.trim() !== safeValue ? (
          <div className="shrink-0 border-t p-2">
            <Button type="button" size="sm" className="w-full" icon={Check} iconMotion="scale" onClick={commitDraft}>
              使用「{draft.trim()}」
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
