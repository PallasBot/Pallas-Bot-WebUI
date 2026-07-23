import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchLlmLocalRoutingConfig,
  fetchLlmProviderModels,
  fetchLlmProvidersConfig,
  postLlmProviderTest,
  putLlmLocalRoutingConfig,
  putLlmProvidersConfig,
  type LlmLocalRoutingConfig,
  type LlmProviderRow,
  type LlmProvidersConfig,
} from "@/api/console";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import AiConfigField, { AiModelSelect } from "@/components/ai/AiConfigField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_LLM_TASKS,
  LLM_PROVIDER_PRESETS,
  applyPresetToDraft,
  blankProvider,
  findPresetByBaseUrl,
  llmTaskRouteLabel,
  pruneRoutingForProvider,
  type LlmProviderPresetId,
} from "@/config/llmProviderPresets";

type Tab = "upstream" | "tasks" | "local";

const PROVIDER_TABS: Array<{ id: Tab; label: string }> = [
  { id: "upstream", label: "上游 Provider" },
  { id: "tasks", label: "任务编排" },
  { id: "local", label: "本地路由" },
];

function cloneDoc(doc: LlmProvidersConfig): LlmProvidersConfig {
  return JSON.parse(JSON.stringify(doc)) as LlmProvidersConfig;
}

function emptyDoc(): LlmProvidersConfig {
  return { providers: [], routing: { chain_fallback: [], tasks: {} }, providers_file: "", file_exists: false };
}

