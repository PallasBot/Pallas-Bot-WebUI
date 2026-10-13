import * as React from "react";
import { composeRefs } from "@radix-ui/react-compose-refs";
import { ComboBox as HeroComboBox, Input, ListBox } from "@heroui/react";
import { ComboBoxStateContext } from "react-aria-components/ComboBox";
import { Check, ChevronDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** 与 SelectTrigger 视觉对齐，供 Combobox 触发器复用。 */
export const COMBOBOX_TRIGGER_CLASS =
  "flex h-9 min-h-[var(--ui-ctrl-height,36px)] w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-[var(--radius-control,8px)] border border-[var(--control-edge)] bg-[var(--control-bg,hsl(var(--ui-background)))] px-3 py-0 text-[length:var(--console-control-font-size,14px)] font-normal leading-snug text-[var(--text)] shadow-[var(--control-shadow)] focus:outline-none focus:border-[color-mix(in_srgb,var(--accent)_16%,var(--control-border))] focus:ring-0 focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_8%,transparent)] data-[open]:border-[color-mix(in_srgb,var(--accent)_16%,var(--control-border))] data-[open]:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_8%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export type ComboboxOption = {
  value: string;
  /** 触发器与列表展示 */
  label: React.ReactNode;
  /** 触发器单独展示（可选；默认用 label） */
  triggerLabel?: React.ReactNode;
  /** 过滤用纯文本；默认同 value */
  keywords?: string;
  disabled?: boolean;
};

export type ComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  /** 选项数 ≥ 此值时显示搜索框；默认 8 */
  searchThreshold?: number;
  /** 参与阈值判断的数量；默认 `options.length`（Bot 选择可传账号数，不含「全部」等前置项） */
  searchCount?: number;
  /** 允许在搜索框 Enter 提交不在列表中的值（群号等） */
  allowCustom?: boolean;
  /** 列表加载中（打开后显示转圈，与镜像选择一致） */
  loading?: boolean;
  loadingText?: string;
  triggerClassName?: string;
  contentClassName?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  title?: string;
  disabled?: boolean;
  id?: string;
  /** 持久化最近一次选择；仅对需要记忆的场景显式启用。 */
  memoryKey?: string;
};

type CollectionOption = ComboboxOption & { textValue: string };

function nodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

function optionSearchText(opt: ComboboxOption): string {
  const labelText = nodeText(opt.label);
  return `${opt.value} ${opt.keywords?.trim() || ""} ${labelText}`.toLowerCase();
}

type HeroComboBoxState = NonNullable<React.ContextType<typeof ComboBoxStateContext>>;

function ComboBoxStateBridge({
  stateRef,
  triggerText,
}: {
  stateRef: React.RefObject<HeroComboBoxState | null>;
  triggerText: string;
}) {
  const state = React.useContext(ComboBoxStateContext);
  const wasOpen = React.useRef(state?.isOpen ?? false);

  React.useLayoutEffect(() => {
    stateRef.current = state;
    return () => {
      stateRef.current = null;
    };
  }, [state, stateRef]);

  React.useEffect(() => {
    if (!state) return;
    if (state.isOpen && !wasOpen.current) state.setInputValue("");
    wasOpen.current = state.isOpen;
  }, [state?.isOpen, state?.setInputValue]);

  React.useEffect(() => {
    if (state && !state.isOpen && state.inputValue !== triggerText) {
      state.setInputValue(triggerText);
    }
  }, [state?.inputValue, state?.isOpen, state?.setInputValue, triggerText]);

  return null;
}

