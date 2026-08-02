import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  deleteGroupConfig,
  deleteUserConfig,
  fetchDbHealth,
  fetchDbOverview,
  fetchDbTableRows,
  fetchDbTables,
  fetchGroupConfigs,
  fetchPlugins,
  fetchUserConfigs,
  postMongoAggregate,
} from "@/api/fullConsole";
import type {
  DbHealthData,
  DbHealthStatus,
  DbOverviewData,
  DbTableRowsData,
  GroupConfigPublic,
  UserConfigPublic,
} from "@/api/pallasTypes";
import { formatDisabledPluginIds } from "@/utils/pluginDisplay";
import { slicePage } from "@/utils/paginate";
import { rouletteModeLabel } from "@/utils/rouletteMode";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, { CHROME_SEARCH_INPUT, CHROME_SELECT_TRIGGER, CHROME_TOOLS_TRAILING } from "@/components/ChromeTools";
import ConsolePagerBar from "@/components/ConsolePagerBar";
import { ConsoleBlockSkeleton } from "@/components/ConsolePageSkeleton";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal";
import ConsoleTableEdit from "@/components/ConsoleTableEdit";
import DatabaseBackendPanel from "@/components/DatabaseBackendPanel";
import DatabaseMigratePanel from "@/components/DatabaseMigratePanel";
import PageMasthead from "@/components/PageMasthead";
import RefreshIconButton from "@/components/RefreshIconButton";
import GroupSocialConfigModal from "@/components/social/GroupSocialConfigModal";
import UserSocialConfigModal from "@/components/social/UserSocialConfigModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UiInput from "@/components/ui/UiInput";
import { useConsolePrefs } from "@/hooks/useConsolePrefs";
import { Code2, ChevronDown, Database, Eye, Layers, Play, Plus, Search, Table2, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import { cn } from "@/lib/utils";
import { preserveShellMainScroll } from "@/utils/preserveShellScroll";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BROWSE_ID_KEYS = ["account", "group_id", "user_id", "id"] as const;
const BROWSE_SUMMARY_MAX_COLS = 4;
const BROWSE_CELL_MAX_CHARS = 36;

function isBrowseScalar(value: unknown): boolean {
  return value == null || ["string", "number", "boolean"].includes(typeof value);
}

function browseRowIdLabel(row: Record<string, unknown>): string {
  for (const key of BROWSE_ID_KEYS) {
    if (key in row && row[key] != null) return `${key}=${String(row[key])}`;
  }
  return "行详情";
}

function browseSummaryColumns(rows: Record<string, unknown>[]): string[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0] ?? {});
  const preferred = BROWSE_ID_KEYS.filter((k) => keys.includes(k));
  const scalars = keys.filter(
    (k) =>
      !preferred.includes(k as (typeof BROWSE_ID_KEYS)[number]) &&
      rows.every((r) => isBrowseScalar(r[k])),
  );
  return [...preferred, ...scalars].slice(0, BROWSE_SUMMARY_MAX_COLS);
}

function formatBrowseCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const text = value.trim() || "—";
    return text.length > BROWSE_CELL_MAX_CHARS
      ? `${text.slice(0, BROWSE_CELL_MAX_CHARS)}…`
      : text;
  }
  if (Array.isArray(value)) return `数组(${value.length})`;
  if (typeof value === "object") return `对象(${Object.keys(value).length})`;
  return String(value);
}

function formatBrowseRowJson(row: Record<string, unknown>): string {
  try {
    return JSON.stringify(row, null, 2);
  } catch {
    return String(row);
  }
}

const CONFIG_LIST_LIMIT = 10_000;
const nf = new Intl.NumberFormat("zh-CN");

const DB_PANEL = "database-page__panel flex flex-col overflow-hidden shadow-none";
const DB_PANEL_HD =
  "panel__hd panel__hd--split flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const DB_PANEL_BD = "panel__bd px-4 pb-4 pt-3";

type DbSectionId = "backend" | "group" | "user" | "tables" | "aggregate";

const SECTION_META: Record<
  DbSectionId,
  { label: string; icon: LucideIcon; panelId: string }
> = {
  backend: { label: "后端", icon: Database, panelId: "db-backend-config" },
  group: { label: "群配置", icon: Users, panelId: "db-group-configs" },
  user: { label: "好友配置", icon: Users, panelId: "db-user-configs" },
  tables: { label: "存储", icon: Table2, panelId: "db-tables" },
  aggregate: { label: "聚合查询", icon: Code2, panelId: "db-aggregate" },
};

function isMongo(o: DbOverviewData | null): o is Extract<DbOverviewData, { backend: "mongodb" }> {
  return o != null && o.backend === "mongodb";
}

function isPostgres(o: DbOverviewData | null): o is Extract<DbOverviewData, { backend: "postgres" }> {
  return o != null && o.backend === "postgres";
}

function listNeedle(raw: string): string {
  return raw.trim().toLowerCase();
}

function rowMatchesNeedle(
  needle: string,
  parts: Array<string | number | null | undefined | boolean>,
): boolean {
  if (!needle) return true;
  return parts.some((p) => String(p ?? "").toLowerCase().includes(needle));
}

