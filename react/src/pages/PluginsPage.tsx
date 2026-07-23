import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Cpu, FolderOpen, Globe, Puzzle, RefreshCw, Search, Tags } from "lucide-react";
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
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools from "@/components/ChromeTools";
import PluginCatalogCard from "@/components/PluginCatalogCard";
import PluginConfigDialog from "@/components/PluginConfigDialog";
import PageMasthead from "@/components/PageMasthead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { reloadPolicyLabel } from "@/utils/reloadPolicyLabel";
import { usePluginFavorites } from "@/hooks/usePluginFavorites";
import {
  buildPluginIconMap,
  resolvePluginIconForRow,
  shouldShowPluginAvatar,
} from "@/utils/pluginIconUrl";
import { catalogProcessHint } from "@/utils/pluginLoadRoleLabel";

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
        <PageMasthead
          title="插件管理"
          description="编辑已加载插件的权限、冷却与参数。"
        />

        {processHint ? (
          <p className="muted console-hub-page__lead plugins-page__hero-note--shard">{processHint}</p>
        ) : null}

        <ChromeTools>
          <div className="relative min-w-[8rem] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
            <Input
              type="search"
              className="h-8 min-h-8 w-full pl-8"
              placeholder="搜索插件名、ID 或说明…"
              aria-label="搜索插件名、ID 或说明"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <ChromeField label="分类" icon={Tags}>
            <Select
              value={activeCategory}
              onValueChange={(v) => setActiveCategory(v as PluginCategory | "all")}
            >
              <SelectTrigger
                className="h-8 w-auto shrink-0 whitespace-nowrap [&>span]:whitespace-nowrap"
                aria-label="插件分类"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="min-w-[8.5rem]">
                {PLUGIN_LIST_CATEGORY_TABS.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    <ChromeOptionLabel
                      icon={
                        tab.id === "all"
                          ? Globe
                          : tab.id === "core"
                            ? Cpu
                            : tab.id === "extra"
                              ? Puzzle
                              : FolderOpen
                      }
                    >
                      {tab.label}
                    </ChromeOptionLabel>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ChromeField>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pluginsQ.isFetching}
              onClick={() => void pluginsQ.refetch()}
            >
              <RefreshCw className={cn("size-3.5", pluginsQ.isFetching && "animate-spin")} />
              {pluginsQ.isFetching ? "刷新中…" : "刷新"}
            </Button>
          </div>
        </ChromeTools>

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
