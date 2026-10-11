import { Tabs } from "@heroui/react";
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
 * HeroUI Tabs 的轻量兼容封装，保留旧调用参数。
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

  return (
    <Tabs
      selectedKey={value}
      onSelectionChange={(key) => onValueChange(String(key))}
      data-tone={tone}
      className={cn("shrink-0", full && "w-full max-w-full", className)}
    >
      <Tabs.ListContainer className={full ? "w-full max-w-full" : "w-fit max-w-full"}>
        <Tabs.List
          aria-label={ariaLabel}
          className={cn(
            "min-w-0 whitespace-nowrap",
            toolbar && "h-9",
            full && (toolbar ? "flex h-9 w-full" : "flex h-10 w-full"),
            listClassName,
          )}
        >
          {options.map((opt) => (
            <Tabs.Tab
              key={opt.value}
              id={opt.value}
              isDisabled={disabled}
              className={cn(full && "flex-1", toolbar && "px-2.5 py-1", opt.className)}
            >
              {opt.label}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
