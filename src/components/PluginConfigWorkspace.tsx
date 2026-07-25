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
import DynamicConfigPanel from "@/components/config/DynamicConfigPanel";
import PluginConfigFieldShell from "@/components/config/PluginConfigFieldShell";
import PluginConfigFormSection from "@/components/config/PluginConfigFormSection";
import DrawProviderGatewayPanel, {
  DRAW_GATEWAY_PANEL_FIELD_NAMES,
} from "@/components/draw/DrawProviderGatewayPanel";
import ProviderGatewayPanel from "@/components/provider/ProviderGatewayPanel";
import HelpTagOverridesPanel, {
  HELP_TAG_OVERRIDES_FIELD,
} from "@/components/help/HelpTagOverridesPanel";
import PluginHelpTagField from "@/components/help/PluginHelpTagField";
import PluginGovernancePanel from "@/components/PluginGovernancePanel";
import SegTabs from "@/components/SegTabs";
import StateBlock from "@/components/StateBlock";
import UiButton from "@/components/ui/UiButton";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import type { PluginReadmeTarget } from "@/utils/pluginReadmeTarget";
import { normalizeBundledReadmeMarkdown, readmeMarkdownToSafeHtml } from "@/utils/pluginReadme";
import { cn } from "@/lib/utils";
import { collectFieldValues, fieldValuesFromConfig, parsePluginConfigField } from "@/utils/pluginConfigFieldModel";
import { pushConsoleToast } from "@/utils/consoleToast";
import type { PluginConfigField } from "@/api/console";
import {
  DRAW_PROVIDER_GATEWAY_BINDING,
  normalizeProviderGatewayBinding,
  providerGatewayBoundFieldNames,
  type ProviderGatewayBinding,
} from "@/utils/providerGateways";

const DRAW_GATEWAY_FIELD_SET = new Set<string>(DRAW_GATEWAY_PANEL_FIELD_NAMES);
const HELP_TAG_OVERRIDE_FIELD_SET = new Set<string>([HELP_TAG_OVERRIDES_FIELD]);

