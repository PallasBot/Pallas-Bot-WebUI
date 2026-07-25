/**
 * 帮助图覆盖用：选择或手输插件模块名。
 */
import { useMemo } from "react";
import HelpPortalSelect, { type HelpPortalOption } from "@/components/help/HelpPortalSelect";

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  pluginIds: string[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export default function HelpPluginSelect({
  value,
  onValueChange,
  pluginIds,
  allowEmpty = true,
  emptyLabel = "（未选）",
  disabled = false,
  className,
  id,
}: Props) {
  const options = useMemo(() => {
    const rows: HelpPortalOption[] = [];
    const seen = new Set<string>();
    for (const raw of pluginIds) {
      const idValue = String(raw || "").trim();
      if (!idValue || seen.has(idValue)) continue;
      seen.add(idValue);
      rows.push({ value: idValue, label: idValue });
    }
    const current = String(value || "").trim();
    if (current && !seen.has(current)) {
      rows.push({ value: current, label: current });
    }
    return rows.sort((a, b) => a.value.localeCompare(b.value));
  }, [pluginIds, value]);

  return (
    <HelpPortalSelect
      id={id}
      className={className}
      value={value}
      onValueChange={onValueChange}
      options={options}
      placeholder="选择或输入插件名"
      inputPlaceholder="输入模块名，Enter 确认"
      allowEmpty={allowEmpty}
      emptyLabel={emptyLabel}
      allowCustom
      disabled={disabled}
    />
  );
}
