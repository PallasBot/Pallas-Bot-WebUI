import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GripVertical, ImageIcon, Plus, X } from "lucide-react";
import { fetchLlmProviderModels, fetchLlmProvidersConfig } from "@/api/consoleApi";
import type { LlmProviderConfigRow } from "@/api/pallasTypes";
import AiConfigField, { AiModelSelect } from "@/components/ai/AiConfigField";
import AiOptionSelect from "@/components/ai/AiOptionSelect";
import PluginConfigFormSection from "@/components/config/PluginConfigFormSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { cn } from "@/lib/utils";
import {
  DRAW_PROVIDER_GATEWAY_BINDING,
  applyProviderGatewaysToFieldValues,
  emptyProviderGatewayDraft,
  moveProviderGatewayRow,
  normalizeGatewayCostCurrency,
  parseProviderGatewaysFromFieldValues,
  promoteProviderFallbackToPrimary,
  providerGatewayBoundFieldNames,
  providerGatewayChipLabel,
  providerGatewayIsConfigured,
  renormalizeProviderGatewayRows,
  type ProviderGatewayBinding,
  type ProviderGatewayRow,
} from "@/utils/providerGateways";
import { pushConsoleToast } from "@/utils/consoleToast";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";

export { providerGatewayBoundFieldNames };

type GatewayMode = "inherit" | "manual";

type Props = {
  fieldValues: Record<string, string>;
  onFieldsPatch: (patch: Record<string, string>) => void | Promise<void>;
  busy?: boolean;
  className?: string;
  /** 缺省为画画 split 绑定；插件页由 schema ``ui_gateway`` 注入 */
  binding?: ProviderGatewayBinding;
};

const COST_CURRENCY_OPTIONS = [
  { value: "CNY", label: "CNY · 人民币" },
  { value: "USD", label: "USD · 美元" },
  { value: "EUR", label: "EUR · 欧元" },
  { value: "JPY", label: "JPY · 日元" },
];

function providerSummary(row: LlmProviderConfigRow | null | undefined): string {
  if (!row) return "";
  return [row.base_url, row.default_model].filter(Boolean).join(" · ");
}

function draftMode(row: ProviderGatewayRow): GatewayMode {
  return row.provider_id.trim() ? "inherit" : "manual";
}

function validateDraft(draft: ProviderGatewayRow, allowManual: boolean): string {
  if (draft.provider_id.trim()) return "";
  if (!allowManual) return "请选择要沿用的 Provider。";
  if (!draft.base_url.trim()) return "请填写服务地址，或改为沿用 Provider。";
  if (!draft.api_key.trim()) return "请填写访问密钥，或改为沿用 Provider。";
  return "";
}

function rowModeHint(row: ProviderGatewayRow): string {
  if (row.provider_id.trim()) return `沿用 ${row.provider_id.trim()}`;
  if (providerGatewayIsConfigured(row)) return "手动填写";
  return "未配置";
}

function rowDetailLine(row: ProviderGatewayRow, showCost: boolean): string {
  const parts: string[] = [];
  if (row.provider_id.trim()) {
    parts.push(row.provider_id.trim());
  } else if (row.base_url.trim()) {
    parts.push(row.base_url.trim());
  }
  if (row.model.trim()) parts.push(row.model.trim());
  if (showCost && row.cost_per_image > 0) parts.push(`${row.cost_per_image}/张`);
  return parts.join(" · ");
}

/**
 * 通用 Provider 主线/备线面板（画画 / meme 等共用）。
 */
