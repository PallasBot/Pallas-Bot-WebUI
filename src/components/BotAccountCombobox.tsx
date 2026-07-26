import { useMemo } from "react";
import type { ReactNode } from "react";
import BotSelectLabel from "@/components/BotSelectLabel";
import { CHROME_BOT_ACCOUNT_SELECT } from "@/components/ChromeTools";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { botSelectDropdownLabel } from "@/utils/botDisplay";

export type BotAccountOption = {
  id: string;
  nickname?: string | null;
};

export type BotAccountComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  bots: BotAccountOption[];
  /** 空选 / 全部等前置项；value 为约定哨兵（如 `__none__` / `__all__`） */
  leadingOption?: { value: string; label: ReactNode; keywords?: string };
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  searchThreshold?: number;
  triggerClassName?: string;
  contentClassName?: string;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  id?: string;
};

/**
 * 控制台 Bot 账号 Combobox（Popover + Command）。
 * 触发器只显示昵称；列表显示「昵称（账号）」；选项 ≥ searchThreshold 时显示搜索。
 */
export default function BotAccountCombobox({
  value,
  onValueChange,
  bots,
  leadingOption,
  placeholder = "请选择 Bot…",
  searchPlaceholder = "搜索昵称或账号…",
  emptyText = "无匹配账号",
  searchThreshold = 8,
  triggerClassName = CHROME_BOT_ACCOUNT_SELECT,
  contentClassName,
  ariaLabel = "当前 Bot 账号",
  title,
  disabled,
  id,
}: BotAccountComboboxProps) {
  const options = useMemo(() => {
    const out: ComboboxOption[] = [];
    if (leadingOption) {
      out.push({
        value: leadingOption.value,
        label: leadingOption.label,
        keywords: leadingOption.keywords ?? String(leadingOption.label),
      });
    }
    for (const b of bots) {
      const idStr = String(b.id).trim();
      if (!idStr) continue;
      const nick = b.nickname?.trim() || "";
      out.push({
        value: idStr,
        label: <BotSelectLabel nickname={nick || undefined} account={idStr} />,
        triggerLabel: <BotSelectLabel nickname={nick || undefined} account={idStr} />,
        keywords: botSelectDropdownLabel(nick, idStr),
      });
    }
    return out;
  }, [bots, leadingOption]);

  const resolvedTitle =
    title ??
    (() => {
      if (!value || (leadingOption && value === leadingOption.value)) return undefined;
      const cur = bots.find((b) => String(b.id) === value);
      if (!cur) return value;
      return botSelectDropdownLabel(cur.nickname, cur.id);
    })();

  return (
    <Combobox
      id={id}
      value={value}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      searchThreshold={searchThreshold}
      searchCount={bots.length}
      triggerClassName={triggerClassName}
      contentClassName={contentClassName}
      ariaLabel={ariaLabel}
      title={resolvedTitle}
      disabled={disabled}
    />
  );
}