function sectionFromHash(hash: string): DbSectionId | null {
  const id = hash.replace(/^#/, "").trim();
  if (id === "db-backend-config") return "backend";
  if (id === "db-group-configs") return "group";
  if (id === "db-user-configs") return "user";
  if (id === "db-tables") return "tables";
  if (id === "db-aggregate") return "aggregate";
  return null;
}

function healthBadgeClass(status: DbHealthStatus | undefined): string {
  if (status === "healthy") return "badge badge--ok";
  if (status === "degraded") return "badge badge--warn";
  if (status === "unhealthy") return "badge badge--err";
  return "badge";
}

function healthStatusLabel(status: DbHealthStatus | undefined): string {
  if (status === "healthy") return "正常";
  if (status === "degraded") return "降级";
  if (status === "unhealthy") return "异常";
  return "未知";
}

function formatPoolUtil(health: DbHealthData | null | undefined): string {
  const util = health?.pool?.utilization;
  if (typeof util !== "number" || Number.isNaN(util)) return "—";
  return `${Math.round(util * 100)}%`;
}

export default function DatabasePage() {
  const prefs = useConsolePrefs();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [dbRefreshBusy, setDbRefreshBusy] = useState(false);
  const [section, setSection] = useState<DbSectionId>(
    () => sectionFromHash(typeof window !== "undefined" ? window.location.hash : "") ?? "group",
  );
  const [groupListQ, setGroupListQ] = useState("");
  const [userListQ, setUserListQ] = useState("");
  const [pageGroups, setPageGroups] = useState(1);
  const [pageUsers, setPageUsers] = useState(1);
  const [groupModalId, setGroupModalId] = useState<number | null>(null);
  const [userModal, setUserModal] = useState<{ id: number; defaultBanned?: boolean } | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(() => new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: "group"; ids: number[] } | { kind: "user"; ids: number[] } | null
  >(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");
  const [addUserInput, setAddUserInput] = useState("");
  const [addUserHint, setAddUserHint] = useState("");
  const [collection, setCollection] = useState("");
  const [pipelineText, setPipelineText] = useState('[\n  { "$limit": 20 }\n]');
  const [aggResult, setAggResult] = useState("");
  const [aggLoading, setAggLoading] = useState(false);
  const [browseTable, setBrowseTable] = useState("");
  const [browsePage, setBrowsePage] = useState(1);
  const [browseRows, setBrowseRows] = useState<DbTableRowsData | null>(null);
  const [browseBusy, setBrowseBusy] = useState(false);
  const [browseDetail, setBrowseDetail] = useState<Record<string, unknown> | null>(null);

  const overviewQ = useQuery({ queryKey: ["db-overview"], queryFn: fetchDbOverview });
  const healthQ = useQuery({
    queryKey: ["db-health"],
    queryFn: fetchDbHealth,
    refetchInterval: 15_000,
  });
  const tablesQ = useQuery({ queryKey: ["db-tables"], queryFn: fetchDbTables });
  const pluginsQ = useQuery({ queryKey: ["plugins-catalog"], queryFn: () => fetchPlugins() });
  const groupQ = useQuery({
    queryKey: ["group-configs"],
    queryFn: () => fetchGroupConfigs(CONFIG_LIST_LIMIT),
  });
  const userQ = useQuery({
    queryKey: ["user-configs"],
    queryFn: () => fetchUserConfigs(CONFIG_LIST_LIMIT),
  });

  const overview = overviewQ.data ?? null;
  const health = healthQ.data ?? null;
  const tableMeta = tablesQ.data?.tables ?? [];
  const socialConfigsBusy = groupQ.isFetching || userQ.isFetching;
  const groupConfigs = groupQ.data ?? [];
  const userConfigs = userQ.data ?? [];
  const plugins = pluginsQ.data ?? [];

  const mongoCollections = isMongo(overview) ? overview.collections : [];
  const pgTables = isPostgres(overview) ? overview.tables : [];
  const showAggregate = isMongo(overview);

  const sectionOptions = useMemo(() => {
    const ids: DbSectionId[] = ["backend", "group", "user", "tables"];
    if (showAggregate) ids.push("aggregate");
    return ids.map((id) => ({ id, ...SECTION_META[id] }));
  }, [showAggregate]);

  const activeSection = section === "aggregate" && !showAggregate ? "tables" : section;
  const activeMeta = SECTION_META[activeSection];

  const backendLabel = !overview
    ? "—"
    : overview.backend === "mongodb"
      ? "MongoDB"
      : overview.backend === "postgres"
        ? "PostgreSQL"
        : overview.backend;

  const totalDocuments = isMongo(overview)
    ? overview.collections.reduce((s, c) => s + (c.count ?? 0), 0)
    : null;
  const totalRows = isPostgres(overview)
    ? overview.tables.reduce((s, t) => s + (t.count ?? 0), 0)
    : null;

  const sortedGroupConfigs = useMemo(
    () => [...groupConfigs].sort((a, b) => a.group_id - b.group_id),
    [groupConfigs],
  );
  const sortedUserConfigs = useMemo(
    () => [...userConfigs].sort((a, b) => a.user_id - b.user_id),
    [userConfigs],
  );

  const filteredGroupConfigs = useMemo(() => {
    const needle = listNeedle(groupListQ);
    if (!needle) return sortedGroupConfigs;
    return sortedGroupConfigs.filter((g) =>
      rowMatchesNeedle(needle, [
        g.group_id,
        rouletteModeLabel(g.roulette_mode),
        g.banned ? "封禁" : "正常",
        formatDisabledPluginIds(g.disabled_plugins, plugins),
        (g.blocked_user_ids ?? []).length,
        ...(g.blocked_user_ids ?? []),
      ]),
    );
  }, [groupListQ, plugins, sortedGroupConfigs]);

  const filteredUserConfigs = useMemo(() => {
    const needle = listNeedle(userListQ);
    if (!needle) return sortedUserConfigs;
    return sortedUserConfigs.filter((u) =>
      rowMatchesNeedle(needle, [u.user_id, u.banned ? "封禁" : "正常"]),
    );
  }, [sortedUserConfigs, userListQ]);

  const pagedGroupConfigs = useMemo(
    () => slicePage(filteredGroupConfigs, pageGroups, prefs.tablePageSize),
    [filteredGroupConfigs, pageGroups, prefs.tablePageSize],
  );
  const pagedUserConfigs = useMemo(
    () => slicePage(filteredUserConfigs, pageUsers, prefs.tablePageSize),
    [filteredUserConfigs, pageUsers, prefs.tablePageSize],
  );

  const pagedGroupIds = useMemo(
    () => pagedGroupConfigs.map((g) => g.group_id),
    [pagedGroupConfigs],
  );
  const pagedUserIds = useMemo(
    () => pagedUserConfigs.map((u) => u.user_id),
    [pagedUserConfigs],
  );
  const groupPageAllSelected = useMemo(
    () => pagedGroupIds.length > 0 && pagedGroupIds.every((id) => selectedGroupIds.has(id)),
    [pagedGroupIds, selectedGroupIds],
  );
  const userPageAllSelected = useMemo(
    () => pagedUserIds.length > 0 && pagedUserIds.every((id) => selectedUserIds.has(id)),
    [pagedUserIds, selectedUserIds],
  );

  const socialSelectedCount =
    activeSection === "group"
      ? selectedGroupIds.size
      : activeSection === "user"
        ? selectedUserIds.size
        : 0;
  const socialPageAllSelected =
    activeSection === "group"
      ? groupPageAllSelected
      : activeSection === "user"
        ? userPageAllSelected
        : false;

  useEffect(() => {
    const fromHash = sectionFromHash(location.hash);
    if (fromHash && fromHash !== section) {
      setSection(fromHash);
      setSelectedGroupIds(new Set());
      setSelectedUserIds(new Set());
    }
  }, [location.hash]);

  useEffect(() => {
    if (section === "aggregate" && overview && !isMongo(overview)) {
      setSection("tables");
    }
  }, [overview, section]);

  function selectSection(id: DbSectionId) {
    preserveShellMainScroll(() => {
      setSection(id);
      setSelectedGroupIds(new Set());
      setSelectedUserIds(new Set());
      const nextHash = `#${SECTION_META[id].panelId}`;
      if (location.hash !== nextHash) {
        navigate({ pathname: location.pathname, search: location.search, hash: nextHash }, { replace: true });
      }
    });
  }

  function setGroupSelected(id: number, on: boolean) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setUserSelected(id: number, on: boolean) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAllGroupsOnPage() {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (groupPageAllSelected) {
        for (const id of pagedGroupIds) next.delete(id);
      } else {
        for (const id of pagedGroupIds) next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllUsersOnPage() {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (userPageAllSelected) {
        for (const id of pagedUserIds) next.delete(id);
      } else {
        for (const id of pagedUserIds) next.add(id);
      }
      return next;
    });
  }

  async function loadBrowseRows(table: string, page: number) {
    if (!table) {
      setBrowseRows(null);
      return;
    }
    setBrowseBusy(true);
    setErr("");
    try {
      const limit = prefs.tablePageSize;
      const data = await fetchDbTableRows({
        table,
        offset: Math.max(0, (page - 1) * limit),
        limit,
      });
      setBrowseRows(data);
    } catch (e) {
      setBrowseRows(null);
      setErr(axiosErrorDetail(e));
    } finally {
      setBrowseBusy(false);
    }
  }

  async function loadAll() {
    setErr("");
    setDbRefreshBusy(true);
    try {
      await Promise.all([overviewQ.refetch(), healthQ.refetch(), tablesQ.refetch()]);
      await Promise.all([groupQ.refetch(), userQ.refetch()]);
      if (browseTable) {
        await loadBrowseRows(browseTable, browsePage);
      }
    } catch (e) {
      setErr(axiosErrorDetail(e));
    } finally {
      setDbRefreshBusy(false);
    }
  }

  async function loadSocialConfigs() {
    setErr("");
    try {
      await Promise.all([groupQ.refetch(), userQ.refetch()]);
    } catch (e) {
      setErr(axiosErrorDetail(e));
    }
  }

  async function runAggregate() {
    setAggLoading(true);
    setAggResult("");
    setErr("");
    try {
      const pipeline = JSON.parse(pipelineText) as unknown[];
      const r = await postMongoAggregate({ collection: collection.trim(), pipeline });
      setAggResult(JSON.stringify(r, null, 2));
    } catch (e) {
      setErr(axiosErrorDetail(e));
    } finally {
      setAggLoading(false);
    }
  }

  function openAddUserConfig() {
    setAddUserHint("");
    const raw = addUserInput.trim();
    if (!raw) {
      setAddUserHint("请先填写 QQ 号");
      return;
    }
    const uid = parseInt(raw, 10);
    if (!Number.isFinite(uid) || uid < 1) {
      setAddUserHint("QQ 号格式不正确");
      return;
    }
    setUserModal({ id: uid, defaultBanned: true });
    setAddUserInput("");
  }

  function onSocialConfigSaved(kind: "group" | "user") {
    setOk(kind === "group" ? "群配置已保存" : "好友配置已保存");
    void loadSocialConfigs();
  }

  function onSocialConfigDeleted(kind: "group" | "user", id: number) {
    setOk(kind === "group" ? `已删除群配置 ${id}` : `已删除好友配置 ${id}`);
    setErr("");
    if (kind === "group") {
      setSelectedGroupIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      setSelectedUserIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    void loadSocialConfigs();
  }

  function openDeleteConfig(kind: "group" | "user", ids: number[]) {
    const unique = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
    if (!unique.length) return;
    setDeleteErr("");
    setDeleteTarget({ kind, ids: unique });
  }

  function closeDeleteConfig() {
    if (deleteBusy) return;
    setDeleteTarget(null);
    setDeleteErr("");
  }

  async function confirmDeleteConfig() {
    if (!deleteTarget) return;
    const { kind, ids } = deleteTarget;
    setDeleteBusy(true);
    setDeleteErr("");
    try {
      if (kind === "group") {
        for (const id of ids) {
          await deleteGroupConfig(id);
        }
        if (groupModalId != null && ids.includes(groupModalId)) setGroupModalId(null);
        setSelectedGroupIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
        setOk(ids.length === 1 ? `已删除群配置 ${ids[0]}` : `已删除 ${ids.length} 条群配置`);
      } else {
        for (const id of ids) {
          await deleteUserConfig(id);
        }
        if (userModal?.id != null && ids.includes(userModal.id)) setUserModal(null);
        setSelectedUserIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
        setOk(ids.length === 1 ? `已删除好友配置 ${ids[0]}` : `已删除 ${ids.length} 条好友配置`);
      }
      setErr("");
      setDeleteTarget(null);
      void loadSocialConfigs();
    } catch (e) {
      setDeleteErr(axiosErrorDetail(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  function onChromeRefresh() {
    if (activeSection === "backend") {
      void queryClient.invalidateQueries({ queryKey: ["db-backend-config"] });
      void queryClient.invalidateQueries({ queryKey: ["db-migrate-mongo-pg-info"] });
      void overviewQ.refetch();
      void healthQ.refetch();
      return;
    }
    if (activeSection === "group" || activeSection === "user") {
      void loadSocialConfigs();
      return;
    }
    void loadAll();
  }

  const chromeBusy =
    activeSection === "backend"
      ? overviewQ.isFetching || healthQ.isFetching
      : activeSection === "group" || activeSection === "user"
        ? socialConfigsBusy
        : dbRefreshBusy || overviewQ.isFetching || tablesQ.isFetching || browseBusy;
  const showBody = Boolean(overview) && !dbRefreshBusy;
  const browseableTables = tableMeta.filter((t) => t.browseable);
  const browseColumns = useMemo(
    () => browseSummaryColumns(browseRows?.rows ?? []),
    [browseRows],
  );
  const listSearch =
    activeSection === "group"
      ? {
          value: groupListQ,
          onChange: (v: string) => {
            setGroupListQ(v);
            setPageGroups(1);
          },
          placeholder: "搜索群号、轮盘、封禁…",
          title: "可按群号、轮盘模式、封禁、禁用插件、拉黑 QQ 筛选",
        }
      : activeSection === "user"
        ? {
            value: userListQ,
            onChange: (v: string) => {
              setUserListQ(v);
              setPageUsers(1);
            },
            placeholder: "搜索 QQ、封禁状态…",
            title: "可按 QQ、封禁状态筛选",
          }
        : null;

  const panelTitle =
    activeSection === "backend"
      ? "后端"
      : activeSection === "tables"
        ? browseTable
          ? `只读浏览 · ${browseTable}`
          : overview?.backend === "postgres"
            ? "表与行数"
            : "集合与文档数"
        : activeSection === "aggregate"
          ? "聚合查询"
          : activeMeta.label;

  function selectStorageView(next: string) {
    preserveShellMainScroll(() => {
      if (next === "__overview__" || !next) {
        setBrowseTable("");
        setBrowsePage(1);
        setBrowseRows(null);
      } else {
        setBrowseTable(next);
        setBrowsePage(1);
        void loadBrowseRows(next, 1);
      }
    });
  }

  return (
    <div className="database-page console-hub-page">
      {err ? <div className="alert alert--err">{err}</div> : null}
      {ok ? <div className="alert alert--ok">{ok}</div> : null}

      <PageMasthead title="数据库" description="切换后端、查看存储概况，并管理群与好友配置。" />

      {showBody || health ? (
        <section className="database-page__kpi home-kpi-bar">
          {showBody && overview ? (
            <div className="metric-tile">
              <div className="metric-tile__head">
                <span className="metric-tile__label">当前后端</span>
              </div>
              <div className="metric-tile__value-slot">
                <span className="metric-tile__value metric-tile__value--inline">{backendLabel}</span>
                {"note" in overview && overview.note ? (
                  <span className="database-page__kpi-hint muted" title={overview.note}>
                    {overview.note}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          {totalDocuments != null ? (
            <div className="metric-tile">
              <div className="metric-tile__head">
                <span className="metric-tile__label">文档合计</span>
              </div>
              <div className="metric-tile__value-slot">
                <span className="metric-tile__value metric-tile__value--inline">{nf.format(totalDocuments)}</span>
                <span className="database-page__kpi-hint muted">{mongoCollections.length} 个集合</span>
              </div>
            </div>
          ) : null}
          {totalRows != null ? (
            <div className="metric-tile">
              <div className="metric-tile__head">
                <span className="metric-tile__label">行数合计</span>
              </div>
              <div className="metric-tile__value-slot">
                <span className="metric-tile__value metric-tile__value--inline">{nf.format(totalRows)}</span>
                <span className="database-page__kpi-hint muted">{pgTables.length} 张表</span>
              </div>
            </div>
          ) : null}
          {health ? (
            <div className="metric-tile">
              <div className="metric-tile__head">
                <span className="metric-tile__label">健康</span>
              </div>
              <div className="metric-tile__value-slot">
                <span className={healthBadgeClass(health.status)}>{healthStatusLabel(health.status)}</span>
                <span
                  className="database-page__kpi-hint muted"
                  title={health.reason || undefined}
                >
                  池利用率 {formatPoolUtil(health)}
                  {health.reason ? ` · ${health.reason}` : ""}
                </span>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <ChromeTools>
        <ChromeField label="分区" icon={Layers} className="shrink-0">
          <Select value={activeSection} onValueChange={(v) => selectSection(v as DbSectionId)}>
            <SelectTrigger className={CHROME_SELECT_TRIGGER} aria-label="数据库分区">
              <SelectValue placeholder="选择分区" />
            </SelectTrigger>
            <SelectContent align="start">
              {sectionOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <ChromeOptionLabel icon={s.icon}>{s.label}</ChromeOptionLabel>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ChromeField>

        {activeSection === "tables" ? (
          <ChromeField label="视图" icon={Table2} className="shrink-0">
            <Combobox
              value={browseTable || "__overview__"}
              onValueChange={selectStorageView}
              ariaLabel="存储视图"
              placeholder="表总览"
              searchPlaceholder="搜索表名…"
              emptyText="无匹配表"
              searchCount={browseableTables.length}
              triggerClassName={cn(CHROME_SELECT_TRIGGER, "max-w-[16rem]")}
              options={[
                {
                  value: "__overview__",
                  label: <ChromeOptionLabel icon={Table2}>表总览</ChromeOptionLabel>,
                  keywords: "表总览 overview",
                },
                ...browseableTables.map((t) => ({
                  value: t.name,
                  label: t.name,
                  keywords: t.name,
                })),
              ]}
            />
          </ChromeField>
        ) : null}

        {listSearch ? (
          <div className="relative min-w-[8rem] flex-1 basis-[8rem]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <Input
              type="search"
              className={CHROME_SEARCH_INPUT}
              placeholder={listSearch.placeholder}
              title={listSearch.title}
              aria-label={listSearch.placeholder}
              autoComplete="off"
              value={listSearch.value}
              disabled={socialConfigsBusy}
              onChange={(e) => listSearch.onChange(e.target.value)}
            />
          </div>
        ) : null}

        {activeSection === "group" || activeSection === "user" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1"
                disabled={socialConfigsBusy || deleteBusy}
                aria-label="选项"
              >
                {deleteBusy
                  ? "处理中…"
                  : `选项${socialSelectedCount > 0 ? `（${socialSelectedCount}）` : ""}`}
                <ChevronDown className="size-3.5 opacity-70" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-0 w-max">
              <DropdownMenuItem
                disabled={
                  activeSection === "group"
                    ? pagedGroupIds.length === 0
                    : pagedUserIds.length === 0
                }
                onSelect={() => {
                  if (activeSection === "group") toggleSelectAllGroupsOnPage();
                  else toggleSelectAllUsersOnPage();
                }}
              >
                {socialPageAllSelected ? "取消全选" : "全选本页"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={socialSelectedCount === 0}
                onSelect={() => {
                  if (activeSection === "group") setSelectedGroupIds(new Set());
                  else setSelectedUserIds(new Set());
                }}
              >
                清除选择
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={socialSelectedCount === 0 || deleteBusy}
                onSelect={() => {
                  if (activeSection === "group") {
                    openDeleteConfig("group", [...selectedGroupIds]);
                  } else {
                    openDeleteConfig("user", [...selectedUserIds]);
                  }
                }}
              >
                删除选中
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <div className={CHROME_TOOLS_TRAILING}>
          {activeSection === "aggregate" ? (
            <Button
              type="button"
              size="sm"
              icon={Play}
              disabled={aggLoading || !collection.trim()}
              onClick={() => void runAggregate()}
            >
              {aggLoading ? "执行中…" : "执行"}
            </Button>
          ) : null}
          <RefreshIconButton
            busy={chromeBusy}
            label="刷新"
            showLabel
            onClick={() => onChromeRefresh()}
          />
        </div>
      </ChromeTools>

      <Card id={activeMeta.panelId} className={DB_PANEL}>
        <CardHeader className={DB_PANEL_HD}>
          <CardTitle className="panel__title flex items-center gap-1.5">
            <PanelTitleIcon icon={activeSection === "tables" && browseTable ? Table2 : activeMeta.icon} />
            {panelTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className={DB_PANEL_BD}>
          {activeSection === "backend" ? (
            <div className="space-y-6">
              <DatabaseBackendPanel
                onMessage={(kind, text) => {
                  if (kind === "ok") {
                    setOk(text);
                    setErr("");
                  } else {
                    setErr(text);
                    setOk("");
                  }
                }}
              />
              <div>
                <h3 className="mb-2 text-sm font-medium">MongoDB → PostgreSQL 迁移</h3>
                <DatabaseMigratePanel
                  onMessage={(kind, text) => {
                    if (kind === "ok") {
                      setOk(text);
                      setErr("");
                    } else {
                      setErr(text);
                      setOk("");
                    }
                  }}
                />
              </div>
            </div>
          ) : null}

          {activeSection === "group" ? (
            <>
              {pluginsQ.error ? (
                <p className="muted" style={{ margin: "0 0 10px" }}>
                  插件列表加载失败，禁用插件列可能显示不全：{axiosErrorDetail(pluginsQ.error)}
                </p>
              ) : null}
              {socialConfigsBusy && !groupConfigs.length ? (
                <ConsoleBlockSkeleton lines={5} label="正在加载群配置" />
              ) : !filteredGroupConfigs.length ? (
                <p className="muted">
                  {groupListQ.trim() && groupConfigs.length > 0 ? "没有匹配的群配置" : "暂无群配置"}
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data console-data-table">
                    <thead>
                      <tr>
                        <th className="database-social-select-col" aria-label="选择">
                          <input
                            type="checkbox"
                            checked={groupPageAllSelected}
                            disabled={deleteBusy || pagedGroupIds.length === 0}
                            aria-label={groupPageAllSelected ? "取消全选本页" : "全选本页"}
                            onChange={() => toggleSelectAllGroupsOnPage()}
                          />
                        </th>
                        <th>群号</th>
                        <th>封禁</th>
                        <th>轮盘</th>
                        <th>禁用插件</th>
                        <th>拉黑</th>
                        <th style={{ minWidth: 112, width: "1%" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedGroupConfigs.map((g: GroupConfigPublic) => (
                        <tr key={g.group_id}>
                          <td className="database-social-select-col">
                            <input
                              type="checkbox"
                              checked={selectedGroupIds.has(g.group_id)}
                              disabled={deleteBusy}
                              aria-label={`选择群 ${g.group_id}`}
                              onChange={(e) => setGroupSelected(g.group_id, e.target.checked)}
                            />
                          </td>
                          <td>{g.group_id}</td>
                          <td>
                            <span className={`badge ${g.banned ? "badge--warn" : "badge--ok"}`}>
                              {g.banned ? "是" : "否"}
                            </span>
                          </td>
                          <td>{rouletteModeLabel(g.roulette_mode)}</td>
                          <td className="muted">{formatDisabledPluginIds(g.disabled_plugins, plugins) || "—"}</td>
                          <td className="muted">
                            {(g.blocked_user_ids ?? []).length ? `${(g.blocked_user_ids ?? []).length} 人` : "—"}
                          </td>
                          <td>
                            <div className="console-table-actions">
                              <ConsoleTableEdit onClick={() => setGroupModalId(g.group_id)} />
                              <ConsoleTableEdit
                                label="删除"
                                variant="danger"
                                disabled={deleteBusy}
                                onClick={() => openDeleteConfig("group", [g.group_id])}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!socialConfigsBusy && filteredGroupConfigs.length > 0 ? (
                <ConsolePagerBar
                  page={pageGroups}
                  pageSize={prefs.tablePageSize}
                  total={filteredGroupConfigs.length}
                  onPageChange={setPageGroups}
                  onPageSizeChange={prefs.setTablePageSize}
                />
              ) : null}
            </>
          ) : null}

          {activeSection === "user" ? (
            <>
              <div className="database-user-config-add" style={{ marginBottom: 12 }}>
                <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
                  添加后可设置全局封禁（与私聊「牛牛拉黑」相同）。仅本群拉黑请到「群配置」里设置。
                </p>
                <div className="row-actions database-user-config-add__row">
                  <UiInput
                    className="database-user-config-add__inp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="QQ 号"
                    value={addUserInput}
                    disabled={socialConfigsBusy}
                    onValueChange={setAddUserInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        openAddUserConfig();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="database-user-config-add__btn"
                    icon={Plus}
                    disabled={socialConfigsBusy}
                    onClick={openAddUserConfig}
                  >
                    添加
                  </Button>
                </div>
                {addUserHint ? (
                  <p className="alert alert--err" style={{ margin: "8px 0 0", padding: "8px 10px", fontSize: 12 }}>
                    {addUserHint}
                  </p>
                ) : null}
              </div>
              {socialConfigsBusy && !userConfigs.length ? (
                <ConsoleBlockSkeleton lines={4} label="正在加载好友配置" />
              ) : !filteredUserConfigs.length ? (
                <p className="muted">
                  {userListQ.trim() && userConfigs.length > 0
                    ? "没有匹配的好友配置"
                    : "暂无好友配置，可用上方输入框添加"}
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data console-data-table">
                    <thead>
                      <tr>
                        <th className="database-social-select-col" aria-label="选择">
                          <input
                            type="checkbox"
                            checked={userPageAllSelected}
                            disabled={deleteBusy || pagedUserIds.length === 0}
                            aria-label={userPageAllSelected ? "取消全选本页" : "全选本页"}
                            onChange={() => toggleSelectAllUsersOnPage()}
                          />
                        </th>
                        <th>QQ</th>
                        <th>封禁</th>
                        <th style={{ minWidth: 112, width: "1%" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedUserConfigs.map((u: UserConfigPublic) => (
                        <tr key={u.user_id}>
                          <td className="database-social-select-col">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.has(u.user_id)}
                              disabled={deleteBusy}
                              aria-label={`选择 QQ ${u.user_id}`}
                              onChange={(e) => setUserSelected(u.user_id, e.target.checked)}
                            />
                          </td>
                          <td>{u.user_id}</td>
                          <td>
                            <span className={`badge ${u.banned ? "badge--warn" : "badge--ok"}`}>
                              {u.banned ? "是" : "否"}
                            </span>
                          </td>
                          <td>
                            <div className="console-table-actions">
                              <ConsoleTableEdit onClick={() => setUserModal({ id: u.user_id })} />
                              <ConsoleTableEdit
                                label="删除"
                                variant="danger"
                                disabled={deleteBusy}
                                onClick={() => openDeleteConfig("user", [u.user_id])}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!socialConfigsBusy && filteredUserConfigs.length > 0 ? (
                <ConsolePagerBar
                  page={pageUsers}
                  pageSize={prefs.tablePageSize}
                  total={filteredUserConfigs.length}
                  onPageChange={setPageUsers}
                  onPageSizeChange={prefs.setTablePageSize}
                />
              ) : null}
            </>
          ) : null}

          {activeSection === "tables" ? (
            browseTable ? (
              browseBusy && !browseRows ? (
                <ConsoleBlockSkeleton lines={4} label="正在加载行" />
              ) : browseRows ? (
                <>
                  <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
                    列表仅显示短字段；完整内容请点「查看」。
                    {browseBusy ? " 刷新中…" : ""}
                  </p>
                  <div className="table-wrap">
                    <table className="data console-data-table">
                      <thead>
                        <tr>
                          {browseColumns.map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                          <th style={{ minWidth: 72, width: "1%" }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {browseRows.rows.length ? (
                          browseRows.rows.map((r, idx) => (
                            <tr key={`${browseTable}-${idx}`}>
                              {browseColumns.map((col) => (
                                <td
                                  key={col}
                                  className="muted"
                                  style={{
                                    maxWidth: 140,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={formatBrowseCell(r[col])}
                                >
                                  {formatBrowseCell(r[col])}
                                </td>
                              ))}
                              <td>
                                <ConsoleTableEdit label="查看" onClick={() => setBrowseDetail(r)} />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              className="muted"
                              colSpan={Math.max(1, browseColumns.length) + 1}
                            >
                              暂无数据
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <ConsolePagerBar
                    page={browsePage}
                    pageSize={prefs.tablePageSize}
                    total={browseRows.total}
                    onPageChange={(p) => {
                      setBrowsePage(p);
                      void loadBrowseRows(browseTable, p);
                    }}
                    onPageSizeChange={(size) => {
                      prefs.setTablePageSize(size);
                      setBrowsePage(1);
                      void loadBrowseRows(browseTable, 1);
                    }}
                  />
                </>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  暂无数据
                </p>
              )
            ) : !overview && !tableMeta.length ? (
              <ConsoleBlockSkeleton lines={4} label="正在加载存储明细" />
            ) : (
              <div className="table-wrap">
                <table className="data console-data-table database-page__storage-table">
                  <thead>
                    <tr>
                      <th>{overview?.backend === "mongodb" ? "集合" : "表名"}</th>
                      {overview?.backend === "mongodb" ? <th>文档字段</th> : null}
                      <th>数量</th>
                      <th>浏览</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tableMeta.length
                      ? tableMeta.map((t) => ({
                          name: t.name,
                          document:
                            mongoCollections.find((c) => c.name === t.name)?.document ?? "—",
                          count: t.count ?? 0,
                          count_estimated: Boolean(t.count_estimated),
                          browseable: Boolean(t.browseable),
                        }))
                      : overview?.backend === "mongodb"
                        ? mongoCollections.map((c) => ({
                            name: c.name,
                            document: c.document,
                            count: c.count,
                            count_estimated: Boolean(c.count_estimated),
                            browseable: false,
                          }))
                        : pgTables.map((t) => ({
                            name: t.table,
                            document: "—",
                            count: t.count,
                            count_estimated: false,
                            browseable: false,
                          }))
                    ).map((row) => (
                      <tr key={row.name}>
                        <td style={{ fontWeight: 600 }}>{row.name}</td>
                        {overview?.backend === "mongodb" ? (
                          <td className="muted">{row.document}</td>
                        ) : null}
                        <td
                          style={{ fontVariantNumeric: "tabular-nums" }}
                          title={row.count_estimated ? "估算值（集合较大时）" : undefined}
                        >
                          {row.count_estimated ? "≈" : ""}
                          {nf.format(row.count)}
                        </td>
                        <td>
                          {row.browseable ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              icon={Eye}
                              onClick={() => selectStorageView(row.name)}
                            >
                              只读
                            </Button>
                          ) : (
                            <span className="muted">概览</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {activeSection === "aggregate" && showAggregate ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                  集合
                </label>
                {mongoCollections.length ? (
                  <Combobox
                    value={collection || "__none__"}
                    onValueChange={(v) => setCollection(v === "__none__" ? "" : v)}
                    ariaLabel="集合"
                    placeholder="选择集合"
                    searchPlaceholder="搜索集合…"
                    emptyText="无匹配集合"
                    searchCount={mongoCollections.length}
                    triggerClassName="h-9 w-full max-w-[26.25rem]"
                    options={[
                      { value: "__none__", label: "选择集合", keywords: "选择集合" },
                      ...mongoCollections.map((c) => ({
                        value: c.name,
                        label: `${c.name}（${nf.format(c.count)}）`,
                        keywords: c.name,
                      })),
                    ]}
                  />
                ) : (
                  <div style={{ maxWidth: 360, width: "100%" }}>
                    <UiInput placeholder="集合名" value={collection} onValueChange={setCollection} />
                  </div>
                )}
              </div>
              <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                聚合管道（JSON 数组）
              </label>
              <textarea
                className="inp"
                rows={8}
                value={pipelineText}
                spellCheck={false}
                placeholder='例如 [{"$limit":20}]'
                onChange={(e) => setPipelineText(e.target.value)}
              />
              {aggResult ? (
                <div style={{ marginTop: 16 }}>
                  <div className="muted" style={{ marginBottom: 8 }}>
                    查询结果
                  </div>
                  <pre className="pre-block">{aggResult}</pre>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <GroupSocialConfigModal
        open={groupModalId != null}
        groupId={groupModalId}
        onOpenChange={(o) => {
          if (!o) setGroupModalId(null);
        }}
        onSaved={() => onSocialConfigSaved("group")}
        onDeleted={() => {
          if (groupModalId != null) onSocialConfigDeleted("group", groupModalId);
        }}
      />
      <UserSocialConfigModal
        open={userModal != null}
        userId={userModal?.id ?? null}
        defaultBanned={userModal?.defaultBanned}
        onOpenChange={(o) => {
          if (!o) setUserModal(null);
        }}
        onSaved={() => onSocialConfigSaved("user")}
        onDeleted={() => {
          if (userModal?.id != null) onSocialConfigDeleted("user", userModal.id);
        }}
      />

      <ConsoleDeleteConfirmModal
        open={deleteTarget != null}
        title={deleteTarget?.kind === "user" ? "删除好友配置" : "删除群配置"}
        subtitle={
          deleteTarget?.kind === "user"
            ? `将移除以下好友的 user_config 记录（共 ${deleteTarget.ids.length} 条，含全局封禁等），操作不可撤销。`
            : deleteTarget
              ? `将移除以下群的 group_config 记录（共 ${deleteTarget.ids.length} 条，含封禁、轮盘、禁用插件、拉黑等），操作不可撤销。`
              : ""
        }
        items={
          deleteTarget
            ? deleteTarget.ids.map((id) => ({
                key: String(id),
                label: deleteTarget.kind === "user" ? `QQ ${id}` : `群 ${id}`,
              }))
            : []
        }
        listLabel={deleteTarget?.kind === "user" ? "好友" : "群"}
        busy={deleteBusy}
        error={deleteErr}
        titleId="db-social-config-delete-title"
        onClose={closeDeleteConfig}
        onConfirm={() => void confirmDeleteConfig()}
      />

      <Dialog
        open={browseDetail != null}
        onOpenChange={(open) => {
          if (!open) setBrowseDetail(null);
        }}
      >
        <DialogContent className="max-w-[min(42rem,calc(100vw-24px))] gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-3 text-left">
            <DialogTitle className="text-left">
              {browseTable ? `${browseTable} · ` : ""}
              {browseDetail ? browseRowIdLabel(browseDetail) : "行详情"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(70vh,36rem)] overflow-auto px-4 py-3">
            <pre className="pre-block" style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {browseDetail ? formatBrowseRowJson(browseDetail) : ""}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
