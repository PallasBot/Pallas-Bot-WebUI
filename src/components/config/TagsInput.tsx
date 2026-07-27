import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type DragEvent,
  type HTMLAttributes,
} from "react";
import { Check, Copy, GripVertical, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import "@/styles/tags-input.css";

export type TagsInputHandle = {
  /** 把输入框未回车的草稿一并提交，返回最新标签列表 */
  flush: () => string[];
};

export type TagsInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** stacked：芯片在上；embedded：单框 +「更多」 */
  variant?: "stacked" | "embedded";
  options?: string[];
  className?: string;
  /** 如 QQ/群号：numeric */
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  /** 提交前校验；不匹配则忽略 */
  acceptPattern?: RegExp;
  /** 允许拖拽改序（壳上芯片与「更多」列表） */
  sortable?: boolean;
  /** 第一项显示「主用」标记（常与 sortable 同开） */
  showPrimaryBadge?: boolean;
};

function truncateToWidth(text: string, maxWidth = 10): string {
  const chineseRegex = /[\u4e00-\u9fa5]/g;
  const chineseCount = (text.match(chineseRegex) || []).length;
  const otherCount = text.length - chineseCount;
  const totalWidth = chineseCount + otherCount * 0.5;
  if (totalWidth <= maxWidth) return text;
  let result = "";
  let currentWidth = 0;
  for (const char of text) {
    const charWidth = /[\u4e00-\u9fa5]/.test(char) ? 1 : 0.5;
    if (currentWidth + charWidth > maxWidth) break;
    result += char;
    currentWidth += charWidth;
  }
  return `${result}...`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function reorderList(list: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const TagsInput = forwardRef<TagsInputHandle, TagsInputProps>(function TagsInput(
  {
    value,
    onChange,
    placeholder = "输入后回车添加…",
    disabled = false,
    variant = "stacked",
    options,
    className,
    inputMode,
    acceptPattern,
    sortable = false,
    showPrimaryBadge = false,
  },
  ref,
) {
  const list = Array.isArray(value) ? value : [];
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [shellWidth, setShellWidth] = useState(240);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const popoverInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef(list);
  const draftRef = useRef(draft);
  const searchRef = useRef(searchQuery);
  const onChangeRef = useRef(onChange);
  const acceptRef = useRef(acceptPattern);
  const disabledRef = useRef(disabled);

  listRef.current = list;
  draftRef.current = draft;
  searchRef.current = searchQuery;
  onChangeRef.current = onChange;
  acceptRef.current = acceptPattern;
  disabledRef.current = disabled;

  const isEmbedded = variant === "embedded";
  const canReorder = sortable && !disabled;
  const popoverReorderable = canReorder && !searchQuery.trim();

  const TAG_SLOT = showPrimaryBadge ? 108 : 88;
  const MORE_SLOT = 88;
  const PAD = 20;
  const maxVisibleTags = useMemo(() => {
    if (!isEmbedded) return list.length;
    const available = Math.max(0, shellWidth - MORE_SLOT - PAD);
    return Math.max(0, Math.floor(available / TAG_SLOT));
  }, [isEmbedded, list.length, shellWidth, TAG_SLOT]);

  const visibleTags = isEmbedded ? list.slice(0, maxVisibleTags) : list;
  const hiddenCount = isEmbedded ? Math.max(0, list.length - maxVisibleTags) : 0;

  const filteredAdded = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((tag) => tag.toLowerCase().includes(q));
  }, [list, searchQuery]);

  const filteredOptions = useMemo(() => {
    const opts = options ?? [];
    const q = searchQuery.trim().toLowerCase();
    return opts.filter((opt) => !list.includes(opt) && (!q || opt.toLowerCase().includes(q)));
  }, [options, list, searchQuery]);

  const canAddFromSearch = Boolean(searchQuery.trim()) && !list.includes(searchQuery.trim());

  function commitInto(current: string[], raw: string): string[] {
    const next = raw.trim();
    if (!next || current.includes(next) || disabledRef.current) return current;
    const pattern = acceptRef.current;
    if (pattern && !pattern.test(next)) return current;
    return [...current, next];
  }

  function commitTag(raw: string) {
    const next = commitInto(list, raw);
    if (next !== list) onChange(next);
  }

  function commitDraft() {
    commitTag(draft);
    setDraft("");
  }

  function flushPending(): string[] {
    let next = listRef.current;
    next = commitInto(next, draftRef.current);
    next = commitInto(next, searchRef.current);
    setDraft("");
    setSearchQuery("");
    if (next !== listRef.current) {
      listRef.current = next;
      onChangeRef.current(next);
    }
    return next;
  }

  useImperativeHandle(ref, () => ({ flush: flushPending }), []);

  function removeAt(index: number) {
    if (disabled) return;
    onChange(list.filter((_, i) => i !== index));
  }

  function removeTag(tag: string) {
    const index = list.indexOf(tag);
    if (index >= 0) removeAt(index);
  }

  async function handleCopy(text: string, index: number) {
    const ok = await copyText(text);
    if (!ok) return;
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 1500);
  }

  function clearDragState() {
    setDragFrom(null);
    setDragOver(null);
  }

  function onChipDragStart(index: number, e: DragEvent) {
    if (!canReorder) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    setDragFrom(index);
  }

  function onChipDragOver(index: number, e: DragEvent) {
    if (!canReorder || dragFrom === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== index) setDragOver(index);
  }

  function onChipDrop(index: number, e: DragEvent) {
    if (!canReorder) return;
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    const from = Number.parseInt(raw || String(dragFrom ?? ""), 10);
    clearDragState();
    if (!Number.isFinite(from)) return;
    const next = reorderList(list, from, index);
    if (next !== list) onChange(next);
  }

  function onMoreOpenChange(open: boolean) {
    if (!open) {
      // 关闭「更多」时把未回车草稿一并提交，避免点保存前关掉弹层丢密钥
      const pending = searchQuery.trim();
      if (pending) {
        commitTag(pending);
        setSearchQuery("");
      }
      clearDragState();
    }
    setMoreOpen(open);
    if (open) {
      setSearchQuery("");
      window.setTimeout(() => popoverInputRef.current?.focus(), 0);
    }
  }

  useEffect(() => {
    const el = shellRef.current;
    if (!el || !isEmbedded) return;
    const measure = () => setShellWidth(el.offsetWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isEmbedded, list.length]);

  function primaryBadge(index: number) {
    if (!showPrimaryBadge || index !== 0 || list.length < 2) return null;
    return <span className="tags-input__primary-badge">主用</span>;
  }

  if (!isEmbedded) {
    return (
      <div className={cn("tags-input tags-input--stacked", disabled && "tags-input--disabled", className)}>
        {list.length ? (
          <div className="tags-input__chips">
            {list.map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className={cn(
                  "tags-input__chip",
                  canReorder && "tags-input__chip--sortable",
                  dragFrom === index && "tags-input__chip--dragging",
                  dragOver === index && dragFrom !== index && "tags-input__chip--drag-over",
                )}
                draggable={canReorder}
                onDragStart={(e) => onChipDragStart(index, e)}
                onDragOver={(e) => onChipDragOver(index, e)}
                onDrop={(e) => onChipDrop(index, e)}
                onDragEnd={clearDragState}
              >
                {primaryBadge(index)}
                <span className="tags-input__chip-text">{tag}</span>
                <button
                  type="button"
                  className="tags-input__embed-chip-rm"
                  aria-label={`移除 ${tag}`}
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <Input
          className="tags-input__field"
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
              return;
            }
            if (e.key === "Backspace" && !draft && list.length) {
              removeAt(list.length - 1);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("tags-input tags-input--embedded", disabled && "tags-input--disabled", className)}>
      <Popover open={moreOpen} onOpenChange={onMoreOpenChange}>
        <div ref={shellRef} className="tags-input__shell">
          <PopoverTrigger asChild>
            <button
              type="button"
              className="tags-input__more-btn"
              disabled={disabled}
              aria-expanded={moreOpen}
            >
              <Plus className="size-3" aria-hidden="true" />
              更多
            </button>
          </PopoverTrigger>
          <div className="tags-input__shell-chips">
            {visibleTags.map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className={cn(
                  "tags-input__embed-chip",
                  canReorder && "tags-input__embed-chip--sortable",
                  dragFrom === index && "tags-input__embed-chip--dragging",
                  dragOver === index && dragFrom !== index && "tags-input__embed-chip--drag-over",
                )}
                draggable={canReorder}
                onDragStart={(e) => onChipDragStart(index, e)}
                onDragOver={(e) => onChipDragOver(index, e)}
                onDrop={(e) => onChipDrop(index, e)}
                onDragEnd={clearDragState}
                title={canReorder ? `${tag}（拖拽调整顺序）` : tag}
              >
                {primaryBadge(index)}
                <span className="tags-input__embed-chip-text" title={tag}>
                  {truncateToWidth(tag, showPrimaryBadge && index === 0 && list.length > 1 ? 7 : 10)}
                </span>
                <button
                  type="button"
                  className="tags-input__embed-chip-rm"
                  aria-label={`移除 ${tag}`}
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ×
                </button>
              </span>
            ))}
            {hiddenCount > 0 ? (
              <button
                type="button"
                className="tags-input__embed-more-count"
                disabled={disabled}
                title={`还有 ${hiddenCount} 项，点击查看全部`}
                aria-label={`还有 ${hiddenCount} 项，点击查看全部`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMoreOpenChange(true);
                }}
              >
                +{hiddenCount}
              </button>
            ) : null}
          </div>
        </div>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="tags-input__popover-panel w-[min(22rem,calc(100vw-2rem))] p-0"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            popoverInputRef.current?.focus();
          }}
          // Dialog 的 RemoveScroll 在 document 上拦 wheel；Portal 在锁外会被 preventDefault，导致列表滚不动
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="tags-input__popover-search">
            <Input
              ref={popoverInputRef}
              className="tags-input__popover-input"
              type="text"
              inputMode={inputMode}
              autoComplete="off"
              value={searchQuery}
              placeholder={canAddFromSearch ? "回车添加" : "搜索已添加…"}
              disabled={disabled}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAddFromSearch) {
                  e.preventDefault();
                  commitTag(searchQuery);
                  setSearchQuery("");
                }
              }}
            />
            {sortable ? (
              <p className="tags-input__popover-hint">
                {searchQuery.trim()
                  ? "搜索中不可排序；清空搜索后可拖拽调整顺序"
                  : "拖拽调整顺序；第一项为主用密钥"}
              </p>
            ) : null}
          </div>
          <div className="tags-input__popover-body">
            <div className="tags-input__popover-section">
              <div className="tags-input__popover-hd">
                已添加（{filteredAdded.length}/{list.length}）
              </div>
              {!filteredAdded.length ? (
                <div className="tags-input__popover-empty">{searchQuery.trim() ? "无匹配项" : "暂无标签"}</div>
              ) : (
                <ul className="tags-input__popover-list">
                  {filteredAdded.map((tag) => {
                    const originalIndex = list.indexOf(tag);
                    return (
                      <li
                        key={tag}
                        className={cn(
                          "tags-input__popover-row group",
                          popoverReorderable && "tags-input__popover-row--sortable",
                          dragFrom === originalIndex && "tags-input__popover-row--dragging",
                          dragOver === originalIndex &&
                            dragFrom !== originalIndex &&
                            "tags-input__popover-row--drag-over",
                        )}
                        draggable={popoverReorderable}
                        onDragStart={(e) => onChipDragStart(originalIndex, e)}
                        onDragOver={(e) => onChipDragOver(originalIndex, e)}
                        onDrop={(e) => onChipDrop(originalIndex, e)}
                        onDragEnd={clearDragState}
                      >
                        {popoverReorderable ? (
                          <GripVertical
                            className="tags-input__popover-grip size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                        ) : null}
                        {primaryBadge(originalIndex)}
                        <span className="tags-input__popover-row-text" title={tag}>
                          {tag}
                        </span>
                        <button
                          type="button"
                          className="tags-input__popover-icon-btn"
                          disabled={disabled}
                          title="复制"
                          aria-label={`复制 ${tag}`}
                          onClick={() => void handleCopy(tag, originalIndex)}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {copiedIndex === originalIndex ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="tags-input__popover-icon-btn tags-input__popover-icon-btn--danger"
                          disabled={disabled}
                          title="删除"
                          aria-label={`移除 ${tag}`}
                          onClick={() => removeTag(tag)}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {(options?.length ?? 0) > 0 ? (
              <div className="tags-input__popover-section">
                <div className="tags-input__popover-hd">可选</div>
                {!filteredOptions.length ? (
                  <div className="tags-input__popover-empty">
                    {searchQuery.trim() ? "无匹配选项" : "已全部添加"}
                  </div>
                ) : (
                  <ul className="tags-input__popover-list">
                    {filteredOptions.map((opt) => (
                      <li key={opt}>
                        <button
                          type="button"
                          className="tags-input__popover-opt"
                          disabled={disabled}
                          onClick={() => {
                            commitTag(opt);
                            setSearchQuery("");
                          }}
                        >
                          {opt}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

export default TagsInput;
