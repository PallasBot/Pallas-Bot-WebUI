import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchDbOverview,
  fetchGroupConfigs,
  fetchPlugins,
  fetchUserConfigs,
  postMongoAggregate,
} from "@/api/fullConsole";
import type { DbOverviewData, GroupConfigPublic, UserConfigPublic } from "@/api/pallasTypes";
import { formatDisabledPluginIds } from "@/utils/pluginDisplay";
import { slicePage } from "@/utils/paginate";
import { rouletteModeLabel } from "@/utils/rouletteMode";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools from "@/components/ChromeTools";
import ConsolePagerBar from "@/components/ConsolePagerBar";
import { ConsoleBlockSkeleton } from "@/components/ConsolePageSkeleton";
import ConsoleTableEdit from "@/components/ConsoleTableEdit";
import PageMasthead from "@/components/PageMasthead";
import RefreshIconButton from "@/components/RefreshIconButton";
import GroupSocialConfigModal from "@/components/social/GroupSocialConfigModal";
import UserSocialConfigModal from "@/components/social/UserSocialConfigModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Code2, Search, Table2, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";

const CONFIG_LIST_LIMIT = 10_000;
const nf = new Intl.NumberFormat("zh-CN");

const DB_PANEL = "database-page__panel flex flex-col overflow-hidden shadow-none";
const DB_PANEL_HD =
  "panel__hd panel__hd--split flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const DB_PANEL_BD = "panel__bd px-4 pb-4 pt-3";

type DbSectionId = "group" | "user" | "tables" | "aggregate";

const SECTION_META: Record<
  DbSectionId,
  { label: string; icon: LucideIcon; panelId: string }
> = {
  group: { label: "群配置", icon: Users, panelId: "db-group-configs" },
  user: { label: "好友配置", icon: Users, panelId: "db-user-configs" },
  tables: { label: "表", icon: Table2, panelId: "db-tables" },
  aggregate: { label: "函数", icon: Code2, panelId: "db-aggregate" },
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
  if (id === "db-group-configs") return "group";
  if (id === "db-user-configs") return "user";
  if (id === "db-tables") return "tables";
  if (id === "db-aggregate") return "aggregate";
  return null;
}

