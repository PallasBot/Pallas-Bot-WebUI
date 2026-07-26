import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  REPLY_STYLE_CHOICES,
  parseReplyStyleVariants,
  updateReplyStyleVariants,
  type ReplyStyleId,
} from "@/utils/replyStyleVariants";
import { cn } from "@/lib/utils";

export default function ReplyStyleVariantsField({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const policy = parseReplyStyleVariants(value);

  function update(patch: Partial<typeof policy>) {
    const next = { ...policy, ...patch };
    onValueChange(updateReplyStyleVariants(value, next));
  }

  function toggleStyle(style: ReplyStyleId) {
    const styles = policy.styles.includes(style)
      ? policy.styles.filter((item) => item !== style)
      : [...policy.styles, style];
    update({ styles });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">临时调整本轮口气</p>
          <p className="text-xs text-muted-foreground">只影响当轮回复，不会修改静态人设。</p>
        </div>
        <Switch
          checked={policy.enabled}
          onCheckedChange={(enabled) => update({ enabled })}
          aria-label="启用本轮回复风格变体"
        />
      </div>

      <label className="grid gap-1.5 text-sm">
        <span>触发概率</span>
        <div className="flex max-w-40 items-center gap-2">
          <input
            className="inp h-9 w-full"
            type="number"
            min={0}
            max={100}
            step={1}
            value={policy.probabilityPercent}
            disabled={!policy.enabled}
            aria-label="本轮回复风格变体触发概率（百分比）"
            onChange={(event) => update({ probabilityPercent: Number(event.target.value) })}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </label>

      <div className="space-y-1.5">
        <p className="text-sm">可选口气</p>
        <div className="flex flex-wrap gap-2">
          {REPLY_STYLE_CHOICES.map((style) => {
            const active = policy.styles.includes(style.id);
            return (
              <Button
                key={style.id}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className={cn("h-8 rounded-full px-3 text-xs", !policy.enabled && "opacity-60")}
                aria-pressed={active}
                disabled={!policy.enabled}
                onClick={() => toggleStyle(style.id)}
              >
                {style.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
