import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import ConsolePagerBar from "@/components/ConsolePagerBar";
import { ConsoleBlockSkeleton } from "@/components/ConsolePageSkeleton";
import ConsoleTableEdit from "@/components/ConsoleTableEdit";
import PageMasthead from "@/components/PageMasthead";
import PanelHdCollapseCaret from "@/components/PanelHdCollapseCaret";
import RefreshIconButton from "@/components/RefreshIconButton";
import GroupSocialConfigModal from "@/components/social/GroupSocialConfigModal";
import UserSocialConfigModal from "@/components/social/UserSocialConfigModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UiInput from "@/components/ui/UiInput";
import UiSelect from "@/components/ui/UiSelect";
import { useConsolePrefs } from "@/hooks/useConsolePrefs";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const CONFIG_LIST_LIMIT = 10_000;
const nf = new Intl.NumberFormat("zh-CN");

const DB_PANEL = "database-page__panel flex flex-col overflow-hidden shadow-none";
const DB_PANEL_HD =
  "panel__hd panel__hd--split flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const DB_PANEL_BD = "panel__bd px-4 pb-4 pt-3";

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

export default function DatabasePage() {
  const prefs = useConsolePrefs();
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [dbRefreshBusy, setDbRefreshBusy] = useState(false);
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

  const showBody = overview && !dbRefreshBusy;

  return (
    <div className="database-page console-hub-page">
      {err ? <div className="alert alert--err">{err}</div> : null}
      {ok ? <div className="alert alert--ok">{ok}</div> : null}

      <PageMasthead
        title="数据库总览"
        description="后端概览与群 / 好友配置。"
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button asChild variant="secondary" size="sm">
              <Link to="/database/backups">备份管理</Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={dbRefreshBusy}
              onClick={() => void loadAll()}
            >
              <RefreshCw className={cn("size-3.5", dbRefreshBusy && "animate-spin")} />
              {dbRefreshBusy ? "刷新中…" : "刷新"}
            </Button>
          </div>
        }
      />

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

      <Card id="db-group-configs" className={DB_PANEL}>
        <CardHeader className={DB_PANEL_HD}>
          <CardTitle className="panel__title flex flex-wrap items-center gap-1.5">
            群配置
            <PanelHdCollapseCaret
              expanded={prefs.databasePageGroupConfigsOpen}
              label="群配置"
              onToggle={() => prefs.setDatabasePageGroupConfigsOpen(!prefs.databasePageGroupConfigsOpen)}
            />
            <RefreshIconButton embedded showLabel={false} busy={socialConfigsBusy} label="刷新群配置列表" onClick={() => void loadSocialConfigs()} />
          </CardTitle>
          <div className="row-actions friends-groups-list-hd-actions">
            <span className="friends-groups-hd-pin-wrap" />
            <UiInput
              className="friends-groups-list-search"
              type="search"
              placeholder="搜索群号 / 轮盘 / 封禁 / 插件 / 拉黑"
              title="按群号、轮盘模式、封禁状态、禁用插件、拉黑 QQ 筛选"
              value={groupListQ}
              disabled={socialConfigsBusy}
              onValueChange={(v) => {
                setGroupListQ(v);
                setPageGroups(1);
              }}
            />
            <div className="friends-groups-list-hd-actions__tail">
              {socialConfigsBusy ? (
                <span className="visually-hidden" role="status" aria-live="polite">
                  加载中…
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        {prefs.databasePageGroupConfigsOpen ? (
          <CardContent className={DB_PANEL_BD}>
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
                      <th style={{ minWidth: 88, width: "1%" }}>
                        操作
                      </th>
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
          </CardContent>
        ) : null}
      </Card>

      <Card id="db-user-configs" className={DB_PANEL}>
        <CardHeader className={DB_PANEL_HD}>
          <CardTitle className="panel__title flex flex-wrap items-center gap-1.5">
            好友配置
            <PanelHdCollapseCaret
              expanded={prefs.databasePageUserConfigsOpen}
              label="好友配置"
              onToggle={() => prefs.setDatabasePageUserConfigsOpen(!prefs.databasePageUserConfigsOpen)}
            />
            <RefreshIconButton embedded showLabel={false} busy={socialConfigsBusy} label="刷新好友配置列表" onClick={() => void loadSocialConfigs()} />
          </CardTitle>
          <div className="row-actions friends-groups-list-hd-actions">
            <span className="friends-groups-hd-pin-wrap" />
            <UiInput
              className="friends-groups-list-search"
              type="search"
              placeholder="搜索 QQ / 封禁状态"
              title="按 QQ、封禁状态筛选"
              value={userListQ}
              disabled={socialConfigsBusy}
              onValueChange={(v) => {
                setUserListQ(v);
                setPageUsers(1);
              }}
            />
            <div className="friends-groups-list-hd-actions__tail">
              {socialConfigsBusy ? (
                <span className="visually-hidden" role="status" aria-live="polite">
                  加载中…
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        {prefs.databasePageUserConfigsOpen ? (
          <CardContent className={DB_PANEL_BD}>
            <div className="database-user-config-add" style={{ marginBottom: 12 }}>
              <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
                输入 QQ 号后点击添加并设置封禁。此为全局拉黑，与私聊「牛牛拉黑」写入同一字段；本群维度拉黑请在上方群配置中维护。
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
                      <th style={{ minWidth: 88, width: "1%" }}>
                        操作
                      </th>
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
          </CardContent>
        ) : null}
      </Card>

      {overview?.backend === "mongodb" ? (
        <Card className={DB_PANEL}>
          <CardHeader className={DB_PANEL_HD}>
            <CardTitle className="panel__title">集合与文档数</CardTitle>
          </CardHeader>
          <CardContent className={DB_PANEL_BD}>
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
                      <td style={{ fontVariantNumeric: "tabular-nums" }} title={c.count_estimated ? "Mongo 估算行数（大表）" : undefined}>
                        {c.count_estimated ? "≈" : ""}
                        {nf.format(c.count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {overview?.backend === "postgres" ? (
        <Card className={DB_PANEL}>
          <CardHeader className={DB_PANEL_HD}>
            <CardTitle className="panel__title">表与行数</CardTitle>
          </CardHeader>
          <CardContent className={DB_PANEL_BD}>
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
          </CardContent>
        </Card>
      ) : null}

      {overview && overview.backend === "mongodb" ? (
        <Card className={DB_PANEL}>
          <CardHeader className={DB_PANEL_HD}>
            <CardTitle className="panel__title">MongoDB 聚合</CardTitle>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button type="button" size="sm" disabled={aggLoading || !collection.trim()} onClick={() => void runAggregate()}>
                {aggLoading ? "执行中…" : "执行"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className={DB_PANEL_BD}>
            <div style={{ marginBottom: 12 }}>
              <label className="muted" style={{ display: "block", marginBottom: 6 }}>
                集合名
              </label>
              {mongoCollections.length ? (
                <UiSelect style={{ maxWidth: 420, width: "100%" }} value={collection} onValueChange={setCollection}>
                  <option value="">请选择集合</option>
                  {mongoCollections.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}（{nf.format(c.count)}）
                    </option>
                  ))}
                </UiSelect>
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
          </CardContent>
        </Card>
      ) : null}

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
