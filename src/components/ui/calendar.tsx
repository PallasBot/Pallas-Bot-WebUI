import { Calendar as HeroCalendar } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { CalendarDate as makeCalendarDate } from "@internationalized/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = {
  className?: string;
  selected?: Date;
  defaultMonth?: Date;
  disabled?: (date: Date) => boolean;
  onSelect?: (date: Date | undefined) => void;
  initialFocus?: boolean;
};

function toCalendarDate(date?: Date): CalendarDate | undefined {
  return date && Number.isFinite(date.getTime())
    ? new makeCalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
    : undefined;
}

function toLocalDate(date: CalendarDate): Date {
  const result = new Date(0);
  result.setFullYear(date.year, date.month - 1, date.day);
  result.setHours(12, 0, 0, 0);
  return result;
}

function Calendar({ className, selected, defaultMonth, disabled, onSelect }: CalendarProps) {
  const selectedDate = toCalendarDate(selected);
  const initialDate = selectedDate ?? toCalendarDate(defaultMonth);
  return (
    <HeroCalendar
      aria-label="选择日期"
      value={selectedDate}
      defaultValue={initialDate}
      isDateUnavailable={disabled ? (date) => disabled(toLocalDate(date as CalendarDate)) : undefined}
      onChange={(date) => onSelect?.(toLocalDate(date))}
      className={cn("p-3", className)}
    >
      <HeroCalendar.Header className="flex items-center justify-between gap-2">
        <HeroCalendar.NavButton slot="previous" aria-label="上个月"><ChevronLeft className="size-4" /></HeroCalendar.NavButton>
        <HeroCalendar.Heading />
        <HeroCalendar.NavButton slot="next" aria-label="下个月"><ChevronRight className="size-4" /></HeroCalendar.NavButton>
      </HeroCalendar.Header>
      <HeroCalendar.Grid>
        <HeroCalendar.GridHeader>{(day) => <HeroCalendar.HeaderCell>{day}</HeroCalendar.HeaderCell>}</HeroCalendar.GridHeader>
        <HeroCalendar.GridBody>{(date) => <HeroCalendar.Cell date={date} />}</HeroCalendar.GridBody>
      </HeroCalendar.Grid>
    </HeroCalendar>
  );
}

Calendar.displayName = "Calendar";
export { Calendar, toCalendarDate, toLocalDate };
