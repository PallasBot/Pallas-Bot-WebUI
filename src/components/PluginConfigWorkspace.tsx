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
import { FileText, Layers, Shield, SlidersHorizontal, type LucideIcon } from "lucide-react";
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
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, { CHROME_SELECT_TRIGGER, CHROME_TOOLS_TRAILING } from "@/components/ChromeTools";
import { preserveShellMainScroll } from "@/utils/preserveShellScroll";
import DynamicConfigPanel from "@/components/config/DynamicConfigPanel";
import {
  DRAW_GATEWAY_PANEL_FIELD_NAMES,
} from "@/components/draw/DrawProviderGatewayPanel";
import ProviderGatewayPanel from "@/components/provider/ProviderGatewayPanel";
import HelpTagOverridesPanel, {
  HELP_TAG_OVERRIDES_FIELD,
} from "@/components/help/HelpTagOverridesPanel";
import PluginHelpTagField from "@/components/help/PluginHelpTagField";
import PluginGovernancePanel from "@/components/PluginGovernancePanel";
import ReadmeMarkdown from "@/components/ReadmeMarkdown";
import SegTabs from "@/components/SegTabs";
import StateBlock from "@/components/StateBlock";
import UiButton from "@/components/ui/UiButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const HELP_TAG_OVERRIDE_FIELD_SET = new Set<string>([HELP_TAG_OVERRIDES_FIELD]);

type ConfigTab = "governance" | "config" | "readme";

const WORKSPACE_TAB_ICONS: Record<ConfigTab, LucideIcon> = {
  governance: Shield,
  config: SlidersHorizontal,
  readme: FileText,
};

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
  /** 仅展示这些表单字段；未传则展示全部（网关绑定键仍隐藏） */
  includeFields?: string[];
  /**
   * 是否展示网关面板。
   * 默认：未限制字段时展示；传入 includeFields 后默认不展示（除非显式 true）。
   */
  includeGateways?: boolean;
  /** 紧凑嵌入：只保留配置表单，隐藏治理 / README / 模式切换 */
  compact?: boolean;
  /** group.id 或 group.title → 分组标题覆盖 */
  groupTitles?: Record<string, string>;
  /** group.id → 副文案覆盖 */
  groupSubtitles?: Record<string, string>;
  /** 嵌入外层分区时去掉内部分组标题 */
  hideGroupHeaders?: boolean;
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
      <ReadmeMarkdown
        html={html}
        className="plugin-readme-panel__body readme-markdown markdown-body"
      />
    </StateBlock>
  );
}

