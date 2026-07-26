import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  FIREWALL_SEVERITY_OPTIONS,
  FIREWALL_STRATEGY_OPTIONS,
  parsePersonaOutputFirewall,
  updatePersonaOutputFirewall,
  type FirewallSeverity,
  type FirewallStrategy,
} from "@/utils/personaOutputFirewall";

function toOptions(
  items: Array<{ value: string; label: string; hint: string }>,
): ComboboxOption[] {
  return items.map((item) => ({
    value: item.value,
    label: item.label,
    triggerLabel: item.label,
    keywords: `${item.value} ${item.label} ${item.hint}`,
  }));
}

export default function PersonaOutputFirewallField({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const policy = parsePersonaOutputFirewall(value);

  function update(patch: Partial<typeof policy>) {
    onValueChange(updatePersonaOutputFirewall(value, { ...policy, ...patch }));
  }

  const severityHint =
    FIREWALL_SEVERITY_OPTIONS.find((item) => item.value === policy.severity)?.hint || "";
  const strategyHint =
    FIREWALL_STRATEGY_OPTIONS.find((item) => item.value === policy.strategy)?.hint || "";

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">检查回复是否人设崩了</p>
          <p className="text-xs text-muted-foreground">
            拦住泄提示词、舞台旁白、自称模型、重复垫词。默认关闭；开启后可能多一次生成。
          </p>
        </div>
        <Switch
          checked={policy.enabled}
          onCheckedChange={(enabled) => update({ enabled })}
          aria-label="启用人设输出防火墙"
        />
      </div>

      <label className="grid gap-1.5 text-sm">
        <span>拦截力度</span>
        <Combobox
          value={policy.severity}
          onValueChange={(severity) => update({ severity: severity as FirewallSeverity })}
          options={toOptions(FIREWALL_SEVERITY_OPTIONS)}
          disabled={!policy.enabled}
          ariaLabel="拦截力度"
          placeholder="选择拦截力度"
        />
        <span className="text-xs text-muted-foreground">{severityHint}</span>
      </label>

      <label className="grid gap-1.5 text-sm">
        <span>拦下后怎么处理</span>
        <Combobox
          value={policy.strategy}
          onValueChange={(strategy) => update({ strategy: strategy as FirewallStrategy })}
          options={toOptions(FIREWALL_STRATEGY_OPTIONS)}
          disabled={!policy.enabled}
          ariaLabel="拦下后怎么处理"
          placeholder="选择处理方式"
        />
        <span className="text-xs text-muted-foreground">{strategyHint}</span>
      </label>

      <label className="grid gap-1.5 text-sm">
        <span>最多重说几次</span>
        <Combobox
          value={String(policy.maxRetries)}
          onValueChange={(raw) => update({ maxRetries: raw === "0" ? 0 : 1 })}
          options={[
            { value: "1", label: "1 次", keywords: "1 重试 重说" },
            { value: "0", label: "不重说", keywords: "0 直接兜底" },
          ]}
          disabled={!policy.enabled || policy.strategy === "fallback"}
          ariaLabel="最多重说几次"
          placeholder="选择重说次数"
        />
        <span className="text-xs text-muted-foreground">
          {policy.strategy === "fallback"
            ? "当前是「直接兜底」，不会重说。"
            : "0=违规后立刻兜底；1=先让模型再试一次。"}
        </span>
      </label>
    </div>
  );
}
