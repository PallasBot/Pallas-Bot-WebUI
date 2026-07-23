import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchPluginConfig,
  fetchPluginConfigRaw,
  putPluginConfig,
  putPluginConfigRaw,
} from "@/api/console";
import {
  fetchPluginBundledReadme,
  fetchPluginStoreReadme,
  fetchPlugins,
  postPluginConfigCheck,
} from "@/api/fullConsole";
import type { PluginRow } from "@/api/pallasTypes";
import HelpImagePreview from "@/components/HelpImagePreview";
import PluginConfigFieldShell from "@/components/config/PluginConfigFieldShell";
import PluginGovernancePanel from "@/components/PluginGovernancePanel";
import StateBlock from "@/components/StateBlock";
import UiButton from "@/components/ui/UiButton";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import type { PluginReadmeTarget } from "@/utils/pluginReadmeTarget";
import { normalizeBundledReadmeMarkdown, readmeMarkdownToSafeHtml } from "@/utils/pluginReadme";
import { cn } from "@/lib/utils";
import { collectFieldValues, fieldValuesFromConfig } from "@/utils/pluginConfigFieldModel";

type ConfigTab = "governance" | "config" | "readme";

export type PluginConfigWorkspaceHandle = {
  save: () => Promise<void>;
  runConfigCheck: () => Promise<void>;
  saving: boolean;
  checking: boolean;
  loading: boolean;
  hasData: boolean;
  supportsConfigCheck: boolean;
};

type Props = {
  pluginName: string;
  presentation?: "page" | "dialog";
  initialPluginRow?: PluginRow | null;
  readmeTarget?: PluginReadmeTarget | null;
  onStatusChange?: (status: Omit<PluginConfigWorkspaceHandle, "save" | "runConfigCheck">) => void;
};

function PluginBundledReadme({
  name,
  readmeTarget,
}: {
  name: string;
  readmeTarget?: PluginReadmeTarget | null;
}) {
  const readmeQ = useQuery({
    queryKey: ["plugin-bundled-readme", name, readmeTarget?.kind, readmeTarget?.id],
    queryFn: async () => {
      try {
        const bundled = await fetchPluginBundledReadme(name);
        if (bundled.markdown.trim()) {
          return normalizeBundledReadmeMarkdown(bundled.markdown, name);
        }
      } catch {
        // fall through
      }
      if (!readmeTarget) throw new Error("暂无 README 来源");
      return fetchPluginStoreReadme(readmeTarget.kind, readmeTarget.id, {
        repositoryUrl: readmeTarget.repositoryUrl,
      });
    },
  });

  const html = useMemo(() => {
    const md = readmeQ.data?.trim();
    if (!md) return "";
    return readmeMarkdownToSafeHtml(md, readmeTarget?.repositoryUrl || name);
  }, [readmeQ.data, readmeTarget, name]);

  return (
    <StateBlock
      loading={readmeQ.isLoading}
      error={readmeQ.error}
      empty={!html}
      emptyText={readmeQ.error ? undefined : "暂无 README 内容"}
    >
      <div
        className="plugin-readme-panel__body readme-markdown markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </StateBlock>
  );
}