/** 可搜索下拉：过滤采用简单 includes，避免默认模糊匹配的开销。 */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "请选择…",
  emptyText = "无匹配",
  searchPlaceholder = "搜索…",
  searchThreshold = 8,
  searchCount,
  allowCustom = false,
  loading = false,
  loadingText = "正在加载…",
  triggerClassName,
  contentClassName,
  ariaLabel,
  ariaDescribedBy,
  title,
  disabled,
  id,
  memoryKey,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [collectionVersion, setCollectionVersion] = React.useState(0);
  const listId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const stateRef = React.useRef<HeroComboBoxState | null>(null);
  const suppressFocusOpenRef = React.useRef(false);
  const showSearch = allowCustom || (searchCount ?? options.length) >= searchThreshold;
  const selected = options.find((option) => option.value === value);
  const triggerBody = selected
    ? (selected.triggerLabel ?? selected.label)
    : value.trim()
      ? value
      : null;
  const triggerText = nodeText(triggerBody);

  const setCustomValue = (next: string) => {
    onValueChange(next);
    if (stateRef.current?.isOpen) stateRef.current.toggle();
    setQuery("");
    setCollectionVersion((version) => version + 1);
  };

  React.useEffect(() => {
    if (collectionVersion > 0) triggerRef.current?.focus();
  }, [collectionVersion]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((option) => !q || optionSearchText(option).includes(q))
      .map((option) => ({ ...option, textValue: nodeText(option.triggerLabel ?? option.label) }));
  }, [options, query]);

  React.useEffect(() => {
    const key = memoryKey?.trim();
    if (!key || loading || typeof window === "undefined") return;

    try {
      const currentValue = value.trim();
      if (currentValue) {
        window.localStorage.setItem(key, currentValue);
        return;
      }

      const rememberedValue = window.localStorage.getItem(key)?.trim();
      if (!rememberedValue) return;
      if (allowCustom || options.some((option) => option.value === rememberedValue)) {
        onValueChange(rememberedValue);
      }
    } catch {
      // Storage can be unavailable in private browsing or restricted embeds.
    }
  }, [allowCustom, loading, memoryKey, onValueChange, options, value]);

  return (
    <HeroComboBox.Root
      key={collectionVersion}
      items={filtered}
      selectedKey={selected ? selected.value : null}
      onSelectionChange={(key) => {
        if (loading || typeof key !== "string") return;
        suppressFocusOpenRef.current = true;
        if (stateRef.current?.isOpen) stateRef.current.toggle();
        setQuery("");
        onValueChange(key);
      }}
      menuTrigger="manual"
      onInputChange={setQuery}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setQuery("");
      }}
      isDisabled={disabled}
      allowsEmptyCollection
      aria-label={ariaLabel ?? placeholder}
      defaultFilter={() => true}
      className="w-full min-w-0"
    >
      <ComboBoxStateBridge stateRef={stateRef} triggerText={triggerText} />
      <HeroComboBox.InputGroup
        className={cn(
          COMBOBOX_TRIGGER_CLASS,
          "focus-within:border-[color-mix(in_srgb,var(--accent)_16%,var(--control-border))] focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_8%,transparent)] forced-colors:focus-within:outline-2 forced-colors:focus-within:outline-offset-2 forced-colors:focus-within:outline-[Highlight]",
          open && "border-[color-mix(in_srgb,var(--accent)_16%,var(--control-border))] shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_8%,transparent)]",
          triggerClassName,
        )}
      >
        <Input
          ref={inputRef}
          id={id}
          aria-label={ariaLabel ?? placeholder}
          aria-describedby={ariaDescribedBy}
          aria-busy={loading || undefined}
          aria-controls={listId}
          title={title}
          placeholder={open ? searchPlaceholder : triggerBody ? "" : placeholder}
          readOnly={!showSearch || loading}
          onKeyDown={(event) => {
            if (loading || event.key !== "Enter" || !allowCustom) return;
            const enabled = filtered.filter((option) => !option.disabled);
            if (enabled.length) return;
            const next = query.trim();
            if (!next) return;
            event.preventDefault();
            setCustomValue(next);
          }}
          onFocus={() => {
            if (suppressFocusOpenRef.current) {
              suppressFocusOpenRef.current = false;
              return;
            }
            const state = stateRef.current;
            if (state && !state.isFocused && !state.isOpen) state.open("first", "manual");
          }}
          onBlur={() => {
            suppressFocusOpenRef.current = false;
          }}
          onClick={() => {
            suppressFocusOpenRef.current = false;
            const state = stateRef.current;
            if (state && !state.isOpen) state.open(null, "manual");
          }}
          onBeforeInput={() => {
            suppressFocusOpenRef.current = false;
            const state = stateRef.current;
            if (state && !state.isOpen) state.open(null, "manual");
          }}
          className={cn(
            "h-full min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-[length:var(--console-control-font-size,14px)] font-normal leading-snug shadow-none outline-none focus:border-0 focus:ring-0 focus:shadow-none",
            triggerBody && !open && "text-transparent caret-transparent",
          )}
        />
        {triggerBody && !open ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 right-10 grid min-w-0 items-center overflow-x-hidden overflow-y-visible text-left leading-snug whitespace-nowrap text-ellipsis"
          >
            {triggerBody}
          </span>
        ) : null}
        <HeroComboBox.Trigger
          aria-label={ariaLabel ?? placeholder}
          aria-describedby={ariaDescribedBy}
          className="h-full shrink-0 border-0 bg-transparent px-0 py-0 shadow-none outline-none focus:outline-none focus:ring-0 focus:shadow-none data-[open]:border-0 data-[open]:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
          render={(triggerProps) => (
            <button
              {...triggerProps}
              ref={composeRefs(triggerProps.ref, triggerRef)}
              title={title}
            />
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-70" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 self-center opacity-50" aria-hidden />
          )}
        </HeroComboBox.Trigger>
      </HeroComboBox.InputGroup>
      <HeroComboBox.Popover
        placement="bottom start"
        offset={4}
        containerPadding={8}
        className={cn(
          "ui-surface-popover z-[500] flex max-h-[min(var(--radix-popover-content-available-height,100dvh),calc(100dvh-1rem))] w-auto min-w-[var(--trigger-width)] max-w-[min(24rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-[var(--radius-control,8px)] border bg-popover p-0 text-popover-foreground shadow-md outline-none [--radix-popover-trigger-width:var(--trigger-width)]",
          contentClassName,
        )}
      >
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
            {loadingText}
          </div>
        ) : (
          <ListBox
            id={listId}
            aria-label={ariaLabel ?? "选项"}
            items={filtered}
            className="max-h-inherit min-w-0 overflow-auto p-1 outline-none"
            renderEmptyState={() => (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {allowCustom && query.trim() ? "无匹配；按 Enter 使用输入值" : emptyText}
              </div>
            )}
          >
            {(option: CollectionOption) => (
              <ListBox.Item
                id={option.value}
                textValue={option.textValue}
                isDisabled={option.disabled}
                className="flex min-h-9 cursor-default items-center gap-2 rounded-[calc(var(--radius-control,8px)-2px)] px-2 text-sm outline-none data-[focused]:bg-[var(--surface-hover)] data-[highlighted]:bg-[var(--surface-hover)] data-[selected]:bg-[var(--surface-hover)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0 text-[var(--accent)]",
                    option.value === value ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </ListBox.Item>
            )}
          </ListBox>
        )}
      </HeroComboBox.Popover>
    </HeroComboBox.Root>
  );
}