export default function DatabasePage() {
  const prefs = useConsolePrefs();
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
  const [addUserInput, setAddUserInput] = useState("");
  const [addUserHint, setAddUserHint] = useState("");
  const [collection, setCollection] = useState("");
  const [pipelineText, setPipelineText] = useState('[\n  { "$limit": 20 }\n]');
  const [aggResult, setAggResult] = useState("");
  const [aggLoading, setAggLoading] = useState(false);

  const overviewQ = useQuery({ queryKey: ["db-overview"], queryFn: fetchDbOverview });
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
  const socialConfigsBusy = groupQ.isFetching || userQ.isFetching;
  const groupConfigs = groupQ.data ?? [];
  const userConfigs = userQ.data ?? [];
  const plugins = pluginsQ.data ?? [];

  const mongoCollections = isMongo(overview) ? overview.collections : [];
  const pgTables = isPostgres(overview) ? overview.tables : [];
  const showAggregate = isMongo(overview);

  const sectionOptions = useMemo(() => {
    const ids: DbSectionId[] = ["group", "user", "tables"];
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

  useEffect(() => {
    const fromHash = sectionFromHash(location.hash);
    if (fromHash && fromHash !== section) setSection(fromHash);
  }, [location.hash]);

  useEffect(() => {
    if (section === "aggregate" && overview && !isMongo(overview)) {
      setSection("tables");
    }
  }, [overview, section]);

  function selectSection(id: DbSectionId) {
    setSection(id);
    const nextHash = `#${SECTION_META[id].panelId}`;
    if (location.hash !== nextHash) {
      navigate({ pathname: location.pathname, search: location.search, hash: nextHash }, { replace: true });
    }
  }

  async function loadAll() {
    setErr("");
    setDbRefreshBusy(true);
    try {
      await overviewQ.refetch();
      await Promise.all([groupQ.refetch(), userQ.refetch()]);
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
      setAddUserHint("请输入 QQ 号。");
      return;
    }
    const uid = parseInt(raw, 10);
    if (!Number.isFinite(uid) || uid < 1) {
      setAddUserHint("请输入有效的 QQ 号。");
      return;
    }
    setUserModal({ id: uid, defaultBanned: true });
    setAddUserInput("");
  }

  function onSocialConfigSaved(kind: "group" | "user") {
    setOk(kind === "group" ? "群配置已保存。" : "好友配置已保存。");
    void loadSocialConfigs();
  }

  function onChromeRefresh() {
    if (activeSection === "group" || activeSection === "user") {
      void loadSocialConfigs();
      return;
    }
    void loadAll();
  }

  const chromeBusy =
    activeSection === "group" || activeSection === "user"
      ? socialConfigsBusy
      : dbRefreshBusy || overviewQ.isFetching;
  const showBody = overview && !dbRefreshBusy;
  const listSearch =
    activeSection === "group"
      ? {
          value: groupListQ,
          onChange: (v: string) => {
            setGroupListQ(v);
            setPageGroups(1);
          },
          placeholder: "搜索群配置…",
          title: "按群号、轮盘模式、封禁状态、禁用插件、拉黑 QQ 筛选",
        }
      : activeSection === "user"
        ? {
            value: userListQ,
            onChange: (v: string) => {
              setUserListQ(v);
              setPageUsers(1);
            },
            placeholder: "搜索好友配置…",
            title: "按 QQ、封禁状态筛选",
          }
        : null;

  const panelTitle =
    activeSection === "tables"
      ? overview?.backend === "postgres"
        ? "表与行数"
        : "集合与文档数"
      : activeSection === "aggregate"
        ? "MongoDB 聚合"
        : activeMeta.label;

  return (
    <div className="database-page console-hub-page">
      {err ? <div className="alert alert--err">{err}</div> : null}
      {ok ? <div className="alert alert--ok">{ok}</div> : null}

      <PageMasthead title="数据库总览" description="后端概览与群 / 好友配置。" />

      {showBody ? (
        <section className="database-page__kpi home-kpi-bar">
          <div className="metric-tile">
            <div className="metric-tile__head">
              <span className="metric-tile__label">后端类型</span>
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
          {totalDocuments != null ? (
            <div className="metric-tile">
              <div className="metric-tile__head">
                <span className="metric-tile__label">集合文档（合计）</span>
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
                <span className="metric-tile__label">表行数（合计）</span>
              </div>
              <div className="metric-tile__value-slot">
                <span className="metric-tile__value metric-tile__value--inline">{nf.format(totalRows)}</span>
                <span className="database-page__kpi-hint muted">{pgTables.length} 张表</span>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <ChromeTools>
        <ChromeField label="选择" icon={activeMeta.icon} className="shrink-0">
          <Select value={activeSection} onValueChange={(v) => selectSection(v as DbSectionId)}>
            <SelectTrigger className="h-8 w-auto min-w-[7.5rem] max-w-[12rem] shrink-0 gap-1.5" aria-label="数据库分段">
              <SelectValue placeholder="选择" />
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

        {listSearch ? (
          <div className="relative min-w-[8rem] flex-1 basis-[8rem]">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <Input
              type="search"
              className="h-8 min-h-8 w-full pl-8"
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

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {activeSection === "aggregate" ? (
            <Button
              type="button"
              size="sm"
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
            <PanelTitleIcon icon={activeMeta.icon} />
            {panelTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className={DB_PANEL_BD}>
          {activeSection === "group" ? (
            <>
              {pluginsQ.error ? (
                <p className="muted" style={{ margin: "0 0 10px" }}>
                  插件列表加载失败，禁用插件列可能不完整：{axiosErrorDetail(pluginsQ.error)}
                </p>
              ) : null}
              {socialConfigsBusy && !groupConfigs.length ? (
                <ConsoleBlockSkeleton lines={5} label="群配置加载中" />
              ) : !filteredGroupConfigs.length ? (
                <p className="muted">
                  {groupListQ.trim() && groupConfigs.length > 0 ? "无匹配结果。" : "数据库中暂无群配置记录。"}
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data console-data-table">
                    <thead>
                      <tr>
                        <th>群号</th>
                        <th>封禁</th>
                        <th>轮盘</th>
                        <th>禁用插件</th>
                        <th>拉黑</th>
                        <th style={{ minWidth: 88, width: "1%" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedGroupConfigs.map((g: GroupConfigPublic) => (
                        <tr key={g.group_id}>
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
                            <ConsoleTableEdit onClick={() => setGroupModalId(g.group_id)} />
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
                  输入 QQ 号后点击添加并设置封禁。此为全局拉黑，与私聊「牛牛拉黑」写入同一字段；本群维度拉黑请在群配置中维护。
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
                <ConsoleBlockSkeleton lines={4} label="好友配置加载中" />
              ) : !filteredUserConfigs.length ? (
                <p className="muted">
                  {userListQ.trim() && userConfigs.length > 0
                    ? "无匹配结果。"
                    : "数据库中暂无好友配置记录，可使用上方输入框添加。"}
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data console-data-table">
                    <thead>
                      <tr>
                        <th>QQ</th>
                        <th>封禁</th>
                        <th style={{ minWidth: 88, width: "1%" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedUserConfigs.map((u: UserConfigPublic) => (
                        <tr key={u.user_id}>
                          <td>{u.user_id}</td>
                          <td>
                            <span className={`badge ${u.banned ? "badge--warn" : "badge--ok"}`}>
                              {u.banned ? "是" : "否"}
                            </span>
                          </td>
                          <td>
                            <ConsoleTableEdit onClick={() => setUserModal({ id: u.user_id })} />
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
            !overview ? (
              <ConsoleBlockSkeleton lines={4} label="存储明细加载中" />
            ) : overview.backend === "mongodb" ? (
              <div className="table-wrap">
                <table className="data console-data-table database-page__storage-table">
                  <thead>
                    <tr>
                      <th>集合</th>
                      <th>文档字段</th>
                      <th>数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mongoCollections.map((c) => (
                      <tr key={c.name}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td className="muted">{c.document}</td>
                        <td
                          style={{ fontVariantNumeric: "tabular-nums" }}
                          title={c.count_estimated ? "Mongo 估算行数（大表）" : undefined}
                        >
                          {c.count_estimated ? "≈" : ""}
                          {nf.format(c.count)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : overview.backend === "postgres" ? (
              <div className="table-wrap">
                <table className="data console-data-table database-page__storage-table">
                  <thead>
                    <tr>
                      <th>表名</th>
                      <th>行数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pgTables.map((t) => (
                      <tr key={t.table}>
                        <td style={{ fontWeight: 600 }}>{t.table}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{nf.format(t.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">当前后端暂无表 / 集合明细。</p>
            )
          ) : null}

          {activeSection === "aggregate" && showAggregate ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                  集合名
                </label>
                {mongoCollections.length ? (
                  <Select
                    value={collection || "__none__"}
                    onValueChange={(v) => setCollection(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="h-9 w-full max-w-[26.25rem]" aria-label="集合名">
                      <SelectValue placeholder="请选择集合" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value="__none__">请选择集合</SelectItem>
                      {mongoCollections.map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.name}（{nf.format(c.count)}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div style={{ maxWidth: 360, width: "100%" }}>
                    <UiInput placeholder="collection" value={collection} onValueChange={setCollection} />
                  </div>
                )}
              </div>
              <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                Pipeline（JSON 数组）
              </label>
              <textarea
                className="inp"
                rows={8}
                value={pipelineText}
                spellCheck={false}
                placeholder='页内或弹窗编辑；须为 JSON 数组，例如 [{"$limit":20}]'
                onChange={(e) => setPipelineText(e.target.value)}
              />
              {aggResult ? (
                <div style={{ marginTop: 16 }}>
                  <div className="muted" style={{ marginBottom: 8 }}>
                    结果
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
      />
      <UserSocialConfigModal
        open={userModal != null}
        userId={userModal?.id ?? null}
        defaultBanned={userModal?.defaultBanned}
        onOpenChange={(o) => {
          if (!o) setUserModal(null);
        }}
        onSaved={() => onSocialConfigSaved("user")}
      />
    </div>
  );
}