const PluginConfigWorkspace = forwardRef<PluginConfigWorkspaceHandle, Props>(function PluginConfigWorkspace(
  {
    pluginName,
    presentation = "page",
    initialPluginRow,
    readmeTarget,
    onStatusChange,
    includeFields,
    includeGateways,
    compact = false,
    groupTitles,
    groupSubtitles: groupSubtitlesProp,
    hideGroupHeaders = false,
  },
  ref,
) {
  const qc = useQueryClient();
  const name = pluginName.trim();
  const isDialog = presentation === "dialog";
  const supportsConfigCheck = name === "draw" && !compact;
  const isHelpPlugin = name === "help";
  const pluginResolvedId = (initialPluginRow?.resolved_plugin_id || name).trim();
  const showDrawAiConfigHint = pluginResolvedId === "draw" && !compact;
  const fieldAllowSet = useMemo(
    () => (includeFields ? new Set(includeFields) : null),
    [includeFields],
  );
  const showGateways = includeGateways ?? fieldAllowSet == null;

  const [mode, setMode] = useState<"form" | "raw">("form");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState("");
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
  const hasGovernanceTab = Boolean(pluginResolvedId) && !compact;
  const showReadmeTab = isDialog && !compact;

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

  useEffect(() => {
    if (!cfgQ.data?.fields) return;
    try {
      setFieldValues(fieldValuesFromConfig(cfgQ.data.fields));
    } catch (e) {
      pushConsoleToast(e instanceof Error ? e.message : "配置字段解析失败", "err");
      setFieldValues({});
    }
    setMode("form");
    setCheckErr("");
    setCheckLines([]);
  }, [cfgQ.data, name]);

  useEffect(() => {
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
      pushConsoleToast("配置已保存", "ok");
      await qc.invalidateQueries({ queryKey: ["plugin-config", name] });
      await qc.invalidateQueries({ queryKey: ["plugin-config-raw", name] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
    },
    onError: (e) => {
      pushConsoleToast(
        axiosErrorDetail(e) || (e instanceof Error ? e.message : "保存失败"),
        "err",
      );
    },
  });

  const saveGatewayPatch = useMutation({
    mutationFn: async (patch: Record<string, string>) => {
      const fields = cfgQ.data?.fields || [];
      const merged = { ...fieldValues, ...patch };
      setFieldValues(merged);
      const payload =
        name === "draw"
          ? collectDrawPluginValues(fields, merged)
          : collectFieldValues(fields, merged);
      return putPluginConfig(name, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["plugin-config", name] });
      await qc.invalidateQueries({ queryKey: ["plugin-config-raw", name] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
    },
  });

  const saveRaw = useMutation({
    mutationFn: () => putPluginConfigRaw(name, raw),
    onSuccess: async () => {
      pushConsoleToast("原始 TOML 已保存", "ok");
      await qc.invalidateQueries({ queryKey: ["plugin-config", name] });
      await qc.invalidateQueries({ queryKey: ["plugin-config-raw", name] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
    },
    onError: (e) => {
      pushConsoleToast(
        axiosErrorDetail(e) || (e instanceof Error ? e.message : "保存失败"),
        "err",
      );
    },
  });

  const saving = saveForm.isPending || saveRaw.isPending || saveGatewayPatch.isPending;
  const loading = cfgQ.isLoading;
  const hasData = Boolean(cfgQ.data);
  const usesHelpTagOverridesPanel = isHelpPlugin;
  const formFields = (() => {
    let list = fields;
    if (gatewayHiddenFieldSet.size) {
      list = list.filter((f) => !gatewayHiddenFieldSet.has(f.name));
    }
    if (usesHelpTagOverridesPanel) list = list.filter((f) => !HELP_TAG_OVERRIDE_FIELD_SET.has(f.name));
    if (fieldAllowSet) list = list.filter((f) => fieldAllowSet.has(f.name));
    return list;
  })();
  const visibleGatewayWidgets = showGateways ? gatewayWidgets : [];

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
    try {
      if (mode === "raw") await saveRaw.mutateAsync();
      else await saveForm.mutateAsync();
    } catch {
      // onError 已 toast；mutateAsync 仍会抛出，此处吞掉避免未处理 Promise
    }
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
    if (!onStatusChange) return;
    onStatusChange({ saving, checking, loading, hasData, supportsConfigCheck });
  }, [saving, checking, loading, hasData, supportsConfigCheck, onStatusChange]);

  const tabButtons: Array<{ id: ConfigTab; label: string; show: boolean }> = [
    { id: "governance", label: "治理", show: hasGovernanceTab },
    { id: "config", label: "插件配置", show: true },
    { id: "readme", label: "README", show: showReadmeTab },
  ];

  const workspaceTabOptions = tabButtons
    .filter((t) => t.show)
    .map((t) => ({ value: t.id, label: t.label }));

  const currentWorkspaceLabel =
    workspaceTabOptions.find((t) => t.value === detailTab)?.label ?? "插件配置";

  const configBody = (
    <>
      {!compact ? (
        <ChromeTools className="plugin-config-workspace__chrome">
          <ChromeField label="工作区" icon={Layers} className="shrink-0">
            <Select
              value={detailTab}
              onValueChange={(v) => {
                preserveShellMainScroll(() => setDetailTab(v as ConfigTab));
              }}
            >
              <SelectTrigger
                className={CHROME_SELECT_TRIGGER}
                aria-label="工作区"
              >
                <SelectValue placeholder="工作区">{currentWorkspaceLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                {workspaceTabOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <ChromeOptionLabel icon={WORKSPACE_TAB_ICONS[t.value]}>
                      {t.label}
                    </ChromeOptionLabel>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ChromeField>

          {detailTab === "config" && hasConfigFields ? (
            <div className={CHROME_TOOLS_TRAILING}>
              <SegTabs
                className="plugin-config-page__mode-toggle"
                size="toolbar"
                ariaLabel="配置编辑模式"
                value={mode}
                onValueChange={(v) => setMode(v === "raw" ? "raw" : "form")}
                options={[
                  { value: "form", label: "表单" },
                  { value: "raw", label: "Raw TOML", className: "plugin-config-page__mode-tab--raw" },
                ]}
              />
            </div>
          ) : null}
        </ChromeTools>
      ) : null}

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
          {isHelpPlugin && mode === "form" && !compact ? (
            <HelpImagePreview embedded={isDialog} defaultPlugin={name} />
          ) : null}
          {!hasConfigFields && !isHelpPlugin ? (
            <p className="muted plugin-config-page__fields-lead">该插件未暴露可调参数或未注册 schema。</p>
          ) : null}
          {checkErr ? <p className="text-sm text-destructive">{checkErr}</p> : null}
          {checkLines.length ? (
            <pre className="plugin-config-page__check-output">{checkLines.join("\n")}</pre>
          ) : null}
          {mode === "form" ? (
            <>
              {pluginResolvedId && !compact ? (
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
                  {visibleGatewayWidgets.map((widget) => (
                    <ProviderGatewayPanel
                      key={widget.anchor}
                      className="mb-4"
                      fieldValues={fieldValues}
                      onFieldsPatch={patchFieldValuesAndPersist}
                      busy={saveGatewayPatch.isPending}
                      binding={widget.binding}
                    />
                  ))}
                  {usesHelpTagOverridesPanel && !compact ? (
                    <HelpTagOverridesPanel
                      className="mb-4"
                      fieldValues={fieldValues}
                      onFieldChange={(fieldName, value) =>
                        setFieldValues((prev) => ({ ...prev, [fieldName]: value }))
                      }
                    />
                  ) : null}
                  {formFields.length ? (
                    <DynamicConfigPanel
                      fields={formFields}
                      fieldGroups={cfgQ.data?.field_groups}
                      fieldValues={fieldValues}
                      onFieldChange={(name, value) =>
                        setFieldValues((prev) => ({ ...prev, [name]: value }))
                      }
                      groupTitles={groupTitles}
                      groupSubtitles={
                        groupSubtitlesProp ??
                        (cfgQ.data?.field_groups?.length
                          ? undefined
                          : {
                              // 仅单组「配置项」时保留原先说明；多 ui_group 用默认「共 N 项」
                              "ui:配置项": `共 ${formFields.length} 项参数，保存后按插件热重载策略生效`,
                              all: `共 ${formFields.length} 项参数，保存后按插件热重载策略生效`,
                            })
                      }
                      hideGroupHeaders={hideGroupHeaders}
                    />
                  ) : null}
                  {!isDialog ? (
                    <div className="mt-4">
                      <UiButton variant="primary" size="sm" disabled={saving} onClick={() => void save()}>
                        {saving ? "保存中…" : "保存配置"}
                      </UiButton>
                    </div>
                  ) : null}
                </StateBlock>
              ) : isHelpPlugin ? null : (
                <p className="muted plugin-config-page__fields-lead">该插件无可编辑配置字段</p>
              )}
            </>
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
