import DatePicker from "@/components/DatePicker";
import SegTabs from "@/components/SegTabs";
import { cn } from "@/lib/utils";

export type DateMode = "single" | "range";

type Props = {
  mode: DateMode;
  onModeChange: (mode: DateMode) => void;
  /** yyyy-MM-dd */
  start: string;
  end: string;
  onStartChange: (iso: string) => void;
  onEndChange: (iso: string) => void;
  className?: string;
  /** toolbar：对齐 ChromeTools h-9 */
  size?: "default" | "toolbar";
  disabled?: boolean;
  /** 日历禁选：无数据日等 */
  isDayDisabled?: (iso: string) => boolean;
};

/**
 * 日期模式筛选：SegTabs + DatePicker（工具条内 h-9）。
 */
export default function DateModeFilter({
  mode,
  onModeChange,
  start,
  end,
  onStartChange,
  onEndChange,
  className,
  size = "default",
  disabled = false,
  isDayDisabled,
}: Props) {
  const toolbar = size === "toolbar";

  function handleModeChange(next: string) {
    const m = next === "range" ? "range" : "single";
    if (m === "single") {
      const day = end || start;
      if (day) {
        onStartChange(day);
        onEndChange(day);
      }
    } else if (!start && end) {
      onStartChange(end);
    }
    onModeChange(m);
  }

  function handleSingleChange(iso: string) {
    onStartChange(iso);
    onEndChange(iso);
  }

  const fieldH = toolbar
    ? "h-[var(--chrome-field-h,36px)] min-h-[var(--chrome-field-h,36px)]"
    : undefined;

  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-4",
        toolbar ? "shrink-0 flex-nowrap" : "min-w-0 flex-wrap",
        className,
      )}
    >
      <SegTabs
        size={size}
        ariaLabel="日期模式"
        value={mode}
        onValueChange={handleModeChange}
        disabled={disabled}
        options={[
          { value: "single", label: "单日期" },
          { value: "range", label: "日期范围" },
        ]}
      />

      {mode === "single" ? (
        <DatePicker
          value={start || end}
          onValueChange={handleSingleChange}
          ariaLabel="选择日期"
          placeholder="选择日期"
          disabled={disabled}
          isDayDisabled={isDayDisabled}
          className={cn(fieldH, toolbar && "min-w-[10.5rem] shrink-0")}
        />
      ) : (
        <div className={cn("flex min-w-0 items-center gap-2", toolbar ? "shrink-0 flex-nowrap" : "flex-wrap")}>
          <DatePicker
            value={start}
            onValueChange={onStartChange}
            ariaLabel="开始日期"
            placeholder="开始日期"
            disabled={disabled}
            isDayDisabled={isDayDisabled}
            className={cn(fieldH, toolbar && "min-w-[9.5rem] shrink-0")}
          />
          <span className="shrink-0 text-muted-foreground" aria-hidden>
            ~
          </span>
          <DatePicker
            value={end}
            onValueChange={onEndChange}
            ariaLabel="结束日期"
            placeholder="结束日期"
            disabled={disabled}
            isDayDisabled={isDayDisabled}
            className={cn(fieldH, toolbar && "min-w-[9.5rem] shrink-0")}
          />
        </div>
      )}
    </div>
  );
}