export default function ProviderGatewayPanel({
  fieldValues,
  onFieldsPatch,
  busy = false,
  className,
  binding = DRAW_PROVIDER_GATEWAY_BINDING,
}: Props) {
  const { confirm, confirmDialog } = useConsoleConfirm();
  const allowManual = Boolean(binding.allow_manual);
  const showCost = Boolean(binding.primary?.cost_per_image || binding.currency_field);
  const currencyField = String(binding.currency_field || "").trim();
  const panelTitle = binding.title?.trim() || "Provider 线路";

  const rows = useMemo(
    () => parseProviderGatewaysFromFieldValues(fieldValues, binding),
    [fieldValues, binding],
  );
  const savedCurrency = normalizeGatewayCostCurrency(
    currencyField ? fieldValues[currencyField] : "",
  );

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProviderGatewayRow>(() => emptyProviderGatewayDraft("primary"));
  const [draftKeepApiKey, setDraftKeepApiKey] = useState("");
  const [currency, setCurrency] = useState(savedCurrency);
  const [error, setError] = useState("");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = useState(false);
  const didDragRef = useRef(false);
  const providersQ = useQuery({
    queryKey: ["llm-providers-config"],
    queryFn: fetchLlmProvidersConfig,
  });

  useEffect(() => {
    setCurrency(savedCurrency);
  }, [savedCurrency]);

  const enabledProviders = useMemo(() => {
    const list = providersQ.data?.providers ?? [];
    return list.filter((row) => row.enabled !== false && String(row.id || "").trim());
  }, [providersQ.data]);

  const providerOptions = useMemo(
    () =>
      enabledProviders.map((row) => ({
        value: row.id,
        label: row.id,
        description: providerSummary(row) || undefined,
      })),
    [enabledProviders],
  );

  const selectedProvider = useMemo(
    () => enabledProviders.find((row) => row.id === draft.provider_id.trim()) ?? null,
    [enabledProviders, draft.provider_id],
  );

  const mode = allowManual ? draftMode(draft) : "inherit";

  const modelPresets = useMemo(() => {
    const values = new Set<string>();
    const def = String(selectedProvider?.default_model || "").trim();
    if (def) values.add(def);
    const current = draft.model.trim();
    if (current) values.add(current);
    return [...values];
  }, [selectedProvider?.default_model, draft.model]);

  useEffect(() => {
    setModelOptions([]);
  }, [draft.provider_id, draft.base_url, mode]);

  async function discoverModels() {
    const providerId = draft.provider_id.trim();
    const baseUrl = draft.base_url.trim();
    setModelsBusy(true);
    try {
      if (mode === "inherit" && providerId) {
        const result = await fetchLlmProviderModels(providerId);
        setModelOptions(result.models || []);
        return;
      }
      if (mode === "manual" && baseUrl) {
        const result = await fetchLlmProviderModels("_gateway_draft", {
          base_url: baseUrl,
          api_key: draft.api_key.trim() || draftKeepApiKey,
        });
        setModelOptions(result.models || []);
        return;
      }
      setModelOptions([]);
    } catch {
      setModelOptions([]);
    } finally {
      setModelsBusy(false);
    }
  }

  const isAdd = editingId === null;
  const popoverTitle = isAdd
    ? draft.role === "primary"
      ? "配置主网关"
      : "添加备选网关"
    : draft.role === "primary"
      ? "编辑主网关"
      : "编辑备选网关";
  const currencyDirty = normalizeGatewayCostCurrency(currency) !== savedCurrency;

  async function commitRows(next: ProviderGatewayRow[]) {
    const patch = applyProviderGatewaysToFieldValues(fieldValues, renormalizeProviderGatewayRows(next), binding);
    if (currencyField) patch[currencyField] = normalizeGatewayCostCurrency(currency);
    await onFieldsPatch(patch);
  }

  async function saveCurrencyOnly() {
    if (busy) return;
    try {
      const patch = applyProviderGatewaysToFieldValues(fieldValues, rows, binding);
      if (currencyField) patch[currencyField] = normalizeGatewayCostCurrency(currency);
      await onFieldsPatch(patch);
      pushConsoleToast("已保存费用币种", "ok");
    } catch {
      pushConsoleToast("币种保存失败", "err");
    }
  }

  function openEditor(row: ProviderGatewayRow | null, role: ProviderGatewayRow["role"] = "fallback") {
    if (busy) return;
    const next = row ? { ...row } : emptyProviderGatewayDraft(role);
    setEditingId(row?.id ?? null);
    setDraft(next);
    setDraftKeepApiKey(row?.api_key ?? "");
    setError("");
    setOpen(true);
  }

  function closeEditor() {
    setOpen(false);
    setError("");
    setEditingId(null);
  }

  function setMode(next: GatewayMode) {
    if (next === mode) return;
    if (next === "manual") {
      setDraft((prev) => ({ ...prev, provider_id: "" }));
      return;
    }
    const first = enabledProviders[0]?.id ?? "";
    setDraft((prev) => ({
      ...prev,
      provider_id: first,
      base_url: "",
      api_key: "",
    }));
  }

  async function saveDraft() {
    if (busy) return;
    const nextDraft: ProviderGatewayRow = {
      ...draft,
      name: draft.name.trim(),
      provider_id: draft.provider_id.trim(),
      base_url: draft.provider_id.trim() ? "" : draft.base_url.trim(),
      api_key: draft.provider_id.trim()
        ? ""
        : draft.api_key.trim() || draftKeepApiKey.trim(),
      model: draft.model.trim(),
    };
    const err = validateDraft(nextDraft, allowManual);
    if (err) {
      setError(err);
      return;
    }

    try {
      if (isAdd) {
        if (nextDraft.role === "primary") {
          const rest = rows.filter((r) => r.role !== "primary");
          await commitRows([{ ...nextDraft, id: "primary", role: "primary" }, ...rest]);
        } else {
          await commitRows([...rows, { ...nextDraft, role: "fallback" }]);
        }
        pushConsoleToast(
          nextDraft.role === "primary" ? "已保存主网关" : "已添加备选网关",
          "ok",
        );
      } else {
        await commitRows(
          rows.map((r) => (r.id === editingId ? { ...nextDraft, id: r.id, role: r.role } : r)),
        );
        pushConsoleToast(
          nextDraft.role === "primary" ? "已更新主网关" : "已更新备选网关",
          "ok",
        );
      }
      closeEditor();
    } catch {
      setError("保存失败，请重试");
    }
  }

  async function removeDraft() {
    if (!editingId || draft.role === "primary" || busy) return;
    if (
      !(await confirm({
        title: "删除备选网关",
        subtitle: `确定删除「${providerGatewayChipLabel(draft, 0)}」？`,
        confirmLabel: "删除",
      }))
    )
      return;
    try {
      await commitRows(rows.filter((r) => r.id !== editingId));
      pushConsoleToast("已删除备选网关", "warn");
      closeEditor();
    } catch {
      setError("删除失败，请重试");
    }
  }

  async function promoteDraft() {
    if (!editingId || draft.role !== "fallback" || busy) return;
    if (
      !(await confirm({
        title: "设为主线",
        subtitle: "确定将该备选网关设为主线？原主网关会降为备线。",
        confirmLabel: "设为主线",
        confirmVariant: "default",
      }))
    )
      return;
    try {
      await commitRows(promoteProviderFallbackToPrimary(rows, editingId));
      pushConsoleToast("已将备选设为主网关（原主网关降为备线）", "ok");
      closeEditor();
    } catch {
      setError("设为主线失败，请重试");
    }
  }

  async function removeRow(row: ProviderGatewayRow, e: MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    if (
      !(await confirm({
        title: row.role === "primary" ? "清空主网关" : "删除备选网关",
        subtitle:
          row.role === "primary"
            ? "确定清空主网关配置？"
            : `确定删除「${providerGatewayChipLabel(row, 0)}」？`,
        confirmLabel: row.role === "primary" ? "清空" : "删除",
      }))
    )
      return;
    try {
      if (row.role === "primary") {
        await commitRows([
          emptyProviderGatewayDraft("primary"),
          ...rows.filter((r) => r.role === "fallback"),
        ]);
        pushConsoleToast("已清空主网关配置", "warn");
        return;
      }
      await commitRows(rows.filter((r) => r.id !== row.id));
      pushConsoleToast("已删除备选网关", "warn");
    } catch {
      pushConsoleToast("网关保存失败", "err");
    }
  }

  function startAddGateway() {
    const primary = rows.find((r) => r.role === "primary");
    const hasBackends = Boolean(binding.backends) || binding.mode === "unified";
    // 无线备字段时只配主线，避免「添加」却无处落盘
    if (!hasBackends) {
      openEditor(primary ?? emptyProviderGatewayDraft("primary"), "primary");
      return;
    }
    if (primary && !providerGatewayIsConfigured(primary)) {
      openEditor(primary);
      return;
    }
    openEditor(null, "fallback");
  }

  function onRowDragStart(index: number, e: DragEvent) {
    didDragRef.current = false;
    setDragFrom(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.55";
    }
  }

  function onRowDragEnd(e: DragEvent) {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "";
    }
    setDragFrom(null);
    setDragOver(null);
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }

  function onRowDragOver(index: number, e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOver !== index) setDragOver(index);
  }

  async function onRowDrop(index: number, e: DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    const from = Number.parseInt(raw, 10);
    const fromIndex = Number.isFinite(from) ? from : dragFrom;
    setDragFrom(null);
    setDragOver(null);
    if (fromIndex == null || fromIndex === index || busy) return;
    didDragRef.current = true;
    try {
      await commitRows(moveProviderGatewayRow(rows, fromIndex, index));
      pushConsoleToast("已调整网关顺序", "ok");
    } catch {
      pushConsoleToast("网关保存失败", "err");
    }
  }

  function onRowClick(row: ProviderGatewayRow) {
    if (didDragRef.current) return;
    openEditor(row);
  }

  let fallbackIndex = 0;

  return (
    <PluginConfigFormSection
      className={className}
      title={panelTitle}
      icon={ImageIcon}
      bodyClassName="!grid-cols-1 gap-4"
      subtitle={
        <>
          主线优先，失败依次备线；拖动调序，点行编辑。
          {allowManual ? "可沿用 Provider 或手填。" : null}
          {" Provider 见 "}
          <Link
            to={aiConfigSectionPath("provider")}
            className="text-primary underline-offset-2 hover:underline"
          >
            AI 配置 · 接入
          </Link>
          。
          {busy ? " 正在保存…" : null}
        </>
      }
    >
      {currencyField ? (
        <AiConfigField label="费用币种" description="各网关共用；计费展示与统计用。">
          <div className="flex flex-wrap items-center gap-2">
            <AiOptionSelect
              className="h-9 min-h-9 w-full min-w-0 max-w-[12rem] sm:w-[11rem]"
              value={currency}
              onValueChange={(v) => setCurrency(normalizeGatewayCostCurrency(v))}
              options={COST_CURRENCY_OPTIONS}
              placeholder="选择币种"
              allowEmpty
              emptyLabel="未设置"
              disabled={busy}
            />
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0"
              disabled={busy || !currencyDirty}
              onClick={() => void saveCurrencyOnly()}
            >
              {busy ? "保存中…" : "保存币种"}
            </Button>
          </div>
        </AiConfigField>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">网关列表</p>
          <p className="text-[11px] text-muted-foreground">最上为主线</p>
        </div>

        <ul className="space-y-2">
          {rows.map((row, index) => {
            const idx = row.role === "fallback" ? fallbackIndex++ : -1;
            const configured = providerGatewayIsConfigured(row);
            const label = providerGatewayChipLabel(row, Math.max(idx, 0));
            const detail = rowDetailLine(row, showCost);
            const selected = open && editingId === row.id;
            return (
              <li key={row.id}>
                <div
                  role="button"
                  tabIndex={0}
                  draggable={!busy}
                  aria-disabled={busy}
                  title="拖动手柄调序；点击编辑"
                  className={cn(
                    "group flex min-w-0 cursor-pointer items-stretch gap-2 rounded-xl border px-2 py-2.5 transition-colors sm:gap-3 sm:px-3",
                    configured
                      ? "border-border/70 bg-background/80 hover:bg-accent/40"
                      : "border-dashed border-border/55 bg-muted/15 text-muted-foreground hover:bg-muted/30",
                    selected && "border-primary/50 bg-accent/50",
                    dragFrom === index && "opacity-55",
                    dragOver === index && dragFrom !== index && "border-primary ring-1 ring-primary/40",
                    busy && "cursor-wait opacity-70",
                  )}
                  onDragStart={(e) => onRowDragStart(index, e)}
                  onDragEnd={onRowDragEnd}
                  onDragOver={(e) => onRowDragOver(index, e)}
                  onDragLeave={() => {
                    if (dragOver === index) setDragOver(null);
                  }}
                  onDrop={(e) => void onRowDrop(index, e)}
                  onClick={() => onRowClick(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }}
                >
                  <span
                    className="flex shrink-0 cursor-grab items-center self-center text-muted-foreground active:cursor-grabbing"
                    aria-hidden
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <Badge
                        variant={row.role === "primary" ? "default" : "secondary"}
                        className="h-5 shrink-0 px-1.5 text-[10px]"
                      >
                        {row.role === "primary" ? "主线" : `备线 ${Math.max(idx, 0) + 1}`}
                      </Badge>
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {label}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {rowModeHint(row)}
                      </span>
                    </div>
                    {detail ? (
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{detail}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">点击配置服务地址或沿用 Provider</p>
                    )}
                  </div>

                  {row.role === "fallback" || configured ? (
                    <button
                      type="button"
                      draggable={false}
                      className="shrink-0 self-center rounded-md p-1.5 text-muted-foreground opacity-70 hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                      aria-label={row.role === "primary" ? "清空主网关" : "删除备线"}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => void removeRow(row, e)}
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <Popover
          open={open}
          onOpenChange={(next) => {
            if (!next) closeEditor();
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full gap-1.5 sm:w-auto"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                startAddGateway();
              }}
            >
              <Plus className="size-3.5" />
              {binding.mode === "split" && !binding.backends
                ? rows.some((r) => r.role === "primary" && providerGatewayIsConfigured(r))
                  ? "编辑线路"
                  : "添加网关"
                : "添加网关"}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="bottom"
            collisionPadding={8}
            className="flex max-h-[min(var(--radix-popover-content-available-height,100dvh),calc(100dvh-1rem))] w-[min(22rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 space-y-2 border-b p-2">
              {allowManual ? (
                <div className="flex gap-1" role="tablist" aria-label="网关配置方式">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "inherit" ? "secondary" : "ghost"}
                    className={cn(
                      "h-8 flex-1 text-xs",
                      mode === "inherit" ? "font-medium" : "text-muted-foreground",
                    )}
                    onClick={() => setMode("inherit")}
                  >
                    沿用 Provider
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "manual" ? "secondary" : "ghost"}
                    className={cn(
                      "h-8 flex-1 text-xs",
                      mode === "manual" ? "font-medium" : "text-muted-foreground",
                    )}
                    onClick={() => setMode("manual")}
                  >
                    手动填写
                  </Button>
                </div>
              ) : null}
              <div className="space-y-0.5 px-1">
                <p className="text-sm font-medium">{popoverTitle}</p>
                <p className="text-[11px] text-muted-foreground">
                  {allowManual ? "可沿用 Provider，或手填地址与密钥。" : "选择已配置的 Provider。"}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
              <AiConfigField label="显示名称" description="留空则用 Provider id 或默认主/备线名。">
                <Input
                  className="h-9"
                  value={draft.name}
                  onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={draft.role === "primary" ? "主网关" : "备线"}
                />
              </AiConfigField>

              {mode === "inherit" ? (
                <>
                  <AiConfigField
                    label="Provider"
                    description={
                      providersQ.isLoading
                        ? "加载中…"
                        : enabledProviders.length
                          ? "选择已启用的接入方。"
                          : "暂无已启用 Provider，请先到「接入」页添加。"
                    }
                  >
                    <AiOptionSelect
                      value={draft.provider_id}
                      onValueChange={(id) =>
                        setDraft((prev) => ({
                          ...prev,
                          provider_id: id,
                          base_url: "",
                          api_key: "",
                        }))
                      }
                      options={providerOptions}
                      allowEmpty
                      emptyLabel="（未选择）"
                      placeholder="选择 Provider"
                      disabled={providersQ.isLoading}
                    />
                  </AiConfigField>
                  {selectedProvider ? (
                    <div className="space-y-1 rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                      <p className="font-mono break-all">{selectedProvider.base_url || "（无地址）"}</p>
                      <p>
                        {selectedProvider.api_key_set || selectedProvider.api_key
                          ? "已配置密钥"
                          : "未配置密钥"}
                        {selectedProvider.default_model
                          ? ` · 默认 ${selectedProvider.default_model}`
                          : ""}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <AiConfigField label="服务地址">
                    <Input
                      className="h-9 font-mono text-sm"
                      value={draft.base_url}
                      onChange={(e) => setDraft((prev) => ({ ...prev, base_url: e.target.value }))}
                      placeholder="https://api.example.com/"
                    />
                  </AiConfigField>
                  <AiConfigField
                    label="访问密钥"
                    description={draftKeepApiKey && !draft.api_key ? "留空则保留原密钥。" : undefined}
                  >
                    <Input
                      className="h-9 font-mono text-sm"
                      type="password"
                      autoComplete="off"
                      value={draft.api_key}
                      onChange={(e) => setDraft((prev) => ({ ...prev, api_key: e.target.value }))}
                      placeholder={draftKeepApiKey ? "••••••••" : "sk-…"}
                    />
                  </AiConfigField>
                </>
              )}

              <AiConfigField
                label="模型（可选）"
                description={
                  draft.role === "primary"
                    ? "可搜索选择或手输；留空则用 Provider 默认。"
                    : "可搜索选择或手输；留空则使用主线默认模型。"
                }
              >
                <AiModelSelect
                  value={draft.model}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, model: value }))}
                  options={modelOptions}
                  presetOptions={modelPresets}
                  isFetching={modelsBusy}
                  onDiscover={
                    (mode === "inherit" && draft.provider_id.trim()) ||
                    (mode === "manual" && draft.base_url.trim())
                      ? () => void discoverModels()
                      : undefined
                  }
                  placeholder={
                    selectedProvider?.default_model
                    || (draft.role === "primary" ? "留空用 Provider 默认" : "沿用主线")
                  }
                  inputPlaceholder="输入模型名，Enter 确认"
                  allowEmpty
                  emptyLabel="（留空）"
                  disabled={busy}
                />
              </AiConfigField>

              {showCost ? (
                <AiConfigField
                  label="单张费用（可选）"
                  description="成功计费单价；0 表示不计费。币种见上方「费用币种」。"
                >
                  <Input
                    className="h-9 font-mono text-sm"
                    type="number"
                    min={0}
                    step="any"
                    value={Number.isFinite(draft.cost_per_image) ? draft.cost_per_image : 0}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setDraft((prev) => ({
                        ...prev,
                        cost_per_image: Number.isFinite(n) && n > 0 ? n : 0,
                      }));
                    }}
                    placeholder="0"
                  />
                </AiConfigField>
              ) : null}

              {currencyField ? (
                <AiConfigField
                  label="费用币种"
                  description="各网关共用；保存本网关时一并落盘。"
                >
                  <Input
                    className="h-9 font-mono text-sm uppercase"
                    value={currency}
                    disabled={busy}
                    placeholder="CNY"
                    onChange={(e) => setCurrency(normalizeGatewayCostCurrency(e.target.value))}
                  />
                </AiConfigField>
              ) : null}

              {showCost && draft.role === "fallback" ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={draft.omit_response_format}
                    onCheckedChange={(v) =>
                      setDraft((prev) => ({ ...prev, omit_response_format: v === true }))
                    }
                  />
                  请求体省略 response_format（部分上游需要）
                </label>
              ) : null}

              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 border-t p-3">
              <Button type="button" size="sm" disabled={busy} onClick={() => void saveDraft()}>
                {busy ? "保存中…" : "保存"}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={closeEditor}>
                取消
              </Button>
              {!isAdd && draft.role === "fallback" ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void promoteDraft()}
                  >
                    设为主线
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void removeDraft()}
                  >
                    删除
                  </Button>
                </>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {confirmDialog}
    </PluginConfigFormSection>
  );
}
