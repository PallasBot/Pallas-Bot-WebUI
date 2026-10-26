import { useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type SegTabOption = {
  value: string;
  label: string;
  className?: string;
};

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SegTabOption[];
  ariaLabel?: string;
  className?: string;
  /** 透传给 TabsList（宽度 / 布局等） */
  listClassName?: string;
  /** 占满容器宽度，Trigger 均分（原 console-view-toggle--full） */
  full?: boolean;
  /** 与 default 相同；保留以免调用处改动 */
  size?: "default" | "toolbar";
  disabled?: boolean;
  /**
   * muted：配置/表单分段（默认，中性选中）。
   * accent：页面内容分段；纯色下选中跟主题色，与表单 Tabs 区分。
   */
  tone?: "muted" | "accent";
};

/**
 * 分段 Tabs（TabsList + TabsTrigger）。
 * default：h-10 + p-1；toolbar：与 chrome 控件同高 h-9，避免撑高工具条。
 */
export default function SegTabs({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  listClassName,
  full = false,
  size = "default",
  disabled = false,
  tone = "muted",
}: Props) {
  const toolbar = size === "toolbar";
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;

    const updateIndicator = () => {
      const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!active) {
        delete indicator.dataset.ready;
        return;
      }
      const listRect = list.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      indicator.style.left = `${activeRect.left - listRect.left}px`;
      indicator.style.top = `${activeRect.top - listRect.top}px`;
      indicator.style.width = `${activeRect.width}px`;
      indicator.style.height = `${activeRect.height}px`;
      indicator.dataset.ready = "true";
    };

    updateIndicator();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateIndicator);
    observer?.observe(list);
    list.querySelectorAll<HTMLElement>('[role="tab"]').forEach((tab) => observer?.observe(tab));
    window.addEventListener("resize", updateIndicator);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [options, value]);

  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className={cn("shrink-0", full && "w-full max-w-full", className)}
    >
      <TabsList
        aria-label={ariaLabel}
        ref={listRef}
        className={cn(
          "seg-tabs__list relative",
          tone === "accent" && "seg-tabs--accent",
          toolbar && "h-9 p-0.5",
          full && (toolbar ? "flex h-9 w-full" : "flex h-10 w-full"),
          listClassName,
        )}
      >
        <span ref={indicatorRef} className="seg-tabs__indicator" aria-hidden />
        {options.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            disabled={disabled}
            className={cn("relative z-[1]", full && "flex-1", toolbar && "px-2.5 py-1", opt.className)}
          >
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
