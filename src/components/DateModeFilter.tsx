import { format, parse, isValid, addDays } from "date-fns";
import DatePicker from "@/components/DatePicker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
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

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function shiftIso(iso: string, delta: number): string {
  const d = parse(iso.slice(0, 10), "yyyy-MM-dd", new Date());
  if (!isValid(d)) return iso;
  return format(addDays(d, delta), "yyyy-MM-dd");
}

/**
 * 起止日期筛选（同一天即单日）；工具条可带今日 / 7 天快捷。
 */
export default function DateModeFilter({
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
  const fieldH = toolbar
    ? "h-[var(--chrome-field-h,36px)] min-h-[var(--chrome-field-h,36px)]"
    : undefined;
  const today = todayIso();
  const isToday = start === today && end === today;
  const sevenStart = shiftIso(today, -6);
  const is7d = start === sevenStart && end === today;

  function handleStartChange(iso: string) {
    onStartChange(iso);
    if (end && iso > end) onEndChange(iso);
  }

  function handleEndChange(iso: string) {
    onEndChange(iso);
    if (start && iso < start) onStartChange(iso);
  }

  function setRange(nextStart: string, nextEnd: string) {
    onStartChange(nextStart);
    onEndChange(nextEnd);
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        toolbar ? "shrink-0 flex-nowrap" : "flex-wrap",
        className,
      )}
    >
      <DatePicker
        value={start}
        onValueChange={handleStartChange}
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
        onValueChange={handleEndChange}
        ariaLabel="结束日期"
        placeholder="结束日期"
        disabled={disabled}
        isDayDisabled={isDayDisabled}
        className={cn(fieldH, toolbar && "min-w-[9.5rem] shrink-0")}
      />
      <div className={cn("flex shrink-0 items-center gap-1.5", toolbar && "pl-0.5")}>
        <Button
          type="button"
          variant={isToday ? "default" : "outline"}
          size="sm"
          disabled={disabled}
          className={cn(fieldH, "px-2.5")}
          onClick={() => setRange(today, today)}
        >
          今日
        </Button>
        <Button
          type="button"
          variant={is7d ? "default" : "outline"}
          size="sm"
          disabled={disabled}
          className={cn(fieldH, "px-2.5")}
          onClick={() => setRange(sevenStart, today)}
        >
          7天
        </Button>
      </div>
    </div>
  );
}
