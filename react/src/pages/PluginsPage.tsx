import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCommunityPluginStore,
  fetchOfficialExtensions,
  fetchPlugins,
} from "@/api/console";
import type { OfficialExtensionRow, PluginRow } from "@/api/console";
import { fetchPluginCapabilities } from "@/api/fullConsole";
import {
  PLUGIN_LIST_CATEGORY_TABS,
  pluginCategory,
  type PluginCategory,
} from "@/utils/pluginCategory";
import ConsoleHubSearch from "@/components/ConsoleHubSearch";
import PluginCatalogCard from "@/components/PluginCatalogCard";
import PluginConfigDialog from "@/components/PluginConfigDialog";
import PageHeader from "@/components/PageHeader";
import RefreshIconButton from "@/components/RefreshIconButton";
import { reloadPolicyLabel } from "@/utils/reloadPolicyLabel";
import { usePluginFavorites } from "@/hooks/usePluginFavorites";
import {
  buildPluginIconMap,
  resolvePluginIconForRow,
  shouldShowPluginAvatar,
} from "@pallas-vue/utils/pluginIconUrl";
import { catalogProcessHint } from "@pallas-vue/utils/pluginLoadRoleLabel";
import { cn } from "@/lib/utils";

export default function PluginsPage() {
  const { name: routeName } = useParams();
  const navigate = useNavigate();
  const { favorites } = usePluginFavorites();
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState<PluginCategory | "all">("all");
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false);
  const [iconByPlugin, setIconByPlugin] = useState<Record<string, string>>({});

  const pluginsQ = useQuery<PluginRow[]>({ queryKey: ["plugins"], queryFn: () => fetchPlugins() });
  const officialQ = useQuery<OfficialExtensionRow[]>({
    queryKey: ["official-extensions"],
    queryFn: () => fetchOfficialExtensions(),
  });
  const communityQ = useQuery({
    queryKey: ["community-store"],
    queryFn: () => fetchCommunityPluginStore().catch(() => ({ plugins: [] })),
  });
  const capabilitiesQ = useQuery({
    queryKey: ["plugin-capabilities"],
    queryFn: () => fetchPluginCapabilities().catch(() => ({ plugins: [] })),
  });

  const selectedPluginName = (routeName || "").trim();
  const configDialogOpen = Boolean(selectedPluginName);

  useEffect(() => {
    const official = officialQ.data || [];
    const community = communityQ.data?.plugins || [];
    const storeMeta = (communityQ.data as { meta?: { updated_at?: unknown } } | undefined)?.meta;
    const indexUpdatedAt =
      storeMeta && typeof storeMeta === "object"
        ? String(storeMeta.updated_at ?? "").trim()
        : "";
    setIconByPlugin(
      buildPluginIconMap(
        official as Parameters<typeof buildPluginIconMap>[0],
        community as Parameters<typeof buildPluginIconMap>[1],
        { indexUpdatedAt },
      ),
    );
  }, [officialQ.data, communityQ.data]);

  const sortedPlugins = useMemo(() => {
    const rows = [...((pluginsQ.data || []) as PluginRow[])];
    rows.sort((a, b) => {
      const fa = favorites.has(a.name) ? 1 : 0;
      const fb = favorites.has(b.name) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      const na = (a.metadata?.name || a.name).toLowerCase();
      const nb = (b.metadata?.name || b.name).toLowerCase();
      return na.localeCompare(nb, "zh-CN");
    });
    return rows;
  }, [pluginsQ.data, favorites]);

  const filtered = useMemo(() => {
    const official = officialQ.data || [];
    const s = q.trim().toLowerCase();
    const cat = activeCategory;
    return sortedPlugins.filter((p) => {
      if (cat !== "all" && pluginCategory(p, official) !== cat) return false;
      if (!s) return true;
      const displayName = (p.metadata?.name || p.name).toLowerCase();
      const id = p.name.toLowerCase();
      const desc = (p.metadata?.description || "").toLowerCase();
      return displayName.includes(s) || id.includes(s) || desc.includes(s) || p.module.toLowerCase().includes(s);
    });
  }, [sortedPlugins, officialQ.data, q, activeCategory]);

  const selectedPluginRow = useMemo(
    () => (pluginsQ.data || []).find((p) => p.name === selectedPluginName) ?? null,
    [pluginsQ.data, selectedPluginName],
  );

  const capabilitiesSorted = useMemo(
    () =>
      [...(capabilitiesQ.data?.plugins || [])].sort((a, b) =>
        (a.title || a.plugin).localeCompare(b.title || b.plugin, "zh-CN"),
      ),
    [capabilitiesQ.data],
  );

  const catalogProcessRole = useMemo(
    () => (pluginsQ.data || []).find((p) => p.catalog_process_role)?.catalog_process_role,
    [pluginsQ.data],
  );

  const processHint = catalogProcessHint(catalogProcessRole);

  function pluginIconUrl(row: PluginRow): string {
    return resolvePluginIconForRow(row, iconByPlugin);
  }

  function pluginAvatarUrl(row: PluginRow): string {
    const avatar = (row.avatar || "").trim();
    const icon = pluginIconUrl(row);
    return shouldShowPluginAvatar(icon, avatar) ? avatar : "";
  }

  useEffect(() => {
    if (!selectedPluginName || pluginsQ.isLoading) return;
    const pool = filtered.length ? filtered : sortedPlugins;
    if (!pool.some((p) => p.name === selectedPluginName)) {
      navigate("/plugins", { replace: true });
    }
  }, [selectedPluginName, filtered, sortedPlugins, pluginsQ.isLoading, navigate]);

  function selectPlugin(pluginName: string) {
    if (selectedPluginName === pluginName && configDialogOpen) return;
    navigate(`/plugins/${encodeURIComponent(pluginName)}`);
  }

  function closeConfigDialog() {
    if (selectedPluginName) navigate("/plugins", { replace: true });
  }

  return (
    <div className="plugins-page plugins-page--hub console-hub-page">
      <div className="plugins-page__body">
        <PageHeader
          title="插件管理"
          description="点击卡片「编辑配置」在弹窗中调整权限、冷却、运行开关与插件参数；README 可在弹窗分栏查看。"
          actions={
            <RefreshIconButton
              embedded
              busy={pluginsQ.isFetching}
              label="刷新"
              showLabel
              onClick={() => void pluginsQ.refetch()}
            />
          }
        />

        {processHint ? (
          <p className="muted console-hub-page__lead plugins-page__hero-note--shard">{processHint}</p>
        ) : null}

        <ConsoleHubSearch
          placeholder="搜索插件名、ID 或说明…"
          value={q}
          onValueChange={setQ}
        />

        <div className="console-hub-page__filter-bar">
          <div className="console-view-toggle console-view-toggle--full" role="tablist" aria-label="插件分类">
            {PLUGIN_LIST_CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className={cn(activeCategory === tab.id && "is-on")}
                aria-selected={activeCategory === tab.id}
                onClick={() => setActiveCategory(tab.id)}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {pluginsQ.isError ? (
          <p className="alert alert--err text-sm">加载失败：{(pluginsQ.error as Error).message}</p>
        ) : null}

        <section className="plugins-page__catalog" aria-label="已加载插件">
          <div className="plugins-page__catalog-hd">
            <h2 className="plugins-page__catalog-title">已加载插件</h2>
            <span className="muted plugins-page__catalog-count">
              共 {pluginsQ.data?.length ?? 0} 个
              {filtered.length !== (pluginsQ.data?.length ?? 0) ? <> · 显示 {filtered.length}</> : null}
            </span>
          </div>

          {!pluginsQ.isLoading && filtered.length === 0 ? (
            <p className="muted plugins-page__empty">
              {(pluginsQ.data?.length ?? 0) ? "没有符合搜索条件的插件。" : "暂无已加载插件。"}
            </p>
          ) : (
            <div className="plugins-page__plugin-grid">
              {filtered.map((p) => (
                <PluginCatalogCard
                  key={`${p.module}:${p.name}`}
                  plugin={p}
                  iconUrl={pluginIconUrl(p)}
                  avatarUrl={pluginAvatarUrl(p)}
                  active={selectedPluginName === p.name && configDialogOpen}
                  onSelect={() => selectPlugin(p.name)}
                />
              ))}
            </div>
          )}
        </section>

        {capabilitiesSorted.length ? (
          <div className="plugins-page__capabilities-overview">
            <div className="plugins-page__capabilities-hd">
              <h2 className="plugins-page__capabilities-title">
                插件能力总览
                <button
                  type="button"
                  className="panel-hd-collapse-caret"
                  aria-expanded={capabilitiesOpen}
                  aria-label={capabilitiesOpen ? "收起插件能力总览" : "展开插件能力总览"}
                  onClick={() => setCapabilitiesOpen((v) => !v)}
                >
                  {capabilitiesOpen ? "▾" : "▸"}
                </button>
              </h2>
              <div className="row-actions plugins-page__capabilities-hd-actions">
                <span className="muted plugins-page__catalog-count">{capabilitiesSorted.length} 个插件</span>
              </div>
            </div>
            {capabilitiesOpen ? (
              <div className="plugins-page__capabilities-bd">
                <p className="muted plugins-page__capabilities-note">
                  聚合命令权限、冷却、LLM 工具与存储键声明；热重载策略分为仅配置、配置与说明、含代码变更三档。
                </p>
                <div className="table-wrap plugins-page__capabilities-table-wrap">
                  <table className="data console-data-table plugins-page__capabilities-table">
                    <thead>
                      <tr>
                        <th>插件</th>
                        <th>命令</th>
                        <th>LLM</th>
                        <th>存储</th>
                        <th>热重载</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capabilitiesSorted.map((row) => (
                        <tr key={row.plugin}>
                          <td>
                            <div className="plugins-page__cap-plugin-title">{row.title || row.plugin}</div>
                            <div className="muted plugins-page__cap-plugin-id">{row.plugin}</div>
                          </td>
                          <td>{row.commands.length}</td>
                          <td>{row.llm_tools.length}</td>
                          <td>{row.storage_keys.length}</td>
                          <td>{reloadPolicyLabel(row.reload_policy)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="plugins-page__capabilities-cards">
                  {capabilitiesSorted.map((row) => (
                    <li key={`card-${row.plugin}`} className="plugins-page__capabilities-card">
                      <div className="plugins-page__cap-plugin-title">{row.title || row.plugin}</div>
                      <div className="muted plugins-page__cap-plugin-id">{row.plugin}</div>
                      <dl className="plugins-page__capabilities-card-dl">
                        <div>
                          <dt>命令</dt>
                          <dd>{row.commands.length}</dd>
                        </div>
                        <div>
                          <dt>LLM</dt>
                          <dd>{row.llm_tools.length}</dd>
                        </div>
                        <div>
                          <dt>存储</dt>
                          <dd>{row.storage_keys.length}</dd>
                        </div>
                        <div>
                          <dt>热重载</dt>
                          <dd>{reloadPolicyLabel(row.reload_policy)}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <PluginConfigDialog
        open={configDialogOpen}
        pluginName={selectedPluginName}
        pluginRow={selectedPluginRow}
        officialExtensions={officialQ.data || []}
        communityPlugins={communityQ.data?.plugins || []}
        onClose={closeConfigDialog}
      />
    </div>
  );
}
