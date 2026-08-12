import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Cpu, FolderOpen, Globe, Puzzle, RefreshCw, Search, Tags, Users } from "lucide-react";
import {
  fetchCommunityPluginStore,
  fetchOfficialExtensions,
  fetchPlugins,
} from "@/api/console";
import type { OfficialExtensionRow, PluginRow } from "@/api/console";
import {
  PLUGIN_LIST_CATEGORY_TABS,
  pluginCategory,
  type PluginCategory,
} from "@/utils/pluginCategory";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, { CHROME_SEARCH_INPUT, CHROME_SELECT_TRIGGER, CHROME_TOOLS_TRAILING } from "@/components/ChromeTools";
import PluginCatalogCard from "@/components/PluginCatalogCard";
import PluginConfigDialog from "@/components/PluginConfigDialog";
import PluginUninstallDialog from "@/components/PluginUninstallDialog";
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
  const [iconByPlugin, setIconByPlugin] = useState<Record<string, string>>({});
  const [uninstallRow, setUninstallRow] = useState<PluginRow | null>(null);

  const pluginsQ = useQuery<PluginRow[]>({ queryKey: ["plugins"], queryFn: () => fetchPlugins() });
  const officialQ = useQuery<OfficialExtensionRow[]>({
    queryKey: ["official-extensions"],
    queryFn: () => fetchOfficialExtensions(),
  });
  const communityQ = useQuery({
    queryKey: ["community-store"],
    queryFn: () => fetchCommunityPluginStore().catch(() => ({ plugins: [] })),
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
    const pinAfterFavorites = (row: PluginRow) => {
      const id = (row.name || "").trim().toLowerCase();
      return id === "pb_core" ? 1 : 2;
    };
    rows.sort((a, b) => {
      const fa = favorites.has(a.name) ? 0 : 1;
      const fb = favorites.has(b.name) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      if (fa === 1) {
        const pa = pinAfterFavorites(a);
        const pb = pinAfterFavorites(b);
        if (pa !== pb) return pa - pb;
      }
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
              className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <Input
              type="search"
              className={CHROME_SEARCH_INPUT}
              placeholder="搜索插件…"
              aria-label="搜索插件"
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
                className={cn(CHROME_SELECT_TRIGGER, "whitespace-nowrap [&>span]:whitespace-nowrap")}
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
                          : tab.id === "official"
                            ? Puzzle
                            : tab.id === "community"
                              ? Users
                              : tab.id === "nonebot"
                                ? Boxes
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
          <div className={CHROME_TOOLS_TRAILING}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              iconMotion="spin"
              iconBusy={pluginsQ.isFetching}
              disabled={pluginsQ.isFetching}
              onClick={() => void pluginsQ.refetch()}
            >
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
                  onUninstall={() => setUninstallRow(p)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <PluginConfigDialog
        open={configDialogOpen}
        pluginName={selectedPluginName}
        pluginRow={selectedPluginRow}
        officialExtensions={officialQ.data || []}
        communityPlugins={communityQ.data?.plugins || []}
        onClose={closeConfigDialog}
        onUninstall={() => setUninstallRow(selectedPluginRow)}
      />

      <PluginUninstallDialog
        open={Boolean(uninstallRow)}
        pluginRow={uninstallRow}
        onClose={() => setUninstallRow(null)}
        onUninstalled={() => {
          void pluginsQ.refetch();
          void officialQ.refetch();
          void communityQ.refetch();
        }}
      />
    </div>
  );
}
