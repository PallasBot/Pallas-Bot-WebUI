import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchLlmLocalRoutingConfig,
  fetchLlmProviderModels,
  fetchLlmProvidersConfig,
  postLlmProviderTest,
  putLlmLocalRoutingConfig,
  putLlmProvider,
  putLlmProvidersConfig,
  type LlmLocalRoutingConfig,
  type LlmProviderCapability,
  type LlmProviderPricingRule,
  type LlmProviderRow,
  type LlmProvidersConfig,
} from "@/api/console";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import AiConfigField, { AiModelSelect } from "@/components/ai/AiConfigField";
import AiOptionSelect from "@/components/ai/AiOptionSelect";
import AiConfigSectionCard from "@/components/ai/AiConfigSectionCard";
import AiSectionHeader from "@/components/ai/AiSectionHeader";
import TierPairCards, { TierCard } from "@/components/ai/TierPairCards";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import { CHROME_SELECT_TRIGGER } from "@/components/ChromeTools";
import TagsInput, { type TagsInputHandle } from "@/components/config/TagsInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AI_TOKEN_METRIC_LABELS } from "@/config/aiConstants";
import {
  modelAfterProviderChange,
  modelDiscoveryOptionsForProvider,
  providerCommonModels,
  modelOptionsForProvider as listModelsForProvider,
} from "@/utils/llmProviderModels";
import { cn } from "@/lib/utils";
import { preserveShellMainScroll } from "@/utils/preserveShellScroll";
import { AlertTriangle, ChevronDown, ChevronUp, Cloud, Copy, Cpu, GitBranch, HardDrive, Key, Layers, ListTree, Plus, Save, Server, SlidersHorizontal, Trash2, Unplug, X, type LucideIcon } from "lucide-react";
import { pushConsoleToast } from "@/utils/consoleToast";
import { normalizeDrawCostCurrency } from "@/utils/drawGateways";
import { decimalInputDraft, formatDecimalInput } from "@/utils/decimalInput";
import {
  LLM_BASE_URL_SUGGESTIONS,
  LLM_LOCAL_BASE_URL_SUGGESTIONS,
  LLM_PROVIDER_CAPABILITIES,
  LLM_PROVIDER_CAPABILITIES_EDITABLE,
  LLM_PROVIDER_MODEL_EFFORTS,
  LLM_PROVIDER_REQUEST_METHODS,
  LLM_PROVIDER_PRESETS,
  applyPresetToDraft,
  baseUrlHasTrailingSlash,
  blankProvider,
  findPresetByBaseUrl,
  pruneRoutingForProvider,
  type LlmProviderPresetId,
} from "@/config/llmProviderPresets";
import AiModelAdminPanel from "@/pages/ai/sections/AiModelAdminPanel";
import {
  ALL_ROUTABLE_TASKS,
  applyLocalTiers,
  applyTaskRoutes,
  applyTaskTiers,
  foldLocalTiers,
  foldTaskRoutes,
  foldTaskTiers,
  TASK_ROUTE_META,
  type LocalTierState,
  type RoutableTask,
  type TaskRoutesState,
  type TaskTierState,
  type TierProviderSlot,
} from "@/utils/llmTierRouting";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";

type Tab = "upstream" | "tasks" | "runtime" | "routing";
type TasksViewMode = "tiers" | "all";

const PROVIDER_TABS: Array<{ id: Tab; label: string; icon: LucideIcon; lead: string }> = [
  {
    id: "upstream",
    label: "提供方",
    icon: Cloud,
    lead: "登记云端 API 或本机 Ollama：地址、密钥与默认模型。",
  },
  {
    id: "tasks",
    label: "任务编排",
    icon: ListTree,
    lead: "按场景指定主用/备用：@ 对话、接话选句、本轮动作决策等。",
  },
  {
    id: "runtime",
    label: "Ollama 运行",
    icon: Cpu,
    lead: "切换当前本机运行模型，以及 GPU 层数等运行参数。",
  },
  {
    id: "routing",
    label: "Ollama 分档",
    icon: GitBranch,
    lead: "本机多模型时，把重活/轻活分到不同 Ollama 模型。",
  },
];

function cloneDoc(doc: LlmProvidersConfig): LlmProvidersConfig {
  return JSON.parse(JSON.stringify(doc)) as LlmProvidersConfig;
}

function emptyDoc(): LlmProvidersConfig {
  return {
    providers: [],
    routing: { chain_fallback: [], tasks: {}, cost_currency: "" },
    providers_file: "",
    file_exists: false,
  };
}

const COST_CURRENCY_OPTIONS = [
  { value: "CNY", label: "CNY · 人民币" },
  { value: "USD", label: "USD · 美元" },
  { value: "EUR", label: "EUR · 欧元" },
  { value: "JPY", label: "JPY · 日元" },
];

function parseModelPrice(raw: string): number {
  const text = String(raw ?? "").trim();
  if (!text || text === ".") return 0;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function DecimalPriceInput({ value, onValueChange, ...props }: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: number | undefined;
  onValueChange: (value: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState(() => formatDecimalInput(value));

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setRaw(formatDecimalInput(value));
  }, [value]);

  return <Input
    {...props}
    ref={inputRef}
    type="text"
    inputMode="decimal"
    value={raw}
    onChange={(event) => {
      const next = decimalInputDraft(event.target.value);
      if (next === null) return;
      setRaw(next.raw);
      onValueChange(next.value);
    }}
    onBlur={() => setRaw(formatDecimalInput(value))}
  />;
}

function ModelPriceField({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: number | undefined;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <DecimalPriceInput
        className="h-8 font-mono text-xs"
        value={value}
        placeholder="0"
        onValueChange={onValueChange}
      />
    </div>
  );
}

function fmtPrice(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return "0";
  return String(parseFloat(v.toFixed(6)));
}

function formatPricingRuleSummary(rule: LlmProviderPricingRule): string {
  const parts: string[] = [];
  if (rule.kind === "per_request") {
    parts.push(
      rule.price_per_request != null && rule.price_per_request > 0
        ? `按次 ¥${fmtPrice(rule.price_per_request)}`
        : "按次",
    );
  } else {
    const hasTokenPrice = (rule.price_in ?? 0) > 0 || (rule.price_out ?? 0) > 0;
    if (hasTokenPrice) {
      parts.push(`¥${fmtPrice(rule.price_in)}/¥${fmtPrice(rule.price_out)}`);
    }
    if ((rule.cache_price_in ?? 0) > 0 || (rule.cache_price_out ?? 0) > 0) {
      parts.push(`缓存 ¥${fmtPrice(rule.cache_price_in)}/¥${fmtPrice(rule.cache_price_out)}`);
    }
    if (!hasTokenPrice && !(rule.cache_price_in ?? 0) && !(rule.cache_price_out ?? 0)) {
      parts.push("按 Token");
    }
  }
  if (rule.input_tokens_min != null || rule.input_tokens_max != null) {
    parts.push(`[${rule.input_tokens_min ?? ""}-${rule.input_tokens_max ?? ""}]`);
  }
  if (rule.daily_start || rule.daily_end) {
    parts.push(`${rule.daily_start || "00:00"}~${rule.daily_end || "24:00"}`);
  }
  return parts.join(" · ");
}

function DailyTimeSelect({ value, onValueChange, label }: { value?: string; onValueChange: (value: string) => void; label: string }) {
  const hours = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
  return <Popover>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className="h-8 justify-between text-xs"><span>{value || label}</span></Button>
    </PopoverTrigger>
    <PopoverContent className="w-56 p-2" align="start">
      <Button type="button" variant="ghost" className="h-8 w-full justify-start text-xs" onClick={() => onValueChange("")}>全天</Button>
      <div className="grid grid-cols-4 gap-1">
        {hours.map((time) => <Button key={time} type="button" size="sm" variant={value === time ? "secondary" : "ghost"} className="h-7 px-1 font-mono text-xs" onClick={() => onValueChange(time)}>{time}</Button>)}
      </div>
    </PopoverContent>
  </Popover>;
}

