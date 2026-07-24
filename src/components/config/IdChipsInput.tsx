import TagsInput from "@/components/config/TagsInput";
import { cn } from "@/lib/utils";

type Props = {
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** embedded：与 AI 配置 TagsInput 一致（+更多 / 行内芯片 / +N）；stacked：芯片在上+输入框 */
  variant?: "stacked" | "embedded";
  emptyText?: string;
  errorText?: string;
};

function toTags(ids: number[]): string[] {
  return (ids ?? [])
    .filter((n) => Number.isFinite(n) && n >= 1)
    .map((n) => String(Math.trunc(n)));
}

function fromTags(tags: string[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const tag of tags) {
    const n = parseInt(String(tag).trim(), 10);
    if (!Number.isFinite(n) || n < 1 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out.sort((a, b) => a - b);
}

/** QQ / 群号等数字 ID 芯片；视觉对齐 AI 配置的 TagsInput embedded。 */
export default function IdChipsInput({
  value,
  onChange,
  placeholder = "输入号码后回车添加…",
  disabled = false,
  className,
  variant = "embedded",
  emptyText,
  errorText,
}: Props) {
  const tags = toTags(value);

  return (
    <div className={cn("id-chips-input space-y-1.5", className)}>
      <TagsInput
        variant={variant}
        value={tags}
        onChange={(next) => onChange(fromTags(next))}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="numeric"
        acceptPattern={/^\d+$/}
      />
      {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}
      {!errorText && emptyText && !tags.length ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : null}
    </div>
  );
}
