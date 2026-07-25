/**
 * 帮助图分组 tag 选择（预设 + 自定义 id）。
 */
import { useMemo } from "react";
import HelpPortalSelect, { type HelpPortalOption } from "@/components/help/HelpPortalSelect";
import { HELP_TAG_PRESETS, helpTagLabel } from "@/components/help/helpTagOverrides";

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  /** 额外已知 tag（如已有覆盖里的自定义 id） */
  extraTags?: string[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export default function HelpTagSelect({
  value,
  onValueChange,
  extraTags,
  allowEmpty = false,
  emptyLabel = "使用插件默认",
  disabled = false,
  className,
  id,
}: Props) {
  const options = useMemo(() => {
    const rows: HelpPortalOption[] = HELP_TAG_PRESETS.map((t) => ({
      value: t.value,
      label: t.label,
    }));
    const seen = new Set(rows.map((r) => r.value));
    for (const raw of extraTags || []) {
      const tag = String(raw || "")
        .trim()
        .toLowerCase();
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      rows.push({ value: tag, label: helpTagLabel(tag) });
    }
    const current = String(value || "")
      .trim()
      .toLowerCase();
    if (current && !seen.has(current)) {
      rows.push({ value: current, label: helpTagLabel(current) });
    }
    return rows;
  }, [extraTags, value]);

  return (
    <HelpPortalSelect
      id={id}
      className={className}
      value={value}
      onValueChange={(next) => onValueChange(next.trim().toLowerCase())}
      options={options}
      placeholder="选择或输入分组"
      inputPlaceholder="输入分组 id，Enter 确认"
      allowEmpty={allowEmpty}
      emptyLabel={emptyLabel}
      allowCustom
      disabled={disabled}
    />
  );
}