export default function LlmProvidersForm() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConsoleConfirm();
  const [tab, setTab] = useState<Tab>("upstream");
  const [tasksViewMode, setTasksViewMode] = useState<TasksViewMode>("tiers");
  const [doc, setDoc] = useState<LlmProvidersConfig>(emptyDoc());
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [testBusy, setTestBusy] = useState<string>("");
  const [testHint, setTestHint] = useState<Record<string, string>>({});

  const [editing, setEditing] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<LlmProviderRow>(blankProvider());
  const [collapsedModels, setCollapsedModels] = useState<Record<string, boolean>>({});
  const [draftApiKeys, setDraftApiKeys] = useState<string[]>([]);
  const [keepStoredApiKey, setKeepStoredApiKey] = useState(false);
  const apiKeysInputRef = useRef<TagsInputHandle>(null);
  const [useEnvVar, setUseEnvVar] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [registeredModelDraft, setRegisteredModelDraft] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [providerModels, setProviderModels] = useState<Record<string, string[]>>({});

  const [localDoc, setLocalDoc] = useState<LlmLocalRoutingConfig>({});
  const [localBaseline, setLocalBaseline] = useState("");
  const [localSaving, setLocalSaving] = useState(false);
  // chrome 保存按钮包在 useMemo 里，用 ref 避免 localDirty 已为 true 后改模型仍闭包到旧 localDoc
  const localDocRef = useRef(localDoc);
  localDocRef.current = localDoc;
  const docRef = useRef(doc);
  docRef.current = doc;
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const dirty = useMemo(() => JSON.stringify(doc) !== baseline, [doc, baseline]);
  const localDirty = useMemo(() => JSON.stringify(localDoc) !== localBaseline, [localDoc, localBaseline]);
  const providerIds = doc.providers.map((p) => p.id);
  const ollamaModels = useMemo(() => {
    const values = new Set<string>();
    for (const p of doc.providers) {
      if (p.kind !== "local" && p.id !== "local") continue;
      if (p.default_model?.trim()) values.add(p.default_model.trim());
      for (const model of Object.values(p.task_models || {})) {
        const t = String(model || "").trim();
        if (t) values.add(t);
      }
      for (const model of providerModels[p.id] || []) {
        const t = String(model || "").trim();
        if (t) values.add(t);
      }
    }
    return [...values];
  }, [doc.providers, providerModels]);

  const taskTiers = useMemo(() => foldTaskTiers(doc), [doc]);
  const taskRoutes = useMemo(() => foldTaskRoutes(doc), [doc]);
  const localTiers = useMemo(() => foldLocalTiers(localDoc), [localDoc]);

  async function load(opts?: { quiet?: boolean }) {
    const quiet = Boolean(opts?.quiet);
    if (!quiet) setLoading(true);
    if (!quiet) setErr("");
    try {
      const [providers, local] = await Promise.all([
        fetchLlmProvidersConfig(),
        fetchLlmLocalRoutingConfig().catch(() => ({}) as LlmLocalRoutingConfig),
      ]);
      const next = cloneDoc(providers);
      setDoc(next);
      setBaseline(JSON.stringify(next));
      setLocalDoc(local);
      setLocalBaseline(JSON.stringify(local));
    } catch (e) {
      const detail = axiosErrorDetail(e);
      setErr(detail);
      if (quiet) pushConsoleToast(detail || "刷新失败", "err");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (tab !== "routing" && tab !== "tasks") return;
    const targets =
      tab === "routing"
        ? doc.providers.filter((p) => p.kind === "local" || p.id === "local")
        : doc.providers;
    for (const provider of targets) {
      if (providerModels[provider.id]) continue;
      void fetchLlmProviderModels(provider.id, {
        base_url: provider.base_url,
        api_key_env: provider.api_key_env,
        kind: provider.kind === "local" || provider.id === "local" ? "local" : "remote",
        request_method: provider.request_method || "",
      })
        .then((result) => {
          if (result.ok) {
            setProviderModels((prev) => ({ ...prev, [provider.id]: result.models || [] }));
          }
        })
        .catch(() => undefined);
    }
  }, [tab, doc.providers, providerModels]);

  async function saveProviders() {
    if (!dirty || saving) return;
    setSaving(true);
    setErr("");
    try {
      const result = await putLlmProvidersConfig(cloneDoc(docRef.current));
      const fileHint = result.providers_file
        ? result.providers_file.replace(/\\/g, "/").split("/").pop() || ""
        : "";
      const label =
        tabRef.current === "tasks"
          ? "已保存任务编排"
          : fileHint
            ? `已保存提供方（${fileHint}）`
            : "已保存提供方配置";
      pushConsoleToast(label, "ok");
      // 只静默拉回提供方文档，避免整页 loading，也不误伤 Ollama 分档未保存草稿
      const providers = await fetchLlmProvidersConfig();
      const next = cloneDoc(providers);
      setDoc(next);
      setBaseline(JSON.stringify(next));
    } catch (e) {
      const detail = axiosErrorDetail(e);
      setErr(detail);
      pushConsoleToast(detail || "保存失败", "err");
    } finally {
      setSaving(false);
    }
  }

  async function saveLocal() {
    if (!localDirty || localSaving) return;
    setLocalSaving(true);
    setErr("");
    try {
      const current = localDocRef.current;
      // 保存前再折叠一轮：补齐空备用档，并用档位主模型兜底 llm_model
      const normalized = applyLocalTiers(current, foldLocalTiers(current));
      const llmModel =
        String(normalized.llm_model || "").trim() ||
        String(normalized.moe_models?.medium || "").trim() ||
        String(normalized.moe_models?.complex || "").trim();
      const payload = { ...normalized, llm_model: llmModel };
      if (!payload.llm_model && !payload.local_multi_model_enabled) {
        throw new Error("请先选择默认 Ollama 模型");
      }
      if (!payload.llm_model && payload.local_multi_model_enabled) {
        throw new Error("请先为「复杂」或「中等」档选择模型");
      }
      const saved = await putLlmLocalRoutingConfig(payload);
      setLocalDoc(saved);
      setLocalBaseline(JSON.stringify(saved));
      pushConsoleToast("已保存 Ollama 分档", "ok");
    } catch (e) {
      const detail = axiosErrorDetail(e);
      setErr(detail);
      pushConsoleToast(detail || "保存失败", "err");
    } finally {
      setLocalSaving(false);
    }
  }

  function openAdd() {
    setEditIndex(null);
    setDraft(blankProvider());
    setDraftApiKeys([]);
    setKeepStoredApiKey(false);
    setUseEnvVar(false);
    setEditErr("");
    setModels([]);
    setEditing(true);
  }

  function duplicateProvider(index: number) {
    const row = doc.providers[index];
    if (!row) return;
    setEditIndex(null);
    const next = JSON.parse(JSON.stringify(row)) as LlmProviderRow;
    if (!Array.isArray(next.capabilities)) next.capabilities = ["text"];
    if (typeof next.model_effort !== "string") next.model_effort = "";
    if (!next.request_method) next.request_method = "chat_completions";
    if (!next.model_pricing || typeof next.model_pricing !== "object") next.model_pricing = {};
    next.id = `${row.id}-副本`;
    if (!next.enabled) next.enabled = true;
    setDraft(next);
    const keys = Array.isArray(row.api_keys) ? row.api_keys.map((k) => String(k || "").trim()).filter(Boolean) : [];
    if (!keys.length && row.api_key?.trim()) keys.push(row.api_key.trim());
    setDraftApiKeys(keys);
    setKeepStoredApiKey(Boolean(row.api_key_set) && keys.length === 0);
    setUseEnvVar(Boolean(row.api_key_env?.trim()) && !row.api_key_set && keys.length === 0);
    setEditErr("");
    setModels([]);
    setEditing(true);
  }

  function openEdit(index: number) {
    const row = doc.providers[index];
    if (!row) return;
    setEditIndex(index);
    const next = JSON.parse(JSON.stringify(row)) as LlmProviderRow;
    if (!Array.isArray(next.capabilities)) next.capabilities = ["text"];
    if (typeof next.model_effort !== "string") next.model_effort = "";
    if (!next.request_method) next.request_method = "chat_completions";
    if (!next.model_pricing || typeof next.model_pricing !== "object") next.model_pricing = {};
    setDraft(next);
    const keys = Array.isArray(row.api_keys) ? row.api_keys.map((k) => String(k || "").trim()).filter(Boolean) : [];
    if (!keys.length && row.api_key?.trim()) keys.push(row.api_key.trim());
    setDraftApiKeys(keys);
    setKeepStoredApiKey(Boolean(row.api_key_set) && keys.length === 0);
    setUseEnvVar(Boolean(row.api_key_env?.trim()) && !row.api_key_set && keys.length === 0);
    setEditErr("");
    setModels([]);
    setEditing(true);
  }

  function registerProviderModel(nameRaw: string) {
    const name = nameRaw.trim();
    if (!name) {
      setRegisteredModelDraft("");
      return;
    }
    setDraft((d) => ({
      ...d,
      models: [
        ...(d.models || []).filter((model) => model.name !== name),
        { model_id: `model-${Date.now()}`, name, capabilities: [], pricing_rules: [] },
      ],
    }));
    setRegisteredModelDraft("");
  }

  function removeRegisteredProviderModel(name: string) {
    if (draft.default_model.trim() === name) {
      setEditErr("请先切换默认调用模型，再删除该模型");
      return;
    }
    setDraft((d) => ({ ...d, models: (d.models || []).filter((model) => model.name !== name) }));
  }

  function newPricingRule(kind: LlmProviderPricingRule["kind"]): LlmProviderPricingRule {
    return {
      id: `rule-${Date.now()}`,
      kind,
      ...(kind === "per_request"
        ? { price_per_request: 0 }
        : { price_in: 0, price_out: 0, cache_price_in: 0, cache_price_out: 0 }),
    };
  }

  function addPricingRule(modelName: string) {
    setDraft((d) => ({ ...d, models: (d.models || []).map((model) => model.name !== modelName ? model : {
      ...model, pricing_rules: [...(model.pricing_rules || []), newPricingRule("token")],
    }) }));
  }

  function setPricingRuleKind(modelName: string, ruleId: string, kind: LlmProviderPricingRule["kind"]) {
    setDraft((d) => ({ ...d, models: (d.models || []).map((model) => model.name !== modelName ? model : {
      ...model, pricing_rules: (model.pricing_rules || []).map((rule) => rule.id !== ruleId ? rule : { ...newPricingRule(kind), id: rule.id, input_tokens_min: rule.input_tokens_min, input_tokens_max: rule.input_tokens_max, daily_start: rule.daily_start, daily_end: rule.daily_end }),
    }) }));
  }

  function setPricingRuleValue(
    modelName: string,
    ruleId: string,
    field: "price_in" | "price_out" | "cache_price_in" | "cache_price_out" | "price_per_request" | "priority" | "input_tokens_min" | "input_tokens_max",
    value: number,
  ) {
    setDraft((d) => ({
      ...d,
      models: (d.models || []).map((model) => model.name !== modelName ? model : {
        ...model,
        pricing_rules: (model.pricing_rules || []).map((rule) => rule.id === ruleId ? { ...rule, [field]: value } : rule),
      }),
    }));
  }

  function setPricingRuleText(modelName: string, ruleId: string, field: "daily_start" | "daily_end", value: string) {
    setDraft((d) => ({ ...d, models: (d.models || []).map((model) => model.name !== modelName ? model : {
      ...model, pricing_rules: (model.pricing_rules || []).map((rule) => rule.id === ruleId ? { ...rule, [field]: value || undefined } : rule),
    }) }));
  }

  function removePricingRule(modelName: string, ruleId: string) {
    setDraft((d) => ({ ...d, models: (d.models || []).map((model) => model.name !== modelName ? model : {
      ...model, pricing_rules: (model.pricing_rules || []).filter((rule) => rule.id !== ruleId),
    }) }));
  }

  function toggleCapability(cap: LlmProviderCapability) {
    setDraft((prev) => {
      const current = new Set(prev.capabilities || []);
      if (current.has(cap)) current.delete(cap);
      else current.add(cap);
      return { ...prev, capabilities: [...current] as LlmProviderCapability[] };
    });
  }

  function applyPreset(id: LlmProviderPresetId) {
    setDraft((prev) => {
      const next = applyPresetToDraft(id, prev);
      // 新建时：切换预设同步配置名称；编辑已有提供方时 ID 不可改
      if (editIndex === null) {
        next.id = id === "custom" ? "" : id;
      }
      return next;
    });
  }

  async function submitEdit() {
    const wasNew = editIndex === null;
    const id = draft.id.trim();
    if (!id) {
      setEditErr("请填写提供方 ID");
      return;
    }
    if (wasNew && providerIds.includes(id)) {
      setEditErr(`提供方 ID「${id}」已存在`);
      return;
    }
    const kind = draft.kind === "local" ? "local" : draft.kind || "remote";
    if (kind !== "local" && !draft.base_url.trim()) {
      setEditErr("远程提供方需要填写 Base URL");
      return;
    }
    // 保存前把 TagsInput 未回车的草稿一并提交，避免密钥只在输入框里却未入库
    const flushedKeys = (apiKeysInputRef.current?.flush() ?? draftApiKeys)
      .map((k) => k.trim())
      .filter(Boolean);
    const apiKeys = flushedKeys;
    const apiKeyEnv = useEnvVar ? draft.api_key_env.trim() : "";
    if (kind !== "local") {
      if (!apiKeys.length && !apiKeyEnv && !keepStoredApiKey) {
        setEditErr("请填写至少一个 API Key，或改用环境变量");
        return;
      }
    }
    const row: LlmProviderRow = {
      ...draft,
      id,
      kind,
      base_url: draft.base_url.trim(),
      api_key: apiKeys[0] || "",
      api_keys: apiKeys,
      api_key_env: apiKeyEnv,
      api_key_set: apiKeys.length > 0 || Boolean(apiKeyEnv) || keepStoredApiKey,
      api_keys_count: apiKeys.length || (keepStoredApiKey ? draft.api_keys_count || 1 : 0),
      default_model: draft.default_model.trim(),
      models: [...(draft.models || [])],
      task_models: { ...(draft.task_models || {}) },
      capabilities: [...(draft.capabilities || [])],
      model_effort: draft.model_effort || "",
      model_pricing: { ...(draft.model_pricing || {}) },
      request_method:
        draft.kind === "local" ? "chat_completions" : draft.request_method || "chat_completions",
    };
    const nextIndex = wasNew ? doc.providers.length : editIndex!;
    setEditIndex(nextIndex);
    setDraft(row);
    setDraftApiKeys(apiKeys);
    setKeepStoredApiKey(apiKeys.length === 0 && (keepStoredApiKey || Boolean(apiKeyEnv)));
    setEditing(true);
    setSaving(true);
    setErr("");
    setEditErr("");
    try {
      // 单条 upsert：不整表回写，避免把其他提供方的脱敏空密钥写盘擦掉
      await putLlmProvider(row);
      let providers = await fetchLlmProvidersConfig();
      let next = cloneDoc(providers);
      // 新增后跟一次整页保存，同步路由等整表侧效应
      if (wasNew) {
        await putLlmProvidersConfig(next);
        providers = await fetchLlmProvidersConfig();
        next = cloneDoc(providers);
      }
      setDoc(next);
      setBaseline(JSON.stringify(next));
      const savedRow = next.providers.find((p) => p.id === id);
      if (savedRow) {
        const savedKeys = Array.isArray(savedRow.api_keys)
          ? savedRow.api_keys.map((k) => String(k || "").trim()).filter(Boolean)
          : [];
        if (!savedKeys.length && savedRow.api_key?.trim()) savedKeys.push(savedRow.api_key.trim());
        setDraft({
          ...row,
          ...savedRow,
          api_key: savedKeys[0] || "",
          api_keys: savedKeys,
          api_key_set: Boolean(savedRow.api_key_set) || savedKeys.length > 0,
          api_keys_count: savedKeys.length || savedRow.api_keys_count || 0,
        });
        setDraftApiKeys(savedKeys);
        setKeepStoredApiKey(Boolean(savedRow.api_key_set) && savedKeys.length === 0);
        setUseEnvVar(Boolean(String(savedRow.api_key_env || "").trim()) && savedKeys.length === 0);
        const idx = next.providers.findIndex((p) => p.id === id);
        if (idx >= 0) setEditIndex(idx);
      }
      pushConsoleToast(
        wasNew ? `已添加并保存提供方「${id}」` : `已保存提供方「${id}」`,
        "ok",
      );
    } catch (e) {
      const detail = axiosErrorDetail(e);
      setErr(detail);
      pushConsoleToast(detail || "保存失败", "err");
    } finally {
      setSaving(false);
    }
  }

  async function removeProvider(index: number) {
    const row = doc.providers[index];
    if (!row) return;
    if (
      !(await confirm({
        title: "删除提供方",
        subtitle: `删除提供方「${row.id}」？`,
        confirmLabel: "删除",
      }))
    )
      return;
    setDoc((prev) => {
      const next = cloneDoc(prev);
      next.providers = next.providers.filter((_, i) => i !== index);
      next.routing = pruneRoutingForProvider(next.routing, row.id);
      return next;
    });
    setEditing(false);
    setEditIndex(null);
    setDraft(blankProvider());
    setDraftApiKeys([]);
    setKeepStoredApiKey(false);
    setModels([]);
  }

  function toggleProviderEnabled(index: number, enabled: boolean) {
    setDoc((prev) => {
      const next = cloneDoc(prev);
      const row = next.providers[index];
      if (!row) return prev;
      next.providers[index] = { ...row, enabled };
      return next;
    });
    if (editing && editIndex === index) {
      setDraft((d) => ({ ...d, enabled }));
    }
  }

  async function testProvider(
    id: string,
    opts?: {
      quiet?: boolean;
      base_url?: string;
      api_key?: string;
      api_key_env?: string;
      kind?: string;
      request_method?: string;
    },
  ) {
    const quiet = Boolean(opts?.quiet);
    const pid = id.trim();
    if (!pid) {
      if (!quiet) pushConsoleToast("请先填写提供方 ID", "warn");
      return false;
    }
    if (!quiet) setTestBusy(pid);
    setTestHint((h) => ({ ...h, [pid]: "测试中…" }));
    try {
      const r = await postLlmProviderTest(pid, {
        base_url: opts?.base_url ?? "",
        api_key: opts?.api_key ?? "",
        api_key_env: opts?.api_key_env ?? "",
        kind: opts?.kind ?? "",
        request_method: opts?.request_method ?? "",
      });
      if (r.reachable) {
        const latency =
          r.latency_ms != null ? `，延迟 ${Math.round(r.latency_ms)}ms` : "";
        const disabledNote = r.enabled === false ? "（当前已禁用，仅探测）" : "";
        const hint = `可达${r.latency_ms != null ? ` ${Math.round(r.latency_ms)}ms` : ""}${disabledNote}`;
        setTestHint((h) => ({ ...h, [pid]: hint }));
        if (!quiet) pushConsoleToast(`「${pid}」连通正常${latency}${disabledNote}`, "ok");
        return true;
      }
      const detail = String(r.error || "").trim() || "不可达";
      setTestHint((h) => ({ ...h, [pid]: detail }));
      if (!quiet) pushConsoleToast(`「${pid}」连通失败：${detail}`, "err");
      return false;
    } catch (e) {
      const detail = axiosErrorDetail(e);
      setTestHint((h) => ({ ...h, [pid]: detail }));
      if (!quiet) pushConsoleToast(`「${pid}」测试失败：${detail}`, "err");
      return false;
    } finally {
      if (!quiet) setTestBusy("");
    }
  }

  function draftDiscoverOpts() {
    const flushedKeys = (apiKeysInputRef.current?.flush() ?? draftApiKeys)
      .map((k) => k.trim())
      .filter(Boolean);
    if (flushedKeys.length) setDraftApiKeys(flushedKeys);
    return {
      base_url: draft.base_url,
      api_key: flushedKeys[0] || "",
      api_key_env: useEnvVar ? draft.api_key_env : "",
      kind: draft.kind === "local" ? "local" : "remote",
      request_method: draft.request_method || "",
    };
  }

  async function testDraftProvider() {
    const id = draft.id.trim();
    if (!id) {
      setEditErr("请先填写提供方 ID");
      pushConsoleToast("请先填写提供方 ID", "warn");
      return;
    }
    if (draft.kind !== "local" && !draft.base_url.trim()) {
      setEditErr("远程提供方需要填写 Base URL");
      pushConsoleToast("远程提供方需要填写 Base URL", "warn");
      return;
    }
    await testProvider(id, draftDiscoverOpts());
  }

  async function testAllProviders() {
    const targets = doc.providers.filter((p) => {
      const id = p.id.trim();
      if (!id) return false;
      if (p.enabled === false) return false;
      if (p.kind === "local") return true;
      return Boolean(p.base_url.trim());
    });
    if (!targets.length) {
      pushConsoleToast("暂无已启用的提供方可测", "warn");
      return;
    }
    setTestBusy("__all__");
    let okCount = 0;
    try {
      for (const provider of targets) {
        const ok = await testProvider(provider.id, {
          quiet: true,
          base_url: provider.base_url,
          api_key_env: provider.api_key_env,
          kind: provider.kind === "local" ? "local" : "remote",
          request_method: provider.request_method || "",
        });
        if (ok) okCount += 1;
      }
    } finally {
      setTestBusy("");
    }
    const total = targets.length;
    const failed = total - okCount;
    if (failed === 0) {
      pushConsoleToast(`全部连通正常（${okCount}/${total}）`, "ok");
    } else if (okCount === 0) {
      pushConsoleToast(`全部连通失败（0/${total}）`, "err");
    } else {
      pushConsoleToast(`连通完成：${okCount} 成功，${failed} 失败`, "warn");
    }
  }

  async function refreshModels() {
    const id = draft.id.trim();
    if (!id) {
      setEditErr("请先填写提供方 ID");
      pushConsoleToast("请先填写提供方 ID", "warn");
      return;
    }
    if (draft.kind !== "local" && !draft.base_url.trim()) {
      setEditErr("远程提供方需要填写 Base URL");
      pushConsoleToast("远程提供方需要填写 Base URL", "warn");
      return;
    }
    setModelsBusy(true);
    setEditErr("");
    try {
      const discover = draftDiscoverOpts();
      const r = await fetchLlmProviderModels(id, discover);
      if (!r.ok) {
        const detail = r.error || "模型发现失败";
        setEditErr(detail);
        setModels([]);
        pushConsoleToast(`刷新模型列表失败：${detail}`, "err");
      } else {
        const list = r.models || [];
        setModels(list);
        setProviderModels((prev) => ({ ...prev, [id]: list }));
        pushConsoleToast(
          list.length ? `已发现 ${list.length} 个模型` : "未发现可用模型",
          list.length ? "ok" : "warn",
        );
      }
    } catch (e) {
      const detail = axiosErrorDetail(e);
      setEditErr(detail);
      pushConsoleToast(`刷新模型列表失败：${detail}`, "err");
    } finally {
      setModelsBusy(false);
    }
  }

  function loadTaskProviderModels(provider: LlmProviderRow | undefined) {
    if (!provider || providerModels[provider.id]) return;
    void fetchLlmProviderModels(provider.id, {
      base_url: provider.base_url,
      api_key_env: provider.api_key_env,
      kind: provider.kind === "local" ? "local" : "remote",
      request_method: provider.request_method || "",
    }).then((result) => {
      if (result.ok) setProviderModels((prev) => ({ ...prev, [provider.id]: result.models || [] }));
    }).catch(() => undefined);
  }

  function patchTaskTiers(patch: (prev: TaskTierState) => TaskTierState) {
    setDoc((prev) => applyTaskTiers(cloneDoc(prev), patch(foldTaskTiers(prev))));
  }

  function patchTaskRoutes(patch: (prev: TaskRoutesState) => TaskRoutesState) {
    setDoc((prev) => applyTaskRoutes(cloneDoc(prev), patch(foldTaskRoutes(prev))));
  }

  function updateTaskSlot(
    tier: "high" | "low",
    role: "primary" | "backup",
    patch: Partial<TierProviderSlot>,
  ) {
    patchTaskTiers((prev) => {
      const current = prev[tier][role];
      const nextSlot = { ...current, ...patch };
      if (
        Object.prototype.hasOwnProperty.call(patch, "providerId") &&
        patch.providerId !== current.providerId &&
        !Object.prototype.hasOwnProperty.call(patch, "model")
      ) {
        // 换提供方时清空模型，避免沿用上一提供方的模型名
        nextSlot.model = "";
      }
      return {
        ...prev,
        [tier]: {
          ...prev[tier],
          [role]: nextSlot,
        },
      };
    });
  }

  function updateRoutableTaskSlot(
    task: RoutableTask,
    role: "primary" | "backup",
    patch: Partial<TierProviderSlot>,
  ) {
    patchTaskRoutes((prev) => {
      const current = prev[task][role];
      const nextSlot = { ...current, ...patch };
      if (
        Object.prototype.hasOwnProperty.call(patch, "providerId") &&
        patch.providerId !== current.providerId &&
        !Object.prototype.hasOwnProperty.call(patch, "model")
      ) {
        nextSlot.model = "";
      }
      return {
        ...prev,
        [task]: {
          ...prev[task],
          [role]: nextSlot,
        },
      };
    });
  }

  function renderProviderModelSlot(opts: {
    providerId: string;
    model: string;
    providerAria: string;
    modelPlaceholder: string;
    onProviderChange: (providerId: string) => void;
    onModelChange: (model: string) => void;
    requiredCapability?: LlmProviderCapability;
  }) {
    const requiredCapability = opts.requiredCapability;
    const eligibleProviders = requiredCapability
      ? doc.providers.filter((provider) => provider.capabilities?.includes(requiredCapability))
      : doc.providers;
    return (
      <div className="grid gap-2">
        <AiOptionSelect
          value={opts.providerId}
          onValueChange={(providerId) => {
            opts.onProviderChange(providerId);
            // update*Slot 换提供方时会先清空 model；此处按新提供方决定保留或维持清空
            opts.onModelChange(
              modelAfterProviderChange(providerId, opts.model, doc.providers, providerModels),
            );
            loadTaskProviderModels(doc.providers.find((p) => p.id === providerId));
          }}
          options={eligibleProviders.map((p) => ({
            value: p.id,
            label: p.enabled ? p.id : `${p.id} (停用)`,
          }))}
          placeholder="选择提供方"
          emptyLabel="（未指定）"
          ariaLabel={opts.providerAria}
        />
        <AiModelSelect
          value={opts.model}
          disabled={!opts.providerId}
          options={modelOptionsForProvider(opts.providerId)}
          presetOptions={providerCommonModels(opts.providerId, doc.providers)}
          placeholder={opts.modelPlaceholder}
          onValueChange={opts.onModelChange}
        />
      </div>
    );
  }

  function renderRoutableTaskCard(task: RoutableTask, className?: string) {
    const meta = TASK_ROUTE_META[task];
    const slot = taskRoutes[task];
    return (
      <TierCard
        key={task}
        kind={meta.kind}
        title={meta.title}
        description={meta.description}
        className={className}
        primaryInvalid={!slot.primary.providerId}
        primary={renderProviderModelSlot({
          providerId: slot.primary.providerId,
          model: slot.primary.model,
          providerAria: `${meta.title}主提供方`,
          modelPlaceholder: "任务模型（可空）",
          requiredCapability: meta.capability,
          onProviderChange: (providerId) => updateRoutableTaskSlot(task, "primary", { providerId }),
          onModelChange: (model) => updateRoutableTaskSlot(task, "primary", { model }),
        })}
        backup={renderProviderModelSlot({
          providerId: slot.backup.providerId,
          model: slot.backup.model,
          providerAria: `${meta.title}备用提供方`,
          modelPlaceholder: "备用模型（可空）",
          requiredCapability: meta.capability,
          onProviderChange: (providerId) => updateRoutableTaskSlot(task, "backup", { providerId }),
          onModelChange: (model) => updateRoutableTaskSlot(task, "backup", { model }),
        })}
      />
    );
  }

  function patchLocalTiers(patch: (prev: LocalTierState) => LocalTierState) {
    setLocalDoc((prev) => applyLocalTiers(prev, patch(foldLocalTiers(prev))));
  }

  function modelOptionsForProvider(providerId: string): string[] {
    return listModelsForProvider(providerId, doc.providers, providerModels);
  }

  const selectedPreset =
    draft.kind === "local" ? "custom" : findPresetByBaseUrl(draft.base_url)?.id ?? "custom";

  const activeTabMeta = PROVIDER_TABS.find((t) => t.id === tab) || PROVIDER_TABS[0];

  const chromeMiddle = useMemo(
    () => (
      <>
        <ChromeField label="接入分区" icon={Layers}>
          <Select
            value={tab}
            onValueChange={(v) => {
              preserveShellMainScroll(() => setTab(v as Tab));
            }}
          >
            <SelectTrigger className={CHROME_SELECT_TRIGGER}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {PROVIDER_TABS.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <ChromeOptionLabel icon={t.icon}>{t.label}</ChromeOptionLabel>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ChromeField>
        {tab === "upstream" ? (
          <ChromeField label="费用币种">
            <AiOptionSelect
              className="h-9 min-h-9 w-[7.5rem] shrink-0 sm:w-[8.5rem]"
              value={normalizeDrawCostCurrency(doc.routing.cost_currency)}
              onValueChange={(v) => {
                setDoc((prev) => {
                  const next = cloneDoc(prev);
                  next.routing = {
                    ...next.routing,
                    cost_currency: normalizeDrawCostCurrency(v),
                  };
                  return next;
                });
              }}
              options={COST_CURRENCY_OPTIONS}
              placeholder="币种"
              allowEmpty
              emptyLabel="未设置"
            />
          </ChromeField>
        ) : null}
        {tab === "tasks" ? (
          <ChromeField label="编排视图">
            <Tabs
              value={tasksViewMode}
              onValueChange={(value) => setTasksViewMode(value === "all" ? "all" : "tiers")}
            >
              <TabsList aria-label="任务编排视图" className="task-route-view-tabs h-9">
                <TabsTrigger value="tiers" className="px-2.5 text-xs sm:px-3 sm:text-sm">
                  高低档
                </TabsTrigger>
                <TabsTrigger value="all" className="px-2.5 text-xs sm:px-3 sm:text-sm">
                  全任务
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </ChromeField>
        ) : null}
      </>
    ),
    [tab, doc.routing.cost_currency, tasksViewMode],
  );

  /** 工具条右钉：保存 / 测试共用一个按钮位（在刷新左侧） */
  const chromeTrailing = useMemo(() => {
    if (tab === "runtime") return null;
    if (tab === "routing") {
      return (
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          icon={Save}
          iconMotion="scale"
          disabled={!localDirty || localSaving}
          onClick={() => void saveLocal()}
        >
          {localSaving ? "保存中…" : "保存"}
        </Button>
      );
    }
    if (tab === "tasks" || dirty || saving) {
      return (
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          icon={Save}
          iconMotion="scale"
          disabled={!dirty || saving}
          onClick={() => void saveProviders()}
        >
          {saving ? "保存中…" : "保存"}
        </Button>
      );
    }
    return (
      <Button
        type="button"
        size="sm"
        className="shrink-0"
        icon={Unplug}
        disabled={Boolean(testBusy) || doc.providers.length === 0}
        onClick={() => void testAllProviders()}
      >
        {testBusy === "__all__" ? "测试中…" : "测试"}
      </Button>
    );
  }, [
    tab,
    localDirty,
    localSaving,
    dirty,
    saving,
    testBusy,
    doc.providers.length,
  ]);

  const chromeRefresh = useCallback(() => {
    void load();
    void qc.invalidateQueries({ queryKey: ["llm-model-admin"] });
  }, [qc]);

  useRegisterAiConfigChrome({
    middle: chromeMiddle,
    trailing: chromeTrailing,
    onRefresh: chromeRefresh,
  });

  if (loading) {
    return (
      <>
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">正在加载配置...</CardContent>
        </Card>
        {confirmDialog}
      </>
    );
  }

  const providersFileName = doc.providers_file
    ? doc.providers_file.replace(/\\/g, "/").split("/").pop() || doc.providers_file
    : "";

  return (
    <div className="console-panel-stack">
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {tab === "upstream" ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <AiSectionHeader
                  icon={Cloud}
                  title="模型提供方"
                  lead="管理云端服务商与本地 Ollama 接入。"
                />
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <Badge variant="outline">{doc.providers.length} 个</Badge>
                  {dirty ? <Badge variant="warn">未保存</Badge> : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {doc.providers.map((p, index) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "min-w-0 cursor-pointer overflow-hidden rounded-lg border-2 p-4 text-left transition-all",
                    editIndex === index && editing
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50",
                  )}
                  onClick={() => openEdit(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEdit(index);
                    }
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {p.kind === "local" ? (
                        <HardDrive className="size-5 shrink-0" />
                      ) : (
                        <Cloud className="size-5 shrink-0" />
                      )}
                      <span className="min-w-0 truncate font-medium">{p.id}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={`复制 ${p.id} 为新提供方`}
                        aria-label={`复制 ${p.id} 为新提供方`}
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateProvider(index);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Switch
                        checked={p.enabled}
                        aria-label={`${p.id} 启用`}
                        onCheckedChange={(checked) => toggleProviderEnabled(index, checked)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.base_url || "本地推理端点"}
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                    <Badge variant="outline" className="max-w-full truncate">
                      {p.default_model || "无默认模型"}
                    </Badge>
                    {(p.capabilities || []).map((cap) => (
                      <Badge key={cap} variant="secondary">
                        {LLM_PROVIDER_CAPABILITIES.find((c) => c.id === cap)?.label ?? cap}
                      </Badge>
                    ))}
                    {p.kind !== "local" && !p.api_key_set && !String(p.api_key_env || "").trim() ? (
                      <Badge variant="warn">未配置密钥</Badge>
                    ) : null}
                    {p.api_key_hints?.length ? (
                      <Badge variant="outline" title={`已保存密钥：${p.api_key_hints.join(" · ")}`}>
                        密钥 {p.api_key_hints.join(" · ")}
                      </Badge>
                    ) : null}
                    {testHint[p.id] ? (
                      <Badge
                        variant="outline"
                        title={testHint[p.id]}
                        className="max-w-full min-w-0 whitespace-normal break-all text-left font-normal leading-snug"
                      >
                        {testHint[p.id]}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className={cn(
                  "p-4 rounded-lg border-2 border-dashed transition-all text-left",
                  editing && editIndex === null
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50",
                )}
                onClick={openAdd}
              >
                <Plus className="mb-3 size-5" />
                <div className="font-medium">添加提供方</div>
                <div className="mt-1 text-xs text-muted-foreground">新增配置</div>
              </button>
              {!doc.providers.length ? (
                <p className="col-span-full text-sm text-muted-foreground">暂无已配置的提供方。</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            {!editing ? (
              <CardContent className="flex min-h-60 items-center justify-center text-sm text-muted-foreground">
                请选择提供方或点击添加。
              </CardContent>
            ) : (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="size-5 shrink-0" />
                        {editIndex === null ? "新增提供方" : `编辑 ${draft.id}`}
                      </CardTitle>
                      <CardDescription>
                        {draft.kind === "local"
                          ? "配置本地 Ollama 接口地址。"
                          : "配置云端大模型接口与密钥。"}
                      </CardDescription>
                    </div>
                    <Badge variant={draft.enabled ? "success" : "secondary"}>
                      {draft.enabled ? "启用" : "停用"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {editErr ? <p className="text-destructive">{editErr}</p> : null}

                  <div className="space-y-2">
                    <Label className="font-semibold">提供方类型</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 gap-2"
                        variant={draft.kind !== "local" ? "default" : "outline"}
                        icon={Cloud}
                        onClick={() =>
                          setDraft((d) =>
                            d.kind === "local"
                              ? { ...d, kind: "remote", base_url: d.base_url || "https://api.openai.com/v1" }
                              : d,
                          )
                        }
                      >
                        服务商
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 gap-2"
                        variant={draft.kind === "local" ? "default" : "outline"}
                        icon={HardDrive}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            kind: "local",
                            // 切到本地时丢掉云端预设地址，避免误连；已有本机地址则保留
                            base_url: findPresetByBaseUrl(d.base_url) ? "" : d.base_url,
                          }))
                        }
                      >
                        本地
                      </Button>
                    </div>
                    {draft.kind !== "local" ? (
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {LLM_PROVIDER_PRESETS.filter((p) => p.id !== "custom").map((p) => (
                          <Button
                            key={p.id}
                            type="button"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs"
                            variant={selectedPreset === p.id ? "default" : "outline"}
                            onClick={() => applyPreset(p.id)}
                          >
                            {p.label}
                          </Button>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-full px-3 text-xs"
                          variant={selectedPreset === "custom" ? "default" : "outline"}
                          onClick={() => applyPreset("custom")}
                        >
                          自定义
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold" htmlFor="llm-provider-id">
                      配置名称
                    </Label>
                    <Input
                      id="llm-provider-id"
                      value={draft.id}
                      disabled={editIndex !== null}
                      placeholder={draft.kind === "local" ? "例如 local / ollama" : "例如 deepseek / openai"}
                      onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold" htmlFor="llm-provider-base">
                      {draft.kind === "local" ? "Ollama 地址" : "API 基础 URL"}
                    </Label>
                    <Input
                      id="llm-provider-base"
                      list="llm-provider-base-suggestions"
                      value={draft.base_url}
                      placeholder={
                        draft.kind === "local"
                          ? "http://127.0.0.1:11434"
                          : "https://api.openai.com/v1"
                      }
                      className={
                        draft.kind !== "local" && baseUrlHasTrailingSlash(draft.base_url)
                          ? "border-destructive text-destructive focus-visible:ring-destructive/30"
                          : undefined
                      }
                      onChange={(e) => setDraft((d) => ({ ...d, base_url: e.target.value }))}
                    />
                    <datalist id="llm-provider-base-suggestions">
                      {(draft.kind === "local"
                        ? LLM_LOCAL_BASE_URL_SUGGESTIONS
                        : LLM_BASE_URL_SUGGESTIONS
                      ).map((url) => (
                        <option key={url} value={url} />
                      ))}
                    </datalist>
                    {draft.kind === "local" ? (
                      <p className="text-xs text-muted-foreground">直连本地 Ollama 服务。</p>
                    ) : null}
                    {draft.kind !== "local" && baseUrlHasTrailingSlash(draft.base_url) ? (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        Base URL 末尾带有斜杠「/」，可能导致请求失败，建议移除。
                      </p>
                    ) : null}
                  </div>

                  {draft.kind !== "local" ? (
                    <>
                      {!useEnvVar ? (
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 font-semibold">
                            <Key className="size-4" />
                            API 密钥
                          </Label>
                          <TagsInput
                            ref={apiKeysInputRef}
                            variant="embedded"
                            sortable
                            showPrimaryBadge
                            value={draftApiKeys}
                            readOnlyValues={keepStoredApiKey ? draft.api_key_hints : []}
                            onChange={(keys) => {
                              setDraftApiKeys(keys);
                              if (keys.some((k) => k.trim())) setKeepStoredApiKey(false);
                            }}
                            placeholder={
                              keepStoredApiKey
                                ? "已保存密钥，留空则保留；输入新密钥后回车替换"
                                : "输入 API 密钥后回车添加"
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {keepStoredApiKey
                              ? `已保存密钥${draft.api_key_hints?.length ? `（${draft.api_key_hints.join(" · ")}）` : ""}，留空保存不会清空。`
                              : "可添加多把密钥并拖拽排序；第一位为主用，调用失败时可按序换下一把。"}
                          </p>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="llm-provider-env" className="text-muted-foreground">
                          使用环境变量存放密钥
                        </Label>
                        <Switch id="llm-provider-env" checked={useEnvVar} onCheckedChange={setUseEnvVar} />
                      </div>
                      {useEnvVar ? (
                        <div className="space-y-2">
                          <Label className="font-semibold" htmlFor="llm-provider-env-name">
                            环境变量名
                          </Label>
                          <Input
                            id="llm-provider-env-name"
                            value={draft.api_key_env}
                            placeholder="OPENAI_API_KEY"
                            onChange={(e) => setDraft((d) => ({ ...d, api_key_env: e.target.value }))}
                          />
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-semibold" htmlFor="llm-provider-model">
                      <Server className="size-4" />
                      默认调用模型
                    </Label>
                    <AiModelSelect
                      id="llm-provider-model"
                      value={draft.default_model}
                      options={modelDiscoveryOptionsForProvider(draft.id, [draft], { [draft.id]: models })}
                      presetOptions={providerCommonModels(draft.id, [draft])}
                      isFetching={modelsBusy}
                      onDiscover={() => void refreshModels()}
                      placeholder="选择或输入模型名称"
                      onValueChange={(value) => setDraft((d) => ({ ...d, default_model: value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold">已注册模型</Label>
                    <p className="text-xs text-muted-foreground">任务编排的“常用”会优先展示这里的模型。</p>
                    <div className="space-y-1.5">
                      {(draft.models || []).map((model) => {
                        const modelKey = model.model_id || model.name;
                        const collapsed = Boolean(collapsedModels[modelKey]);
                        return <div key={modelKey} className="space-y-1.5 rounded border border-border/70 px-2.5 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate font-mono text-xs">{model.name}</span>
                            <div className="flex shrink-0 items-center gap-1">
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      icon={collapsed ? ChevronDown : ChevronUp}
                                      aria-label={collapsed ? `展开 ${model.name}` : `收起 ${model.name}`}
                                      onClick={() => setCollapsedModels((current) => ({ ...current, [modelKey]: !collapsed }))}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>{collapsed ? "展开模型配置" : "收起模型配置"}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                icon={Trash2}
                                onClick={() => removeRegisteredProviderModel(model.name)}
                              >
                                删除模型
                              </Button>
                            </div>
                          </div>
                          {collapsed ? (
                            <div className="space-y-1 text-xs text-muted-foreground">
                              {(model.pricing_rules || []).length ? (
                                (model.pricing_rules || []).map((rule) => (
                                  <p key={rule.id} className="truncate font-mono">
                                    {formatPricingRuleSummary(rule)}
                                  </p>
                                ))
                              ) : (
                                <p>未配置价格条件</p>
                              )}
                            </div>
                          ) : <>
                          {(model.pricing_rules || []).map((rule) => (
                            <div key={rule.id} className="space-y-2 rounded bg-muted/20 p-2 text-xs text-muted-foreground">
                              <div className="flex items-center justify-between gap-2">
                                <Select value={rule.kind} onValueChange={(value) => setPricingRuleKind(model.name, rule.id, value as LlmProviderPricingRule["kind"])}>
                                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectItem value="token">按 Token</SelectItem><SelectItem value="per_request">按次</SelectItem></SelectContent>
                                </Select>
                                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" icon={Trash2} onClick={() => removePricingRule(model.name, rule.id)}>删除</Button>
                              </div>
                              {rule.kind === "per_request" ? (
                                <DecimalPriceInput className="h-8 font-mono text-xs" value={rule.price_per_request} placeholder="每次费用" onValueChange={(value) => setPricingRuleValue(model.name, rule.id, "price_per_request", value)} />
                              ) : (
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  <ModelPriceField label={AI_TOKEN_METRIC_LABELS.prompt} value={rule.price_in} onValueChange={(value) => setPricingRuleValue(model.name, rule.id, "price_in", value)} />
                                  <ModelPriceField label={AI_TOKEN_METRIC_LABELS.completion} value={rule.price_out} onValueChange={(value) => setPricingRuleValue(model.name, rule.id, "price_out", value)} />
                                  <ModelPriceField label={AI_TOKEN_METRIC_LABELS.cacheRead} value={rule.cache_price_in} onValueChange={(value) => setPricingRuleValue(model.name, rule.id, "cache_price_in", value)} />
                                  <ModelPriceField label={AI_TOKEN_METRIC_LABELS.cacheWrite} value={rule.cache_price_out} onValueChange={(value) => setPricingRuleValue(model.name, rule.id, "cache_price_out", value)} />
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                <Input className="h-8 font-mono text-xs" inputMode="numeric" value={rule.input_tokens_min || ""} placeholder="输入 >=（可空）" onChange={(event) => setPricingRuleValue(model.name, rule.id, "input_tokens_min", parseModelPrice(event.target.value))} />
                                <Input className="h-8 font-mono text-xs" inputMode="numeric" value={rule.input_tokens_max || ""} placeholder="输入 <=（可空）" onChange={(event) => setPricingRuleValue(model.name, rule.id, "input_tokens_max", parseModelPrice(event.target.value))} />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <DailyTimeSelect label="开始时间" value={rule.daily_start} onValueChange={(value) => setPricingRuleText(model.name, rule.id, "daily_start", value)} />
                                <DailyTimeSelect label="结束时间" value={rule.daily_end} onValueChange={(value) => setPricingRuleText(model.name, rule.id, "daily_end", value)} />
                              </div>
                            </div>
                          ))}
                          <Button type="button" size="sm" variant="outline" className="h-8" icon={Plus} onClick={() => addPricingRule(model.name)}>添加价格条件</Button>
                          </>}
                        </div>
                      })}
                    </div>
                    <div>
                      <AiModelSelect
                        value={registeredModelDraft}
                        options={modelDiscoveryOptionsForProvider(draft.id, [draft], { [draft.id]: models })}
                        presetOptions={providerCommonModels(draft.id, [draft])}
                        isFetching={modelsBusy}
                        onDiscover={() => void refreshModels()}
                        placeholder="选择或输入模型名，选中后即加入已注册模型"
                        onValueChange={registerProviderModel}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 font-semibold">
                      <span className="inline-flex size-4 items-center justify-center text-xs font-semibold">✦</span>
                      模型支持能力
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {LLM_PROVIDER_CAPABILITIES_EDITABLE.map((cap) => {
                        const active = (draft.capabilities || []).includes(cap.id);
                        return (
                          <Button
                            key={cap.id}
                            type="button"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs"
                            variant={active ? "default" : "outline"}
                            onClick={() => toggleCapability(cap.id)}
                          >
                            {cap.label}
                          </Button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      「图像」表示可直接看图；未勾选时含图消息会改文字描述。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold" htmlFor="llm-provider-effort">
                      模型思考强度
                    </Label>
                    <Select
                      value={draft.model_effort || "default"}
                      onValueChange={(value) =>
                        setDraft((d) => ({
                          ...d,
                          model_effort: value === "default" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id="llm-provider-effort">
                        <SelectValue placeholder="默认" />
                      </SelectTrigger>
                      <SelectContent>
                        {LLM_PROVIDER_MODEL_EFFORTS.map((item) => (
                          <SelectItem key={item.id || "default"} value={item.id || "default"}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      控制模型在回答前投入多少推理；具体档位由各厂商 API 解释，不支持时会被忽略。
                    </p>
                    {selectedPreset === "deepseek" ? (
                      <p className="text-xs text-muted-foreground">
                        DeepSeek：未选档位时默认关思考；选「开启」或具体强度后可与工具调用同开（强制
                        tool_choice=required 的那一轮仍会关）。
                      </p>
                    ) : null}
                  </div>

                  {draft.kind !== "local" ? (
                    <div className="space-y-2">
                      <Label className="font-semibold" htmlFor="llm-provider-request-method">
                        请求方式
                      </Label>
                      <Select
                        value={draft.request_method || "chat_completions"}
                        onValueChange={(value) => setDraft((d) => ({ ...d, request_method: value }))}
                      >
                        <SelectTrigger id="llm-provider-request-method">
                          <SelectValue placeholder="Chat Completions" />
                        </SelectTrigger>
                        <SelectContent>
                          {LLM_PROVIDER_REQUEST_METHODS.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-2 border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] pt-3">
                    {editing ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={Unplug}
                          disabled={Boolean(testBusy)}
                          onClick={() => void testDraftProvider()}
                        >
                          {testBusy ? "测试中…" : "测试"}
                        </Button>
                        {editIndex !== null ? (
                          <Button type="button" variant="destructive" size="sm" icon={Trash2} onClick={() => void removeProvider(editIndex)}>
                            删除
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={X}
                      iconMotion="close"
                      onClick={() => {
                        setEditing(false);
                        setEditIndex(null);
                        setEditErr("");
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      icon={Save}
                      iconMotion="scale"
                      disabled={saving}
                      onClick={() => void submitEdit()}
                    >
                      {saving ? "保存中…" : "保存"}
                    </Button>
                  </div>
                </CardContent>
                  </>
                )}
            {doc.providers_file ? (
              <CardFooter className="justify-start gap-2 border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-5 py-2.5 text-xs text-muted-foreground">
                <span className="shrink-0">配置文件路径</span>
                <code className="min-w-0 truncate font-mono text-[11px]" title={doc.providers_file}>
                  {providersFileName || "llm_providers.json"}
                </code>
              </CardFooter>
            ) : null}
          </Card>
        </>
          ) : null}

      {tab !== "upstream" ? (
        <AiConfigSectionCard contentClassName="space-y-5">
          <AiSectionHeader
            icon={activeTabMeta.icon}
            title={activeTabMeta.label}
            lead={
              tab === "tasks"
                ? "高低两档即对应任务组；改档会同步全任务列表。运行时若同任务既有全任务备用又有档位备用，优先全任务。"
                : tab === "runtime"
                  ? "切换本机 Ollama 模型与 GPU 层数。"
                  : activeTabMeta.lead
            }
            action={
              tab === "routing" ? (
                <div className="flex items-center gap-2">
                  <Label htmlFor="llm-local-multi-model" className="text-xs font-normal text-muted-foreground">
                    启用 Ollama 多模型
                  </Label>
                  <Switch
                    id="llm-local-multi-model"
                    checked={Boolean(localDoc.local_multi_model_enabled)}
                    onCheckedChange={(checked) =>
                      setLocalDoc((d) => ({ ...d, local_multi_model_enabled: checked }))
                    }
                  />
                </div>
              ) : tab === "tasks" ? (
                <Button type="button" size="sm" variant="outline" icon={SlidersHorizontal} iconMotion="settings" onClick={() => setTab("upstream")}>
                  管理提供方
                </Button>
              ) : undefined
            }
          />
          {tab === "tasks" ? (
            <div className="space-y-4">
              {providerIds.length === 0 ? (
                <div className="flex items-start gap-3 rounded-[var(--radius-control,8px)] border border-destructive/40 bg-destructive/5 p-4">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-medium text-destructive">暂无可用提供方</p>
                    <p className="text-xs text-destructive/80">请先添加模型提供方，再进行任务编排。</p>
                    <Button type="button" size="sm" variant="outline" icon={Plus} onClick={() => setTab("upstream")}>
                      前往提供方
                    </Button>
                  </div>
                </div>
              ) : tasksViewMode === "tiers" ? (
                <>
                  <TierPairCards
                    high={
                      <TierCard
                        kind="high"
                        title="高级任务"
                        description="对话、醉聊、完整润色"
                        primaryInvalid={!taskTiers.high.primary.providerId}
                        primary={renderProviderModelSlot({
                          providerId: taskTiers.high.primary.providerId,
                          model: taskTiers.high.primary.model,
                          providerAria: "高级任务主提供方",
                          modelPlaceholder: "任务模型（可空）",
                          onProviderChange: (providerId) => updateTaskSlot("high", "primary", { providerId }),
                          onModelChange: (model) => updateTaskSlot("high", "primary", { model }),
                        })}
                        backup={renderProviderModelSlot({
                          providerId: taskTiers.high.backup.providerId,
                          model: taskTiers.high.backup.model,
                          providerAria: "高级任务备用提供方",
                          modelPlaceholder: "备用模型（可空）",
                          onProviderChange: (providerId) => updateTaskSlot("high", "backup", { providerId }),
                          onModelChange: (model) => updateTaskSlot("high", "backup", { model }),
                        })}
                      />
                    }
                    low={
                      <TierCard
                        kind="low"
                        title="低级任务"
                        description="选句、轻润色、兜底、群情感与本轮动作决策"
                        primaryInvalid={!taskTiers.low.primary.providerId}
                        primary={renderProviderModelSlot({
                          providerId: taskTiers.low.primary.providerId,
                          model: taskTiers.low.primary.model,
                          providerAria: "低级任务主提供方",
                          modelPlaceholder: "任务模型（可空）",
                          onProviderChange: (providerId) => updateTaskSlot("low", "primary", { providerId }),
                          onModelChange: (model) => updateTaskSlot("low", "primary", { model }),
                        })}
                        backup={renderProviderModelSlot({
                          providerId: taskTiers.low.backup.providerId,
                          model: taskTiers.low.backup.model,
                          providerAria: "低级任务备用提供方",
                          modelPlaceholder: "备用模型（可空）",
                          onProviderChange: (providerId) => updateTaskSlot("low", "backup", { providerId }),
                          onModelChange: (model) => updateTaskSlot("low", "backup", { model }),
                        })}
                      />
                    }
                  />
                  <div className="mt-4">{renderRoutableTaskCard("sticker_vision")}</div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {ALL_ROUTABLE_TASKS.map((task) =>
                    renderRoutableTaskCard(task, task === "sticker_vision" ? "col-span-full" : undefined),
                  )}
                </div>
              )}
            </div>
          ) : null}

          {tab === "runtime" ? <AiModelAdminPanel embedded /> : null}

          {tab === "routing" ? (
            <div className="space-y-4">
              {!localDoc.local_multi_model_enabled ? (
                <AiConfigField label="默认 Ollama 模型">
                  <AiModelSelect
                    value={localDoc.llm_model || ""}
                    options={ollamaModels}
                    onValueChange={(value) => setLocalDoc((d) => ({ ...d, llm_model: value }))}
                  />
                </AiConfigField>
              ) : (
                <TierPairCards
                  high={
                    <TierCard
                      kind="high"
                      title="重负载模型（Ollama）"
                      description="本机复杂推理与看图"
                      primaryLabel="复杂档"
                      primaryDescription="处理偏重文本推理"
                      backupLabel="视觉档"
                      backupDescription="处理识图请求，留空则共用复杂档"
                      primaryInvalid={!localTiers.high.primary}
                      primary={
                        <AiModelSelect
                          value={localTiers.high.primary}
                          options={ollamaModels}
                          placeholder="选择复杂档模型"
                          onValueChange={(primary) =>
                            patchLocalTiers((prev) => ({
                              ...prev,
                              high: { ...prev.high, primary },
                            }))
                          }
                        />
                      }
                      backup={
                        <AiModelSelect
                          value={localTiers.high.backup}
                          options={ollamaModels}
                          placeholder="可选，默认与复杂相同"
                          onValueChange={(backup) =>
                            patchLocalTiers((prev) => ({
                              ...prev,
                              high: { ...prev.high, backup },
                            }))
                          }
                        />
                      }
                    />
                  }
                  low={
                    <TierCard
                      kind="low"
                      title="轻负载模型（Ollama）"
                      description="本机日常问答与快速响应"
                      primaryLabel="中等档"
                      primaryDescription="处理普通聊天与中等难度请求"
                      backupLabel="简单档"
                      backupDescription="处理最轻量请求，留空则共用中等档"
                      primaryInvalid={!localTiers.low.primary}
                      primary={
                        <AiModelSelect
                          value={localTiers.low.primary}
                          options={ollamaModels}
                          placeholder="选择中等档模型"
                          onValueChange={(primary) =>
                            patchLocalTiers((prev) => ({
                              ...prev,
                              low: { ...prev.low, primary },
                            }))
                          }
                        />
                      }
                      backup={
                        <AiModelSelect
                          value={localTiers.low.backup}
                          options={ollamaModels}
                          placeholder="可选，默认与中等相同"
                          onValueChange={(backup) =>
                            patchLocalTiers((prev) => ({
                              ...prev,
                              low: { ...prev.low, backup },
                            }))
                          }
                        />
                      }
                    />
                  }
                />
              )}
              {localDirty ? <Badge variant="warn">Ollama 分档未保存</Badge> : null}
            </div>
          ) : null}
        </AiConfigSectionCard>
      ) : null}
      {confirmDialog}
    </div>
  );
}
