import { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { cn } from "@/lib/utils";

type Tab = "upstream" | "tasks" | "local";

function cloneDoc(doc: LlmProvidersConfig): LlmProvidersConfig {
  return JSON.parse(JSON.stringify(doc)) as LlmProvidersConfig;
}

function emptyDoc(): LlmProvidersConfig {
  return { providers: [], routing: { chain_fallback: [], tasks: {} }, providers_file: "", file_exists: false };
}

export default function LlmProvidersForm() {
  const [tab, setTab] = useState<Tab>("upstream");
  const [doc, setDoc] = useState<LlmProvidersConfig>(emptyDoc());
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [testBusy, setTestBusy] = useState<string>("");
  const [testHint, setTestHint] = useState<Record<string, string>>({});

  const [editOpen, setEditOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<LlmProviderRow>(blankProvider());
  const [draftApiKey, setDraftApiKey] = useState("");
  const [useEnvVar, setUseEnvVar] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = useState(false);

  const [localDoc, setLocalDoc] = useState<LlmLocalRoutingConfig>({});
  const [localBaseline, setLocalBaseline] = useState("");
  const [localSaving, setLocalSaving] = useState(false);

  const dirty = useMemo(() => JSON.stringify(doc) !== baseline, [doc, baseline]);
  const localDirty = useMemo(() => JSON.stringify(localDoc) !== localBaseline, [localDoc, localBaseline]);
  const providerIds = doc.providers.map((p) => p.id);

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
    setEditOpen(true);
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
    setEditOpen(true);
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
    setDoc(nextDoc);
    setEditOpen(false);
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
  }

  function toggleEnabled(index: number) {
    setDoc((prev) => {
      const next = cloneDoc(prev);
      const row = next.providers[index];
      if (!row) return prev;
      next.providers[index] = { ...row, enabled: !row.enabled };
      return next;
    });
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
      }
    } catch (e) {
      setEditErr(axiosErrorDetail(e));
    } finally {
      setModelsBusy(false);
    }
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

  if (loading) return <p className="text-sm text-muted-foreground">加载 LLM 配置…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["upstream", "上游 Provider"],
              ["tasks", "任务编排"],
              ["local", "本地路由"],
            ] as const
          ).map(([id, label]) => (
            <Button key={id} size="sm" variant={tab === id ? "default" : "outline"} onClick={() => setTab(id)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={saving || localSaving} onClick={() => void load()}>
            重新加载
          </Button>
          {tab === "local" ? (
            <Button size="sm" disabled={!localDirty || localSaving} onClick={() => void saveLocal()}>
              {localSaving ? "保存中…" : "保存本地路由"}
            </Button>
          ) : (
            <Button size="sm" disabled={!dirty || saving} onClick={() => void saveProviders()}>
              {saving ? "保存中…" : dirty ? "保存提供方" : "已是最新"}
            </Button>
          )}
        </div>
      </div>

      {okMsg ? <p className="text-sm text-emerald-400">{okMsg}</p> : null}
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {doc.providers_file ? (
        <p className="break-all font-mono text-xs text-muted-foreground">{doc.providers_file}</p>
      ) : null}

      {tab === "upstream" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={openAdd}>
              添加 Provider
            </Button>
            <Badge variant="outline">{doc.providers.length} 个</Badge>
            {dirty ? <Badge variant="warn">未保存</Badge> : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {doc.providers.map((p, index) => (
              <Card key={p.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{p.id}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {p.kind} · {p.base_url || "(local)"}
                      </div>
                    </div>
                    <Badge variant={p.enabled ? "success" : "secondary"}>
                      {p.enabled ? "启用" : "停用"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge variant="outline">{p.default_model || "无默认模型"}</Badge>
                    <Badge variant={p.api_key_set || p.api_key_env ? "secondary" : "warn"}>
                      {p.api_key_set ? "密钥已配置" : p.api_key_env ? `env:${p.api_key_env}` : "无密钥"}
                    </Badge>
                    {testHint[p.id] ? <Badge variant="outline">{testHint[p.id]}</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(index)}>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={testBusy === p.id}
                      onClick={() => void testProvider(p.id)}
                    >
                      测试
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleEnabled(index)}>
                      {p.enabled ? "停用" : "启用"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => removeProvider(index)}>
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {!doc.providers.length ? <p className="text-sm text-muted-foreground">还没有 Provider</p> : null}
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>任务 → Provider</CardTitle>
              <CardDescription>可同时指定该 Provider 上的任务模型（写入 task_models）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {taskKeys.map((task) => {
                const pid = doc.routing.tasks[task] || "";
                const provider = doc.providers.find((p) => p.id === pid);
                const model = provider?.task_models?.[task] || "";
                return (
                  <div
                    key={task}
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[8rem_1fr_1fr] sm:items-center"
                  >
                    <div className="text-sm font-medium">{llmTaskRouteLabel(task)}</div>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      value={pid}
                      onChange={(e) => setTaskRoute(task, e.target.value)}
                    >
                      <option value="">（未指定）</option>
                      {doc.providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id}
                          {!p.enabled ? " (停用)" : ""}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="任务模型（可选）"
                      value={model}
                      disabled={!pid}
                      onChange={(e) => setTaskModel(task, pid, e.target.value)}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chain Fallback</CardTitle>
              <CardDescription>失败时按顺序尝试的 Provider</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
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
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "local" ? (
        <Card>
          <CardHeader>
            <CardTitle>本地模型路由</CardTitle>
            <CardDescription>{localDoc.env_file || "/common-config/llm/local-routing"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">默认 llm_model</span>
              <Input
                value={localDoc.llm_model || ""}
                onChange={(e) => setLocalDoc((d) => ({ ...d, llm_model: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(localDoc.local_multi_model_enabled)}
                onChange={(e) =>
                  setLocalDoc((d) => ({ ...d, local_multi_model_enabled: e.target.checked }))
                }
              />
              启用本地多模型
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {["simple", "medium", "complex", "vision"].map((k) => (
                <label key={k} className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">moe · {k}</span>
                  <Input
                    value={localDoc.moe_models?.[k] || ""}
                    onChange={(e) =>
                      setLocalDoc((d) => ({
                        ...d,
                        moe_models: { ...(d.moe_models || {}), [k]: e.target.value },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[...DEFAULT_LLM_TASKS].map((k) => (
                <label key={k} className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">task · {llmTaskRouteLabel(k)}</span>
                  <Input
                    value={localDoc.task_models?.[k] || ""}
                    onChange={(e) =>
                      setLocalDoc((d) => ({
                        ...d,
                        task_models: { ...(d.task_models || {}), [k]: e.target.value },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            {localDirty ? <Badge variant="warn">本地路由未保存</Badge> : null}
          </CardContent>
        </Card>
      ) : null}

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:w-[28rem] sm:max-w-[94vw]">
          <SheetHeader>
            <SheetTitle>{editIndex === null ? "添加 Provider" : `编辑 ${draft.id}`}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            {editErr ? <p className="text-destructive">{editErr}</p> : null}

            <div className="flex flex-wrap gap-2">
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

            <label className="block space-y-1">
              <span className="text-muted-foreground">Provider ID</span>
              <Input
                value={draft.id}
                disabled={editIndex !== null}
                onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
              />
            </label>
            {draft.kind !== "local" ? (
              <label className="block space-y-1">
                <span className="text-muted-foreground">Base URL</span>
                <Input
                  value={draft.base_url}
                  onChange={(e) => setDraft((d) => ({ ...d, base_url: e.target.value }))}
                />
              </label>
            ) : null}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
              />
              启用
            </label>

            {draft.kind !== "local" ? (
              <>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={useEnvVar} onChange={(e) => setUseEnvVar(e.target.checked)} />
                  使用环境变量存放密钥
                </label>
                {useEnvVar ? (
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">api_key_env</span>
                    <Input
                      value={draft.api_key_env}
                      onChange={(e) => setDraft((d) => ({ ...d, api_key_env: e.target.value }))}
                    />
                  </label>
                ) : (
                  <label className="block space-y-1">
                    <span className="text-muted-foreground">
                      API Key{draft.api_key_set ? "（留空表示不修改已存密钥）" : ""}
                    </span>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={draftApiKey}
                      onChange={(e) => setDraftApiKey(e.target.value)}
                    />
                  </label>
                )}
              </>
            ) : null}

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">默认模型</span>
                <Button size="sm" variant="outline" disabled={modelsBusy} onClick={() => void refreshModels()}>
                  {modelsBusy ? "发现中…" : "刷新模型列表"}
                </Button>
              </div>
              {models.length ? (
                <select
                  className="mb-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={draft.default_model}
                  onChange={(e) => setDraft((d) => ({ ...d, default_model: e.target.value }))}
                >
                  <option value="">（手动填写）</option>
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : null}
              <Input
                value={draft.default_model}
                onChange={(e) => setDraft((d) => ({ ...d, default_model: e.target.value }))}
                list="llm-model-suggestions"
              />
              <datalist id="llm-model-suggestions">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            <div className={cn("flex flex-wrap gap-2 pt-2")}>
              <Button size="sm" onClick={submitEdit}>
                应用
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