export default function LlmProvidersForm() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("upstream");
  const [doc, setDoc] = useState<LlmProvidersConfig>(emptyDoc());
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [testBusy, setTestBusy] = useState<string>("");
  const [testHint, setTestHint] = useState<Record<string, string>>({});

  const [editing, setEditing] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<LlmProviderRow>(blankProvider());
  const [draftApiKey, setDraftApiKey] = useState("");
  const [useEnvVar, setUseEnvVar] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [providerModels, setProviderModels] = useState<Record<string, string[]>>({});

  const [localDoc, setLocalDoc] = useState<LlmLocalRoutingConfig>({});
  const [localBaseline, setLocalBaseline] = useState("");
  const [localSaving, setLocalSaving] = useState(false);

  const dirty = useMemo(() => JSON.stringify(doc) !== baseline, [doc, baseline]);
  const localDirty = useMemo(() => JSON.stringify(localDoc) !== localBaseline, [localDoc, localBaseline]);
  const providerIds = doc.providers.map((p) => p.id);
  const knownModels = useMemo(() => {
    const values = new Set<string>();
    for (const p of doc.providers) {
      if (p.default_model) values.add(p.default_model);
      for (const model of Object.values(p.task_models || {})) if (model) values.add(model);
      for (const model of providerModels[p.id] || []) if (model) values.add(model);
    }
    for (const model of Object.values(localDoc.moe_models || {})) if (model) values.add(model);
    for (const model of Object.values(localDoc.task_models || {})) if (model) values.add(model);
    if (localDoc.llm_model) values.add(localDoc.llm_model);
    return [...values];
  }, [doc.providers, localDoc, providerModels]);

  const taskKeys = useMemo(() => {
    const set = new Set<string>([...DEFAULT_LLM_TASKS, ...Object.keys(doc.routing.tasks || {})]);
    for (const p of doc.providers) {
      for (const k of Object.keys(p.task_models || {})) set.add(k);
    }
    return [...set];
  }, [doc]);

  async function load() {
    setLoading(true);
    setErr("");
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
      setErr(axiosErrorDetail(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (tab !== "local") return;
    const provider = doc.providers.find((p) => p.kind === "local") || doc.providers.find((p) => p.id === "local");
    if (!provider || providerModels[provider.id]) return;
    void fetchLlmProviderModels(provider.id, {
      base_url: provider.base_url,
      api_key_env: provider.api_key_env,
      kind: "local",
    }).then((result) => {
      if (result.ok) setProviderModels((prev) => ({ ...prev, [provider.id]: result.models || [] }));
    }).catch(() => undefined);
  }, [tab, doc.providers, providerModels]);

  async function saveProviders() {
    if (!dirty || saving) return;
    setSaving(true);
    setErr("");
    setOkMsg("");
    try {
      const result = await putLlmProvidersConfig(cloneDoc(doc));
      setOkMsg(result.providers_file ? `已保存 → ${result.providers_file}` : "已保存提供方配置");
      await load();
    } catch (e) {
      setErr(axiosErrorDetail(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveLocal() {
    if (!localDirty || localSaving) return;
    setLocalSaving(true);
    setErr("");
    setOkMsg("");
    try {
      const saved = await putLlmLocalRoutingConfig(localDoc);
      setLocalDoc(saved);
      setLocalBaseline(JSON.stringify(saved));
      setOkMsg("已保存本地路由");
    } catch (e) {
      setErr(axiosErrorDetail(e));
    } finally {
      setLocalSaving(false);
    }
  }

  function openAdd() {
    setEditIndex(null);
    setDraft(blankProvider());
    setDraftApiKey("");
    setUseEnvVar(false);
    setEditErr("");
    setModels([]);
    setEditing(true);
  }

  function openEdit(index: number) {
    const row = doc.providers[index];
    if (!row) return;
    setEditIndex(index);
    setDraft(JSON.parse(JSON.stringify(row)) as LlmProviderRow);
    setDraftApiKey("");
    setUseEnvVar(Boolean(row.api_key_env?.trim()) && !row.api_key_set);
    setEditErr("");
    setModels([]);
    setEditing(true);
  }

  function applyPreset(id: LlmProviderPresetId) {
    setDraft((prev) => {
      const next = applyPresetToDraft(id, prev);
      if (editIndex === null && !prev.id.trim() && id !== "custom") {
        next.id = id;
      }
      return next;
    });
  }

  function submitEdit() {
    const id = draft.id.trim();
    if (!id) {
      setEditErr("请填写 Provider ID");
      return;
    }
    if (editIndex === null && providerIds.includes(id)) {
      setEditErr(`Provider ID「${id}」已存在`);
      return;
    }
    const kind = draft.kind === "local" ? "local" : draft.kind || "remote";
    if (kind !== "local" && !draft.base_url.trim()) {
      setEditErr("远程 Provider 需要填写 Base URL");
      return;
    }
    const apiKey = draftApiKey.trim();
    const apiKeyEnv = useEnvVar ? draft.api_key_env.trim() : "";
    if (kind !== "local") {
      const hasStored = Boolean(editIndex !== null && draft.api_key_set);
      if (!apiKey && !apiKeyEnv && !hasStored) {
        setEditErr("请填写 API Key，或改用环境变量");
        return;
      }
    }
    const row: LlmProviderRow = {
      ...draft,
      id,
      kind,
      base_url: draft.base_url.trim(),
      api_key: apiKey,
      api_key_env: apiKeyEnv,
      default_model: draft.default_model.trim(),
      task_models: { ...(draft.task_models || {}) },
    };
    const nextDoc = cloneDoc(doc);
    if (editIndex === null) nextDoc.providers = [...nextDoc.providers, row];
    else {
      nextDoc.providers = [...nextDoc.providers];
      nextDoc.providers[editIndex] = row;
    }
    const nextIndex = editIndex === null ? nextDoc.providers.length - 1 : editIndex;
    setDoc(nextDoc);
    setEditIndex(nextIndex);
    setEditing(true);
    // 有密钥变更时立即落盘，避免「应用」但未保存
    if (apiKey || apiKeyEnv) {
      void (async () => {
        setSaving(true);
        setErr("");
        try {
          await putLlmProvidersConfig(nextDoc);
          setOkMsg("已保存提供方（含密钥）");
          await load();
        } catch (e) {
          setErr(axiosErrorDetail(e));
        } finally {
          setSaving(false);
        }
      })();
    }
  }

  function removeProvider(index: number) {
    const row = doc.providers[index];
    if (!row) return;
    if (!window.confirm(`删除 Provider「${row.id}」？`)) return;
    setDoc((prev) => {
      const next = cloneDoc(prev);
      next.providers = next.providers.filter((_, i) => i !== index);
      next.routing = pruneRoutingForProvider(next.routing, row.id);
      return next;
    });
    setEditing(false);
    setEditIndex(null);
    setDraft(blankProvider());
    setDraftApiKey("");
    setModels([]);
  }

  async function testProvider(id: string) {
    setTestBusy(id);
    setTestHint((h) => ({ ...h, [id]: "测试中…" }));
    try {
      const r = await postLlmProviderTest(id);
      setTestHint((h) => ({
        ...h,
        [id]: r.reachable
          ? `可达${r.latency_ms != null ? ` ${Math.round(r.latency_ms)}ms` : ""}`
          : r.error || "不可达",
      }));
    } catch (e) {
      setTestHint((h) => ({ ...h, [id]: axiosErrorDetail(e) }));
    } finally {
      setTestBusy("");
    }
  }

  async function refreshModels() {
    const id = draft.id.trim();
    if (!id) {
      setEditErr("请先填写 Provider ID");
      return;
    }
    if (draft.kind !== "local" && !draft.base_url.trim()) {
      setEditErr("远程 Provider 需要填写 Base URL");
      return;
    }
    setModelsBusy(true);
    setEditErr("");
    try {
      const r = await fetchLlmProviderModels(id, {
        base_url: draft.base_url,
        api_key: draftApiKey,
        api_key_env: useEnvVar ? draft.api_key_env : "",
        kind: draft.kind === "local" ? "local" : "openai-compatible",
      });
      if (!r.ok) {
        setEditErr(r.error || "模型发现失败");
        setModels([]);
      } else {
        setModels(r.models || []);
        setProviderModels((prev) => ({ ...prev, [id]: r.models || [] }));
      }
    } catch (e) {
      setEditErr(axiosErrorDetail(e));
    } finally {
      setModelsBusy(false);
    }
  }

  function loadTaskProviderModels(provider: LlmProviderRow | undefined) {
    if (!provider || providerModels[provider.id]) return;
    void fetchLlmProviderModels(provider.id, {
      base_url: provider.base_url,
      api_key_env: provider.api_key_env,
      kind: provider.kind === "local" ? "local" : "openai-compatible",
    }).then((result) => {
      if (result.ok) setProviderModels((prev) => ({ ...prev, [provider.id]: result.models || [] }));
    }).catch(() => undefined);
  }

  function setTaskRoute(task: string, providerId: string) {
    setDoc((prev) => {
      const next = cloneDoc(prev);
      const tasks = { ...next.routing.tasks };
      if (providerId) tasks[task] = providerId;
      else delete tasks[task];
      next.routing.tasks = tasks;
      return next;
    });
  }

  function setTaskModel(task: string, providerId: string, model: string) {
    if (!providerId) return;
    setDoc((prev) => {
      const next = cloneDoc(prev);
      if (!next.routing.tasks[task]) next.routing.tasks[task] = providerId;
      const idx = next.providers.findIndex((p) => p.id === providerId);
      if (idx < 0) return next;
      const row = next.providers[idx];
      const task_models = { ...(row.task_models || {}) };
      const trimmed = model.trim();
      if (trimmed) task_models[task] = trimmed;
      else delete task_models[task];
      next.providers[idx] = { ...row, task_models };
      return next;
    });
  }

  function toggleChain(id: string) {
    setDoc((prev) => {
      const next = cloneDoc(prev);
      const cur = next.routing.chain_fallback || [];
      next.routing.chain_fallback = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return next;
    });
  }

  const selectedPreset =
    draft.kind === "local" ? "custom" : findPresetByBaseUrl(draft.base_url)?.id ?? "custom";

  const chromeMiddle = useMemo(
    () => (
      <div
        className="console-view-toggle console-view-toggle--toolbar-seg shrink-0"
        role="group"
        aria-label="接入分区"
      >
        {PROVIDER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "is-on" : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    ),
    [tab],
  );

  const chromeTrailing = useMemo(
    () =>
      tab === "local" ? (
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={!localDirty || localSaving}
          onClick={() => void saveLocal()}
        >
          {localSaving ? "保存中…" : "保存本地路由"}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={!dirty || saving}
          onClick={() => void saveProviders()}
        >
          {saving ? "保存中…" : dirty ? "保存提供方" : "已是最新"}
        </Button>
      ),
    [tab, localDirty, localSaving, dirty, saving],
  );

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
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">加载 LLM 配置…</CardContent>
      </Card>
    );
  }

  const providersFileName = doc.providers_file
    ? doc.providers_file.replace(/\\/g, "/").split("/").pop() || doc.providers_file
    : "";

  return (
    <>
      <Card>
        <CardHeader className="space-y-2 pb-3">
          {okMsg ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{okMsg}</p> : null}
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <CardDescription>
            {tab === "upstream"
              ? "上游模型提供方"
              : tab === "tasks"
                ? "任务编排与 Fallback"
                : "本地模型路由"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {tab === "upstream" ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(14rem,0.8fr)_minmax(0,1.5fr)]">
              <Card className="h-fit">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Button size="sm" onClick={openAdd}>
                      添加 Provider
                    </Button>
                    <Badge variant="outline">{doc.providers.length} 个</Badge>
                    {dirty ? <Badge variant="warn">未保存</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {doc.providers.map((p, index) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full rounded-[var(--radius-control,8px)] border-l-2 px-3 py-2 text-left transition-colors ${
                        editIndex === index && editing
                          ? "border-l-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                          : "border-l-transparent hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]"
                      }`}
                      onClick={() => openEdit(index)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{p.id}</div>
                          <div className="truncate font-mono text-xs text-muted-foreground">
                            {p.kind} · {p.base_url || "(local)"}
                          </div>
                        </div>
                        <Badge variant={p.enabled ? "success" : "secondary"}>
                          {p.enabled ? "启用" : "停用"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                        <Badge variant="outline">{p.default_model || "无默认模型"}</Badge>
                        <Badge variant={p.api_key_set || p.api_key_env ? "secondary" : "warn"}>
                          {p.api_key_set ? "密钥已配置" : p.api_key_env ? `env:${p.api_key_env}` : "无密钥"}
                        </Badge>
                        {testHint[p.id] ? <Badge variant="outline">{testHint[p.id]}</Badge> : null}
                      </div>
                    </button>
                  ))}
                  {!doc.providers.length ? <p className="py-2 text-sm text-muted-foreground">还没有 Provider</p> : null}
                </CardContent>
              </Card>

              <Card>
                {!editing ? (
                  <CardContent className="flex min-h-60 items-center justify-center text-sm text-muted-foreground">
                    选择左侧 Provider，或点添加
                  </CardContent>
                ) : (
                  <>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="text-base font-medium">
                            {editIndex === null ? "添加 Provider" : `编辑 ${draft.id}`}
                          </div>
                          <CardDescription>
                            {draft.kind === "local"
                              ? "本地推理端点，一般不需要 API Key。"
                              : "云端或 OpenAI 兼容网关；填好后点「应用」写入草稿，再保存提供方。"}
                          </CardDescription>
                        </div>
                        {editIndex !== null ? (
                          <Badge variant={draft.enabled ? "success" : "secondary"}>
                            {draft.enabled ? "启用" : "停用"}
                          </Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      {editErr ? <p className="text-destructive">{editErr}</p> : null}
                      <div className="space-y-1.5">
                        <Label>快捷预设</Label>
                        <p className="text-xs text-muted-foreground">
                          一键填入常见厂商的 Base URL 与类型；选「本地」则走本机端点。
                        </p>
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {LLM_PROVIDER_PRESETS.map((p) => (
                            <Button
                              key={p.id}
                              size="sm"
                              variant={selectedPreset === p.id ? "default" : "outline"}
                              onClick={() => applyPreset(p.id)}
                            >
                              {p.label}
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            variant={draft.kind === "local" ? "default" : "outline"}
                            onClick={() => setDraft((d) => ({ ...d, kind: "local", base_url: "" }))}
                          >
                            本地
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="llm-provider-id">Provider ID</Label>
                        <p className="text-xs text-muted-foreground">
                          配置内唯一标识，创建后不可改；任务编排与 Fallback 会引用此 ID。
                        </p>
                        <Input
                          id="llm-provider-id"
                          value={draft.id}
                          disabled={editIndex !== null}
                          placeholder="例如 deepseek / local"
                          onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
                        />
                      </div>
                      {draft.kind !== "local" ? (
                        <div className="space-y-1.5">
                          <Label htmlFor="llm-provider-base">Base URL</Label>
                          <p className="text-xs text-muted-foreground">
                            OpenAI 兼容 API 根地址，通常以 /v1 结尾（按厂商文档填写）。
                          </p>
                          <Input
                            id="llm-provider-base"
                            value={draft.base_url}
                            placeholder="https://api.example.com/v1"
                            onChange={(e) => setDraft((d) => ({ ...d, base_url: e.target.value }))}
                          />
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control,8px)] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-3 py-2.5">
                        <div className="min-w-0 space-y-0.5">
                          <Label htmlFor="llm-provider-enabled">启用</Label>
                          <p className="text-xs text-muted-foreground">关闭后不会参与任务路由与探测。</p>
                        </div>
                        <Switch
                          id="llm-provider-enabled"
                          checked={draft.enabled}
                          onCheckedChange={(checked) => setDraft((d) => ({ ...d, enabled: checked }))}
                        />
                      </div>
                      {draft.kind !== "local" ? (
                        <>
                          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control,8px)] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-3 py-2.5">
                            <div className="min-w-0 space-y-0.5">
                              <Label htmlFor="llm-provider-env">使用环境变量存放密钥</Label>
                              <p className="text-xs text-muted-foreground">
                                打开后只存变量名，密钥从运行环境读取，避免写入配置文件。
                              </p>
                            </div>
                            <Switch id="llm-provider-env" checked={useEnvVar} onCheckedChange={setUseEnvVar} />
                          </div>
                          {useEnvVar ? (
                            <div className="space-y-1.5">
                              <Label htmlFor="llm-provider-env-name">环境变量名</Label>
                              <p className="text-xs text-muted-foreground">
                                例如 OPENAI_API_KEY；需在进程环境中事先设置该变量。
                              </p>
                              <Input
                                id="llm-provider-env-name"
                                value={draft.api_key_env}
                                placeholder="OPENAI_API_KEY"
                                onChange={(e) => setDraft((d) => ({ ...d, api_key_env: e.target.value }))}
                              />
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <Label htmlFor="llm-provider-key">API Key</Label>
                              <p className="text-xs text-muted-foreground">
                                {draft.api_key_set
                                  ? "已保存过密钥；留空表示保持不变，填写则覆盖。"
                                  : "调用上游所需的密钥；应用时若填写会立即落盘。"}
                              </p>
                              <Input
                                id="llm-provider-key"
                                type="password"
                                autoComplete="new-password"
                                value={draftApiKey}
                                placeholder="sk-…"
                                onChange={(e) => setDraftApiKey(e.target.value)}
                              />
                            </div>
                          )}
                        </>
                      ) : null}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <Label htmlFor="llm-provider-model">默认模型</Label>
                            <p className="text-xs text-muted-foreground">
                              未为任务单独指定模型时使用；可「刷新模型列表」后下拉选择。
                            </p>
                          </div>
                          <Button size="sm" variant="outline" disabled={modelsBusy} onClick={() => void refreshModels()}>
                            {modelsBusy ? "发现中…" : "刷新模型列表"}
                          </Button>
                        </div>
                        <AiModelSelect
                          id="llm-provider-model"
                          value={draft.default_model}
                          options={models}
                          placeholder="从列表选择默认模型"
                          onValueChange={(value) => setDraft((d) => ({ ...d, default_model: value }))}
                        />
                      </div>
                      <div className="flex flex-wrap justify-end gap-2 border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] pt-3">
                        {editIndex !== null ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={testBusy === draft.id}
                              onClick={() => void testProvider(draft.id)}
                            >
                              测试
                            </Button>
                            <Button type="button" variant="destructive" size="sm" onClick={() => removeProvider(editIndex)}>
                              删除
                            </Button>
                          </>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing(false);
                            setEditIndex(null);
                            setEditErr("");
                          }}
                        >
                          取消
                        </Button>
                        <Button type="button" size="sm" onClick={submitEdit}>
                          应用
                        </Button>
                      </div>
                    </CardContent>
                  </>
                )}
              </Card>
            </div>
          ) : null}

          {tab === "tasks" ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium">任务 → Provider</h3>
                  <p className="text-xs text-muted-foreground">
                    可同时指定该 Provider 上的任务模型（写入 task_models）
                  </p>
                </div>
                {taskKeys.map((task) => {
                  const pid = doc.routing.tasks[task] || "";
                  const provider = doc.providers.find((p) => p.id === pid);
                  const model = provider?.task_models?.[task] || "";
                  return (
                    <div
                      key={task}
                      className="grid gap-2 rounded-[var(--radius-control,8px)] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] p-3 sm:grid-cols-[8rem_1fr_1fr] sm:items-center"
                    >
                      <AiConfigField label={llmTaskRouteLabel(task)} description="选择承载此任务的 Provider。">
                        <Select
                        value={pid || "__empty__"}
                        onValueChange={(value) => {
                          const nextPid = value === "__empty__" ? "" : value;
                          setTaskRoute(task, nextPid);
                          loadTaskProviderModels(doc.providers.find((p) => p.id === nextPid));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择 Provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty__">（未指定）</SelectItem>
                          {doc.providers.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.id}{!p.enabled ? " (停用)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                        </Select>
                      </AiConfigField>
                      <AiConfigField label="任务模型" description="可选；留空时使用 Provider 默认模型。">
                        <AiModelSelect
                          value={model}
                          disabled={!pid}
                          options={[
                            ...(provider?.default_model ? [provider.default_model] : []),
                            ...Object.values(provider?.task_models || {}),
                            ...(provider ? providerModels[provider.id] || [] : []),
                          ]}
                          placeholder="选择任务模型"
                          onValueChange={(value) => setTaskModel(task, pid, value)}
                        />
                      </AiConfigField>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3 border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] pt-4">
                <div>
                  <h3 className="text-sm font-medium">Chain Fallback</h3>
                  <p className="text-xs text-muted-foreground">失败时按顺序尝试的 Provider</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {providerIds.length === 0 ? (
                    <p className="text-sm text-muted-foreground">先添加 Provider</p>
                  ) : (
                    providerIds.map((id) => {
                      const on = doc.routing.chain_fallback.includes(id);
                      return (
                        <Button
                          key={id}
                          size="sm"
                          variant={on ? "default" : "outline"}
                          onClick={() => toggleChain(id)}
                        >
                          {id}
                        </Button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "local" ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">本地模型路由</h3>
                <p className="text-xs text-muted-foreground">
                  {localDoc.env_file || "/common-config/llm/local-routing"}
                </p>
              </div>
              <AiConfigField label="默认 llm_model" description="本地路由未单独指定时使用的模型。">
                <AiModelSelect
                  value={localDoc.llm_model || ""}
                  options={knownModels}
                  onValueChange={(value) => setLocalDoc((d) => ({ ...d, llm_model: value }))}
                />
              </AiConfigField>
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control,8px)] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-3 py-2.5">
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor="llm-local-multi-model">启用本地多模型</Label>
                  <p className="text-xs text-muted-foreground">允许不同任务使用不同本地模型。</p>
                </div>
                <Switch
                  id="llm-local-multi-model"
                  checked={Boolean(localDoc.local_multi_model_enabled)}
                  onCheckedChange={(checked) =>
                    setLocalDoc((d) => ({ ...d, local_multi_model_enabled: checked }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["simple", "medium", "complex", "vision"].map((k) => (
                  <AiConfigField key={k} label={`moe · ${k}`}>
                    <AiModelSelect
                      value={localDoc.moe_models?.[k] || ""}
                      options={knownModels}
                      onValueChange={(value) =>
                        setLocalDoc((d) => ({
                          ...d,
                          moe_models: { ...(d.moe_models || {}), [k]: value },
                        }))
                      }
                    />
                  </AiConfigField>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[...DEFAULT_LLM_TASKS].map((k) => (
                  <AiConfigField key={k} label={`task · ${llmTaskRouteLabel(k)}`}>
                    <AiModelSelect
                      value={localDoc.task_models?.[k] || ""}
                      options={knownModels}
                      onValueChange={(value) =>
                        setLocalDoc((d) => ({
                          ...d,
                          task_models: { ...(d.task_models || {}), [k]: value },
                        }))
                      }
                    />
                  </AiConfigField>
                ))}
              </div>
              {localDirty ? <Badge variant="warn">本地路由未保存</Badge> : null}
            </div>
          ) : null}
        </CardContent>
        {doc.providers_file ? (
          <CardFooter className="justify-start gap-2 border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-5 py-2.5 text-xs text-muted-foreground">
            <span className="shrink-0">配置文件</span>
            <code className="min-w-0 truncate font-mono text-[11px]" title={doc.providers_file}>
              {providersFileName}
            </code>
          </CardFooter>
        ) : null}
      </Card>

    </>
  );
}
