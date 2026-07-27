import { useMemo } from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import type { SnowlumaRuntimeRow } from "@/api/protocol";

const EMPTY_VALUE = "__empty__";

export function snowlumaRuntimeComboboxOptions(
  runtimes: SnowlumaRuntimeRow[],
  opts?: { includeEmpty?: boolean; emptyLabel?: string },
): ComboboxOption[] {
  const out: ComboboxOption[] = [];
  if (opts?.includeEmpty) {
    out.push({
      value: EMPTY_VALUE,
      label: opts.emptyLabel ?? "选择 Runtime",
      keywords: "选择 runtime",
    });
  }
  for (const runtime of runtimes) {
    const name = String(runtime.display_name ?? "").trim() || runtime.id;
    const members = runtime.member_count ?? runtime.member_account_ids?.length ?? 0;
    const status = runtime.process_running ? "运行中" : "已停止";
    out.push({
      value: runtime.id,
      label: `${name}（${members} 号 · ${status}）`,
      triggerLabel: name,
      keywords: [name, runtime.id, ...(runtime.member_account_ids ?? [])].join(" "),
    });
  }
  return out;
}

/** SnowLuma 已有 Runtime 可搜索 Combobox。 */
export default function SnowlumaRuntimeCombobox({
  runtimes,
  value,
  onValueChange,
  placeholder = "选择 Runtime",
  disabled = false,
  loading = false,
  ariaLabel = "选择 Runtime",
  className,
  allowEmpty = false,
}: {
  runtimes: SnowlumaRuntimeRow[];
  value: string;
  onValueChange: (runtimeId: string, runtime: SnowlumaRuntimeRow | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  className?: string;
  allowEmpty?: boolean;
}) {
  const options = useMemo(
    () =>
      snowlumaRuntimeComboboxOptions(runtimes, {
        includeEmpty: allowEmpty,
        emptyLabel: placeholder,
      }),
    [allowEmpty, placeholder, runtimes],
  );

  const comboboxValue = !value.trim() && allowEmpty ? EMPTY_VALUE : value;

  return (
    <Combobox
      value={comboboxValue}
      onValueChange={(next) => {
        const id = next === EMPTY_VALUE ? "" : next.trim();
        onValueChange(
          id,
          runtimes.find((runtime) => runtime.id === id),
        );
      }}
      options={options}
      placeholder={placeholder}
      emptyText="无匹配 Runtime"
      searchPlaceholder="搜索名称 / ID / QQ…"
      searchThreshold={1}
      loading={loading}
      loadingText="正在读取 Runtime…"
      ariaLabel={ariaLabel}
      disabled={disabled}
      triggerClassName={className}
    />
  );
}