const PluginConfigWorkspace = forwardRef<PluginConfigWorkspaceHandle, Props>(function PluginConfigWorkspace(
  { pluginName, presentation = "page", initialPluginRow, readmeTarget, onStatusChange },
  ref,
) {
  const qc = useQueryClient();
  const name = pluginName.trim();
  const isDialog = presentation === "dialog";
  const supportsConfigCheck = name === "draw";
  const isHelpPlugin = name === "help";
  const pluginResolvedId = (initialPluginRow?.resolved_plugin_id || name).trim();
  const showDrawAiConfigHint = pluginResolvedId === "draw";

  const [mode, setMode] = useState<"form" | "raw">("form");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkErr, setCheckErr] = useState("");
  const [checkLines, setCheckLines] = useState<string[]>([]);
  const [detailTab, setDetailTab] = useState<ConfigTab>("config");

  const cfgQ = useQuery({
    queryKey: ["plugin-config", name],
    queryFn: () => fetchPluginConfig(name),
    enabled: Boolean(name),
  });
  const rawQ = useQuery({
    queryKey: ["plugin-config-raw", name],
    queryFn: () => fetchPluginConfigRaw(name),
    enabled: Boolean(name) && mode === "raw",
  });
  const pluginRowQ = useQuery({
    queryKey: ["plugin-row", name],
    queryFn: async () => {
      const rows = await fetchPlugins();
      return rows.find((r) => (r.resolved_plugin_id || r.name) === name) ?? null;
    },
    enabled: Boolean(name) && !initialPluginRow,
    initialData: initialPluginRow ?? undefined,
  });

  const pluginRow = initialPluginRow ?? pluginRowQ.data ?? null;
  const hasConfigFields = Boolean(cfgQ.data?.fields.length);
  const hasGovernanceTab = Boolean(pluginResolvedId);
  const showReadmeTab = isDialog;

  useEffect(() => {
    if (!cfgQ.data?.fields) return;
    setFieldValues(fieldValuesFromConfig(cfgQ.data.fields));
    setMode("form");
    setMsg(null);
    setCheckErr("");
    setCheckLines([]);
  }, [cfgQ.data, name]);

  useEffect(() => {
    if (rawQ.data != null) setRaw(rawQ.data);
  }, [rawQ.data]);

  useEffect(() => {
    if (detailTab === "governance" && !hasGovernanceTab) setDetailTab(hasConfigFields ? "config" : "readme");
    if (detailTab === "config" && !hasConfigFields && !isHelpPlugin) {
      setDetailTab(hasGovernanceTab ? "governance" : showReadmeTab ? "readme" : "config");
    }
    if (detailTab === "readme" && !showReadmeTab) {
      setDetailTab(hasGovernanceTab ? "governance" : "config");
    }
  }, [detailTab, hasGovernanceTab, hasConfigFields, isHelpPlugin, showReadmeTab]);

  const saveForm = useMutation({
    mutationFn: () => {
      const fields = cfgQ.data?.fields || [];
      return putPluginConfig(name, collectFieldValues(fields, fieldValues));
    },
    onSuccess: async () => {
      setMsg("配置已保存");
      await qc.invalidateQueries({ queryKey: ["plugin-config", name] });
      await qc.invalidateQueries({ queryKey: ["plugin-config-raw", name] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const saveRaw = useMutation({
    mutationFn: () => putPluginConfigRaw(name, raw),
    onSuccess: async () => {
      setMsg("原始 TOML 已保存");
      await qc.invalidateQueries({ queryKey: ["plugin-config", name] });
      await qc.invalidateQueries({ queryKey: ["plugin-config-raw", name] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const saving = saveForm.isPending || saveRaw.isPending;
  const loading = cfgQ.isLoading;
  const hasData = Boolean(cfgQ.data);
  const fields = cfgQ.data?.fields || [];

  async function runConfigCheck() {
    if (!cfgQ.data || !supportsConfigCheck || checking) return;
    setChecking(true);
    setCheckErr("");
    setCheckLines([]);
    try {
      const fields = cfgQ.data?.fields || [];
      const values = collectFieldValues(fields, fieldValues);
      const r = await postPluginConfigCheck(name, values);
      setCheckLines(r.lines || []);
    } catch (e) {
      setCheckErr(axiosErrorDetail(e));
    } finally {
      setChecking(false);
    }
  }

  async function save() {
    if (!cfgQ.data) return;
    setMsg(null);
    if (mode === "raw") await saveRaw.mutateAsync();
    else await saveForm.mutateAsync();
  }

  useImperativeHandle(ref, () => ({
    save,
    runConfigCheck,
    saving,
    checking,
    loading,
    hasData,
    supportsConfigCheck,
  }));

  useEffect(() => {
    onStatusChange?.({ saving, checking, loading, hasData, supportsConfigCheck });
  }, [saving, checking, loading, hasData, supportsConfigCheck, onStatusChange]);

  const tabButtons: Array<{ id: ConfigTab; label: string; show: boolean }> = [
    { id: "governance", label: "治理", show: hasGovernanceTab },
    { id: "config", label: "插件配置", show: true },
    { id: "readme", label: "README", show: showReadmeTab },
  ];

  const configBody = (
    <>
      <div className="plugin-config-page__toolbar">
        <div
          className="console-view-toggle plugin-config-page__tabs"
          role="tablist"
          aria-label="插件工作区"
        >
          {tabButtons
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                className={cn(detailTab === t.id && "is-on")}
                aria-selected={detailTab === t.id}
                onClick={() => setDetailTab(t.id)}
              >
                <span>{t.label}</span>
              </button>
            ))}
        </div>
        {detailTab === "config" && (hasConfigFields || isHelpPlugin) ? (
          <div
            className="plugin-config-page__mode-toggle console-view-toggle"
            role="tablist"
            aria-label="配置编辑模式"
          >
            <button
              type="button"
              role="tab"
              className={cn(mode === "form" && "is-on")}
              aria-selected={mode === "form"}
              onClick={() => setMode("form")}
            >
              表单
            </button>
            <button
              type="button"
              role="tab"
              className={cn(mode === "raw" && "is-on")}
              aria-selected={mode === "raw"}
              onClick={() => setMode("raw")}
            >
              Raw TOML
            </button>
          </div>
        ) : null}
      </div>

      {showDrawAiConfigHint && !isDialog ? (
        <p className="muted plugin-config-dialog__ai-hint">
          推荐在 <Link to={aiConfigSectionPath("draw")}>AI 配置 · 画画</Link>
          管理网关；本页为兼容入口，配置键相同。
        </p>
      ) : null}

      {detailTab === "governance" && hasGovernanceTab ? (
        <section className={isDialog ? "plugin-config-page__governance-dialog" : "plugin-config-page__tab-panel"}>
          <PluginGovernancePanel pluginName={pluginRow?.name || name} />
        </section>
      ) : null}

      {detailTab === "readme" && showReadmeTab ? (
        <section className="plugin-config-page__tab-panel plugin-readme-panel">
          <header className="plugin-config-page__panel-head">
            <div>
              <h3 className="plugin-config-page__panel-title">README</h3>
              <p className="muted plugin-config-page__panel-desc">
                来自插件仓库说明；配置与运行项请切换其他分栏。
              </p>
            </div>
          </header>
          <PluginBundledReadme name={pluginResolvedId} readmeTarget={readmeTarget} />
        </section>
      ) : null}

      {detailTab === "config" ? (
        <>
          {isHelpPlugin && mode === "form" ? (
            <HelpImagePreview embedded={isDialog} defaultPlugin={name} />
          ) : null}
          {!hasConfigFields && !isHelpPlugin ? (
            <p className="muted plugin-config-page__fields-lead">该插件未暴露可调参数或未注册 schema。</p>
          ) : null}
          {checkErr ? <p className="text-sm text-destructive">{checkErr}</p> : null}
          {checkLines.length ? (
            <pre className="plugin-config-page__check-output">{checkLines.join("\n")}</pre>
          ) : null}
          {msg ? (
            <p className={cn("text-sm", msg.includes("已保存") ? "text-emerald-400" : "text-destructive")}>{msg}</p>
          ) : null}
          {mode === "form" ? (
            <StateBlock
              loading={loading}
              error={cfgQ.error}
              empty={!fields.length && !isHelpPlugin}
              emptyText="该插件无可编辑配置字段"
            >
              <div className="plugin-config-form-grid">
                {fields.map((f) => (
                  <PluginConfigFieldShell
                    key={f.name}
                    field={f}
                    modelValue={fieldValues[f.name] ?? ""}
                    onValueChange={(v) => setFieldValues((prev) => ({ ...prev, [f.name]: v }))}
                  />
                ))}
              </div>
              {!isDialog ? (
                <div className="mt-4">
                  <UiButton variant="primary" size="sm" disabled={saving} onClick={() => void save()}>
                    {saving ? "保存中…" : "保存配置"}
                  </UiButton>
                </div>
              ) : null}
            </StateBlock>
          ) : (
            <StateBlock loading={rawQ.isLoading} error={rawQ.error}>
              <textarea
                className="inp textarea plugin-config-page__raw-toml min-h-[22rem] w-full font-mono text-xs leading-relaxed"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                spellCheck={false}
              />
              {!isDialog ? (
                <div className="mt-3">
                  <UiButton variant="primary" size="sm" disabled={saving} onClick={() => void save()}>
                    {saving ? "保存中…" : "保存 TOML"}
                  </UiButton>
                </div>
              ) : null}
            </StateBlock>
          )}
        </>
      ) : null}
    </>
  );

  const shellClass = isDialog
    ? cn("plugin-config-workspace__body", loading && "plugin-config-workspace__body--loading")
    : cn("plugin-config-page__card", loading && "plugin-config-page__card--loading");

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="plugin-config-page__loading" aria-busy="true" aria-live="polite">
        <span className="plugin-config-page__loading-text">加载配置…</span>
      </div>
    );
  } else if (cfgQ.error && !cfgQ.data) {
    body = (
      <div className="plugin-config-page__card-bd">
        <div className="alert alert--err">{axiosErrorDetail(cfgQ.error)}</div>
      </div>
    );
  } else if (cfgQ.data || detailTab === "governance" || detailTab === "readme") {
    body = <div className="plugin-config-page__card-bd">{configBody}</div>;
  } else {
    body = null;
  }

  return (
    <div
      className={cn(
        "plugin-config-page plugin-config-workspace",
        isDialog && "plugin-config-workspace--dialog",
      )}
    >
      <div className={shellClass}>{body}</div>
    </div>
  );
});

export default PluginConfigWorkspace;