/** 画画配置提交体：表单字段 + 网关面板键（schema 尚未热载到新键时也写入）。 */
function collectDrawPluginValues(
  fields: PluginConfigField[],
  fieldValues: Record<string, string>,
): Record<string, unknown> {
  const values = collectFieldValues(fields, fieldValues);
  const byName = new Map(fields.map((f) => [f.name, f]));
  for (const key of DRAW_GATEWAY_PANEL_FIELD_NAMES) {
    if (!(key in fieldValues)) continue;
    const field = byName.get(key);
    if (field) {
      values[key] = parsePluginConfigField(field, fieldValues[key] ?? "");
      continue;
    }
    const raw = fieldValues[key] ?? "";
    if (key === "pallas_image_cost_per_image") {
      const n = Number(raw);
      values[key] = Number.isFinite(n) && n > 0 ? n : 0;
      continue;
    }
    if (key === "pallas_image_stats_cost_currency") {
      values[key] = String(raw || "").trim().toUpperCase();
      continue;
    }
    if (key === "pallas_image_api_backends") {
      try {
        values[key] = JSON.parse(raw || "[]");
      } catch {
        values[key] = [];
      }
      continue;
    }
    if (
      key === "pallas_image_ai_runtime_fallback_to_plugin" ||
      key.endsWith("_enabled")
    ) {
      values[key] = ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
      continue;
    }
    if (
      key === "pallas_image_ai_runtime_open_circuit_failures" ||
      key === "pallas_image_ai_runtime_circuit_cooldown_sec"
    ) {
      const n = Number(raw);
      values[key] = Number.isFinite(n) ? n : 0;
      continue;
    }
    values[key] = raw;
  }
  return values;
}
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
  const fields = cfgQ.data?.fields || [];

  const gatewayWidgets = useMemo(() => {
    const fromSchema: Array<{ anchor: string; binding: ProviderGatewayBinding }> = [];
    for (const field of fields) {
      if (field.ui_widget !== "provider_gateway") continue;
      const binding = normalizeProviderGatewayBinding(field.ui_gateway, {
        anchorField: field.name,
      });
      if (binding) fromSchema.push({ anchor: field.name, binding });
    }
    if (fromSchema.length) return fromSchema;
    if (name === "draw") {
      return [{ anchor: "pallas_image_api_backends", binding: DRAW_PROVIDER_GATEWAY_BINDING }];
    }
    return [];
  }, [fields, name]);

  const gatewayHiddenFieldSet = useMemo(() => {
    const set = new Set<string>();
    for (const widget of gatewayWidgets) {
      for (const key of providerGatewayBoundFieldNames(widget.binding, widget.anchor)) {
        set.add(key);
      }
    }
    if (name === "draw") {
      for (const key of DRAW_GATEWAY_PANEL_FIELD_NAMES) set.add(key);
    }
    return set;
  }, [gatewayWidgets, name]);

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
    setCheckErr("");
    setCheckLines([]);
  }, [cfgQ.data, name]);

  useEffect(() => {
    setMsg(null);
    setCheckErr("");
    setCheckLines([]);
  }, [name]);

  useEffect(() => {
    if (rawQ.data != null) setRaw(rawQ.data);
  }, [rawQ.data]);

  useEffect(() => {
    if (detailTab === "governance" && !hasGovernanceTab) setDetailTab("config");
    if (detailTab === "readme" && !showReadmeTab) {
      setDetailTab(hasGovernanceTab ? "governance" : "config");
    }
  }, [detailTab, hasGovernanceTab, showReadmeTab]);

  const saveForm = useMutation({
    mutationFn: () => {
      const fields = cfgQ.data?.fields || [];
      const payload =
        name === "draw"
          ? collectDrawPluginValues(fields, fieldValues)
          : collectFieldValues(fields, fieldValues);
      return putPluginConfig(name, payload);
    },
    onSuccess: async () => {
      setMsg("配置已保存");
      pushConsoleToast("配置已保存", "ok");
      await qc.invalidateQueries({ queryKey: ["plugin-config", name] });
      await qc.invalidateQueries({ queryKey: ["plugin-config-raw", name] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
    },
    onError: (e) => {
      const detail = axiosErrorDetail(e);
      setMsg(detail);
      pushConsoleToast(detail, "err");
    },
  });

  const saveGatewayPatch = useMutation({
    mutationFn: async (patch: Record<string, string>) => {
      const fields = cfgQ.data?.fields || [];
      const merged = { ...fieldValues, ...patch };
      setFieldValues(merged);
      return putPluginConfig(name, collectDrawPluginValues(fields, merged));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["plugin-config", name] });
      await qc.invalidateQueries({ queryKey: ["plugin-config-raw", name] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
    },
    onError: (e) => {
      pushConsoleToast(axiosErrorDetail(e) || "网关保存失败", "err");
    },
  });

  const saveRaw = useMutation({
    mutationFn: () => putPluginConfigRaw(name, raw),
    onSuccess: async () => {
      setMsg("原始 TOML 已保存");
      pushConsoleToast("原始 TOML 已保存", "ok");
      await qc.invalidateQueries({ queryKey: ["plugin-config", name] });
      await qc.invalidateQueries({ queryKey: ["plugin-config-raw", name] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
    },
    onError: (e) => {
      const detail = axiosErrorDetail(e);
      setMsg(detail);
      pushConsoleToast(detail, "err");
    },
  });

  const saving = saveForm.isPending || saveRaw.isPending || saveGatewayPatch.isPending;
  const loading = cfgQ.isLoading;
  const hasData = Boolean(cfgQ.data);
  const fields = cfgQ.data?.fields || [];
  const usesDrawGatewayPanel = name === "draw";
  const usesHelpTagOverridesPanel = isHelpPlugin;
  const formFields = (() => {
    let list = fields;
    if (usesDrawGatewayPanel) list = list.filter((f) => !DRAW_GATEWAY_FIELD_SET.has(f.name));
    if (usesHelpTagOverridesPanel) list = list.filter((f) => !HELP_TAG_OVERRIDE_FIELD_SET.has(f.name));
    return list;
  })();

  async function patchFieldValuesAndPersist(patch: Record<string, string>) {
    await saveGatewayPatch.mutateAsync(patch);
  }
  async function runConfigCheck() {
    if (!cfgQ.data || !supportsConfigCheck || checking) return;
    setChecking(true);
    setCheckErr("");
    setCheckLines([]);
    try {
      const fields = cfgQ.data?.fields || [];
      const values =
        name === "draw"
          ? collectDrawPluginValues(fields, fieldValues)
          : collectFieldValues(fields, fieldValues);
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

  const workspaceTabOptions = tabButtons
    .filter((t) => t.show)
    .map((t) => ({ value: t.id, label: t.label }));

  const configBody = (
    <>
      <div className="plugin-config-page__toolbar">
        <SegTabs
          className="plugin-config-page__tabs"
          ariaLabel="插件工作区"
          value={detailTab}
          onValueChange={(v) => setDetailTab(v as ConfigTab)}
          options={workspaceTabOptions}
        />
        {detailTab === "config" && hasConfigFields ? (
          <SegTabs
            className="plugin-config-page__mode-toggle"
            ariaLabel="配置编辑模式"
            value={mode}
            onValueChange={(v) => setMode(v === "raw" ? "raw" : "form")}
            options={[
              { value: "form", label: "表单" },
              { value: "raw", label: "Raw TOML" },
            ]}
          />
        ) : null}
      </div>

      {showDrawAiConfigHint && !isDialog ? (
        <p className="muted plugin-config-dialog__ai-hint">
          推荐在 <Link to={aiConfigSectionPath("media", "draw")}>AI 配置 · 画画</Link>
          管理网关；本页为兼容入口，配置键相同。
        </p>
      ) : null}

      {detailTab === "governance" && hasGovernanceTab ? (
        <section className={isDialog ? "plugin-config-page__governance-dialog" : "plugin-config-page__tab-panel"}>
          <PluginGovernancePanel
            pluginName={pluginRow?.name || name}
            presentation={isDialog ? "dialog" : "page"}
          />
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
          {!hasConfigFields ? (
            <p className="muted plugin-config-page__fields-lead">
              该插件未暴露可调参数或未注册 schema；仍可设置下方帮助图分组。
            </p>
          ) : null}
          {checkErr ? <p className="text-sm text-destructive">{checkErr}</p> : null}
          {checkLines.length ? (
            <pre className="plugin-config-page__check-output">{checkLines.join("\n")}</pre>
          ) : null}
          {msg ? (
            <p className={cn("text-sm", msg.includes("已保存") ? "text-emerald-400" : "text-destructive")}>{msg}</p>
          ) : null}
          {mode === "form" ? (
            <>
              {pluginResolvedId ? (
                <PluginHelpTagField
                  className="mb-4"
                  pluginId={pluginResolvedId}
                  aliasIds={[
                    name,
                    pluginRow?.name,
                    pluginRow?.nb_plugin_name,
                    pluginRow?.resolved_plugin_id,
                  ].filter((x): x is string => Boolean(x && String(x).trim()))}
                  metadataExtra={
                    (pluginRow?.metadata?.extra as Record<string, unknown> | null | undefined) ?? null
                  }
                  onOverridesSynced={
                    isHelpPlugin
                      ? (serialized) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [HELP_TAG_OVERRIDES_FIELD]: serialized,
                          }))
                      : undefined
                  }
                />
              ) : null}
              {hasConfigFields ? (
                <StateBlock
                  loading={loading}
                  error={cfgQ.error}
                  empty={false}
                  emptyText="该插件无可编辑配置字段"
                >
                  {usesDrawGatewayPanel ? (
                    <DrawProviderGatewayPanel
                      className="mb-4"
                      fieldValues={fieldValues}
                      onFieldsPatch={patchFieldValuesAndPersist}
                      busy={saveGatewayPatch.isPending}
                    />
                  ) : null}
                  {usesHelpTagOverridesPanel ? (
                    <HelpTagOverridesPanel
                      className="mb-4"
                      fieldValues={fieldValues}
                      onFieldChange={(fieldName, value) =>
                        setFieldValues((prev) => ({ ...prev, [fieldName]: value }))
                      }
                    />
                  ) : null}
                  {cfgQ.data?.field_groups?.length ? (
                    <DynamicConfigPanel
                      fields={formFields}
                      fieldGroups={cfgQ.data.field_groups}
                      fieldValues={fieldValues}
                      onFieldChange={(name, value) =>
                        setFieldValues((prev) => ({ ...prev, [name]: value }))
                      }
                    />
                  ) : formFields.length ? (
                    <PluginConfigFormSection
                      subtitle={`共 ${formFields.length} 项参数，保存后按插件热重载策略生效`}
                    >
                      {formFields.map((f) => (
                        <PluginConfigFieldShell
                          key={f.name}
                          field={f}
                          modelValue={fieldValues[f.name] ?? ""}
                          onValueChange={(v) => setFieldValues((prev) => ({ ...prev, [f.name]: v }))}
                        />
                      ))}
                    </PluginConfigFormSection>
                  ) : null}
                  {!isDialog ? (
                    <div className="mt-4">
                      <UiButton variant="primary" size="sm" disabled={saving} onClick={() => void save()}>
                        {saving ? "保存中…" : "保存配置"}
                      </UiButton>
                    </div>
                  ) : null}
                </StateBlock>
              ) : null}
            </>
          ) : hasConfigFields ? (
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
          ) : null}
        </>
      ) : null}
    </>
  );

  const shellClass = isDialog
    ? cn("plugin-config-workspace__body", loading && "plugin-config-workspace__body--loading")
    : cn("plugin-config-page__card", loading && "plugin-config-page__card--loading");

  // 无 schema 的插件 GET config 可能失败；仍展示帮助图分组
  let body: ReactNode;
  if (!name) {
    body = null;
  } else if (loading && !cfgQ.data && !pluginResolvedId) {
    body = (
      <div className="plugin-config-page__loading" aria-busy="true" aria-live="polite">
        <span className="plugin-config-page__loading-text">加载配置…</span>
      </div>
    );
  } else {
    body = <div className="plugin-config-page__card-bd">{configBody}</div>;
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
