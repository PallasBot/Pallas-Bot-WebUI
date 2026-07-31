import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { deleteBotConfig, fetchInstances, fetchPlugins } from "@/api/fullConsole";
import type { BotConfigPublic, InstancesData, PluginRow } from "@/api/pallasTypes";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { formatDisabledPluginIds } from "@/utils/pluginDisplay";
import { slicePage } from "@/utils/paginate";
import BotConfigModal from "@/components/BotConfigModal";
import ConsoleCardBulkBar from "@/components/ConsoleCardBulkBar";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal";
import ConsolePagerBar from "@/components/ConsolePagerBar";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton";
import ChromeTools, { CHROME_SEARCH_INPUT } from "@/components/ChromeTools";
import PageMasthead from "@/components/PageMasthead";
import PanelHdCollapseCaret from "@/components/PanelHdCollapseCaret";
import RefreshIconButton from "@/components/RefreshIconButton";
import StatusTone from "@/components/StatusTone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBotFavorites } from "@/hooks/useBotFavorites";
import { useConsolePrefs } from "@/hooks/useConsolePrefs";
import { pushConsoleToast } from "@/utils/consoleToast";
import { querySettled } from "@/utils/querySettled";
import { Search, Database, Cable } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import { cn } from "@/lib/utils";

const INST_PANEL = "instances-page__panel flex flex-col overflow-hidden shadow-none";
const INST_PANEL_HD =
  "panel__hd panel__hd--split inst-db-panel__hd flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const INST_PANEL_HD_SIMPLE =
  "panel__hd panel__hd--split flex-row items-center justify-between space-y-0 border-b px-4 py-3";
const INST_PANEL_BD = "panel__bd px-4 pb-4 pt-3";

function parseSelfId(raw: string | undefined | null): number | null {
  const n = parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function boolPillClass(on: boolean): string {
  return on ? "data-pill data-pill--on" : "data-pill data-pill--off";
}

function sortedAdminsList(admins: number[] | undefined | null): number[] {
  if (!admins?.length) return [];
  return [...admins].sort((a, b) => a - b);
}

export default function InstancesPage() {
  const prefs = useConsolePrefs();
  const { favorites, toggleFavorite } = useBotFavorites();
  const [reloadBusy, setReloadBusy] = useState(false);
  const [expNonebot, setExpNonebot] = useState(true);
  const [expDbBots, setExpDbBots] = useState(true);
  const [dbBotSearchQ, setDbBotSearchQ] = useState("");
  const [instNbPage, setInstNbPage] = useState(1);
  const [instDbPage, setInstDbPage] = useState(1);
  const [err, setErr] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");
  const [editModalAccount, setEditModalAccount] = useState<number | null>(null);
  const [editModalIsInit, setEditModalIsInit] = useState(false);
  const [editModalConfig, setEditModalConfig] = useState<BotConfigPublic | null>(null);

  const q = useQuery({
    queryKey: ["instances"],
    queryFn: () => fetchInstances(),
  });
  const pluginsQ = useQuery({
    queryKey: ["plugins"],
    queryFn: () => fetchPlugins(),
  });

  const data = q.data as InstancesData | undefined;
  const instancesSettled = querySettled(q);
  const plugins = (pluginsQ.data ?? []) as PluginRow[];
  const pluginLoadErr = pluginsQ.error ? String(pluginsQ.error) : "";

  const botNickname = (account: number) =>
    data?.bot_profiles?.[String(account)]?.nickname?.trim() || undefined;

  const dbAccountIds = useMemo(
    () => new Set((data?.db_bot_configs ?? []).map((c) => c.account)),
    [data],
  );

  function accountInDb(account: number): boolean {
    return dbAccountIds.has(account);
  }

  function isBotConnected(account: number): boolean {
    return accountHasNonebotBot(data?.nonebot_bots, account);
  }

  const sortedNonebotBots = useMemo(() => {
    const rows = [...(data?.nonebot_bots ?? [])];
    rows.sort((a, b) => {
      const ia = parseSelfId(a.self_id);
      const ib = parseSelfId(b.self_id);
      const favA = ia != null && favorites.has(ia) ? 1 : 0;
      const favB = ib != null && favorites.has(ib) ? 1 : 0;
      if (favA !== favB) return favB - favA;
      // 消息框架列表本身均为已连接；无独立「进程运行」字段，按昵称/账号收尾
      const na = (ia != null ? botNickname(ia) ?? "" : "").toLowerCase();
      const nb = (ib != null ? botNickname(ib) ?? "" : "").toLowerCase();
      const cmp = na.localeCompare(nb, "zh-CN");
      if (cmp !== 0) return cmp;
      return String(a.self_id).localeCompare(String(b.self_id), "zh-CN", { numeric: true });
    });
    return rows;
  }, [data, favorites]);

  const sortedDbBotConfigs = useMemo(() => {
    const rows = [...(data?.db_bot_configs ?? [])] as BotConfigPublic[];
    rows.sort((a, b) => {
      const fa = favorites.has(a.account) ? 1 : 0;
      const fb = favorites.has(b.account) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      const ca = isBotConnected(a.account) ? 1 : 0;
      const cb = isBotConnected(b.account) ? 1 : 0;
      if (ca !== cb) return cb - ca;
      const na = (botNickname(a.account) || "").toLowerCase();
      const nb = (botNickname(b.account) || "").toLowerCase();
      const cmp = na.localeCompare(nb, "zh-CN");
      if (cmp !== 0) return cmp;
      return a.account - b.account;
    });
    return rows;
  }, [data, favorites]);

  const nonebotBotsNeedingInit = useMemo(
    () =>
      sortedNonebotBots.filter((b) => {
        const acc = parseSelfId(b.self_id);
        return acc != null && !accountInDb(acc);
      }),
    [sortedNonebotBots, dbAccountIds],
  );

  function dbBotMatchesSearch(c: BotConfigPublic, qStr: string): boolean {
    const hay = [
      String(c.account),
      botNickname(c.account) ?? "",
      ...sortedAdminsList(c.admins).map(String),
      formatDisabledPluginIds(c.disabled_plugins, plugins),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(qStr);
  }

  const filteredDbBotConfigs = useMemo(() => {
    const qStr = dbBotSearchQ.trim().toLowerCase();
    if (!qStr) return sortedDbBotConfigs;
    return sortedDbBotConfigs.filter((c) => dbBotMatchesSearch(c, qStr));
  }, [sortedDbBotConfigs, dbBotSearchQ, plugins]);

  const dbBotsConnectedCount = sortedDbBotConfigs.filter((c) => isBotConnected(c.account)).length;
  const dbBotsTotalCount = sortedDbBotConfigs.length;

  const pagedNonebotBots = useMemo(
    () => slicePage(sortedNonebotBots, instNbPage, prefs.tablePageSize),
    [sortedNonebotBots, instNbPage, prefs.tablePageSize],
  );
  const pagedDbBotConfigs = useMemo(
    () => slicePage(filteredDbBotConfigs, instDbPage, prefs.tablePageSize),
    [filteredDbBotConfigs, instDbPage, prefs.tablePageSize],
  );

  const pagedDbAccountIds = useMemo(() => pagedDbBotConfigs.map((c) => c.account), [pagedDbBotConfigs]);

  const dbCardsPageAllSelected = useMemo(
    () => pagedDbAccountIds.length > 0 && pagedDbAccountIds.every((id) => selectedAccounts.has(id)),
    [pagedDbAccountIds, selectedAccounts],
  );

  const deleteModalItems = useMemo(
    () =>
      [...selectedAccounts]
        .sort((a, b) => a - b)
        .map((acc) => ({
          key: String(acc),
          label: `${botNickname(acc) || "BOT"} · ${acc}`,
        })),
    [selectedAccounts, data],
  );

  const deleteModalWarnings = useMemo(() => {
    const connected = [...selectedAccounts]
      .sort((a, b) => a - b)
      .filter((acc) => isBotConnected(acc));
    if (!connected.length) return [];
    return [
      `其中以下账号当前仍与消息框架连接：${connected.join("、")}。删除后可能导致运行期行为异常，请确认。`,
    ];
  }, [selectedAccounts, data]);

  function nonebotRowNick(selfId: string | undefined): string {
    const acc = parseSelfId(selfId);
    if (acc == null) return "";
    return botNickname(acc) ?? "";
  }

  async function reloadFromUser() {
    setReloadBusy(true);
    setErr("");
    try {
      await Promise.all([q.refetch(), pluginsQ.refetch()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setReloadBusy(false);
    }
  }

  function startEdit(c: BotConfigPublic) {
    setEditModalAccount(c.account);
    setEditModalIsInit(false);
    setEditModalConfig(c);
  }

  function startInit(account: number) {
    setEditModalAccount(account);
    setEditModalIsInit(true);
    setEditModalConfig(null);
  }

  function closeEditModal() {
    setEditModalAccount(null);
    setEditModalIsInit(false);
    setEditModalConfig(null);
  }

  function setDbSelected(account: number, on: boolean) {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (on) next.add(account);
      else next.delete(account);
      return next;
    });
  }

  function toggleSelectAllDbOnPage() {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (dbCardsPageAllSelected) {
        for (const id of pagedDbAccountIds) next.delete(id);
      } else {
        for (const id of pagedDbAccountIds) next.add(id);
      }
      return next;
    });
  }

  function openDeleteModal() {
    if (selectedAccounts.size === 0) return;
    setDeleteErr("");
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (deleteBusy) return;
    setDeleteModalOpen(false);
    setDeleteErr("");
  }

  async function confirmDeleteSelectedDb() {
    const accounts = [...selectedAccounts].sort((a, b) => a - b);
    if (!accounts.length) return;
    setDeleteBusy(true);
    setDeleteErr("");
    try {
      for (const account of accounts) {
        await deleteBotConfig(account);
      }
      await reloadFromUser();
      setSelectedAccounts(new Set());
      setDeleteModalOpen(false);
      if (editModalAccount != null && accounts.includes(editModalAccount)) {
        closeEditModal();
      }
      pushConsoleToast(`已删除 ${accounts.length} 个账号配置`, "warn");
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="instances-page console-hub-page">
      {err ? <div className="alert alert--err">{err}</div> : null}

      <PageMasthead
        title="数据库实例"
        description="Bot 账号配置与连接状态。"
      />

      {q.isLoading && !data ? (
        <ConsolePageSkeleton panels={4} />
      ) : data ? (
        <>
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
                placeholder="搜索账号…"
                aria-label="搜索账号"
                autoComplete="off"
                value={dbBotSearchQ}
                onChange={(e) => {
                  setDbBotSearchQ(e.target.value);
                  setInstDbPage(1);
                }}
              />
            </div>
          </ChromeTools>

          <Card className={cn(INST_PANEL, "inst-db-panel")}>
            <CardHeader className={INST_PANEL_HD}>
              <CardTitle className="panel__title flex flex-wrap items-center gap-1.5">
                <PanelTitleIcon icon={Database} />
                数据库中的实例
                <PanelHdCollapseCaret
                  expanded={expDbBots}
                  label="数据库中的实例"
                  onToggle={() => setExpDbBots((v) => !v)}
                />
                <RefreshIconButton
                  embedded
                  showLabel={false}
                  busy={reloadBusy}
                  label="刷新实例数据"
                  onClick={() => void reloadFromUser()}
                />
              </CardTitle>
              <div className="inst-db-panel__hd-side">
                <span className="inst-db-stat muted">
                  当前已连接 <strong className="inst-db-stat__num">{dbBotsConnectedCount}</strong> /{" "}
                  {dbBotsTotalCount} 账号
                </span>
              </div>
            </CardHeader>
            {expDbBots ? (
              <CardContent className={INST_PANEL_BD}>
                {pluginLoadErr ? (
                  <p className="muted" style={{ margin: "0 0 10px" }}>
                    插件列表加载失败，禁用插件勾选不可用：{pluginLoadErr}
                  </p>
                ) : null}
                {!filteredDbBotConfigs.length && nonebotBotsNeedingInit.length ? (
                  <p className="muted" style={{ margin: "0 0 10px" }}>
                    数据库中尚无 Bot 配置。下方「消息框架」中已连接但未入库的牛牛可点{" "}
                    <strong>初始化配置</strong> 写入号主与其它选项（不依赖协议端「创建牛牛」流程）。
                  </p>
                ) : !filteredDbBotConfigs.length ? (
                  <p className="muted" style={{ margin: "0 0 10px" }}>
                    数据库中暂无 Bot 配置记录。
                  </p>
                ) : null}

                <div className="data-card-grid data-card-grid--bots">
                    {pagedDbBotConfigs.map((c) => (
                      <div
                        key={`card-${c.account}`}
                        className="data-summary-card data-summary-card--kv data-summary-card--bot"
                      >
                        <div className="data-summary-card__head data-summary-card__head--bot">
                          <label className="inst-db-card-select" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedAccounts.has(c.account)}
                              aria-label={`选择账号 ${c.account}`}
                              onChange={(e) => setDbSelected(c.account, e.target.checked)}
                            />
                          </label>
                          <div className="data-summary-card__head-main">
                            <div className="data-summary-card__title-line">
                              <div className="data-summary-card__primary">
                                <button
                                  type="button"
                                  className="data-summary-card__title-link"
                                  onClick={() => startEdit(c)}
                                >
                                  {botNickname(c.account) || "BOT"}
                                </button>
                              </div>
                              <button
                                type="button"
                                className="data-card-fav-star"
                                aria-pressed={favorites.has(c.account)}
                                title={favorites.has(c.account) ? "取消收藏" : "收藏"}
                                onClick={() => toggleFavorite(c.account)}
                              >
                                ★
                              </button>
                            </div>
                            <div className="data-summary-card__secondary muted">{c.account}</div>
                          </div>
                          <div className="data-summary-card__head-badges">
                            <StatusTone
                              className={
                                instancesSettled && isBotConnected(c.account)
                                  ? "data-conn-capsule data-conn-capsule--on"
                                  : instancesSettled
                                    ? "data-conn-capsule data-conn-capsule--off"
                                    : "data-conn-capsule"
                              }
                              pending={!instancesSettled}
                              ok={isBotConnected(c.account)}
                              pendingLabel="探测中"
                              okLabel="已连接"
                              offLabel="未连接"
                            />
                          </div>
                        </div>
                        <div className="data-summary-card__body">
                          <div className="data-summary-card__row">
                            <span className="data-summary-card__label">安全模式</span>
                            <span className={boolPillClass(c.security)}>
                              {c.security ? "开启" : "关闭"}
                            </span>
                          </div>
                          <div className="data-summary-card__row">
                            <span className="data-summary-card__label">自动同意好友</span>
                            <span className={boolPillClass(c.auto_accept_friend)}>
                              {c.auto_accept_friend ? "开启" : "关闭"}
                            </span>
                          </div>
                          <div className="data-summary-card__row">
                            <span className="data-summary-card__label">自动同意入群</span>
                            <span className={boolPillClass(c.auto_accept_group)}>
                              {c.auto_accept_group ? "开启" : "关闭"}
                            </span>
                          </div>
                          <div className="data-summary-card__row data-summary-card__row--admins">
                            <span className="data-summary-card__label">管理员</span>
                            <span className="muted data-summary-card__admins-text">
                              {!sortedAdminsList(c.admins).length ? (
                                "—"
                              ) : (
                                <span className="inst-db-admins-wrap inst-db-admins-wrap--card">
                                  {sortedAdminsList(c.admins).map((id) => (
                                    <span key={`card-${c.account}-adm-${id}`} className="inst-db-admin-item">
                                      {id}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="data-summary-card__plugins">
                            <span className="data-summary-card__plugins-label">禁用插件</span>
                            {c.disabled_plugins?.length
                              ? formatDisabledPluginIds(c.disabled_plugins, plugins)
                              : "无"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                {filteredDbBotConfigs.length > 0 ? (
                  <ConsolePagerBar
                    page={instDbPage}
                    pageSize={prefs.tablePageSize}
                    total={filteredDbBotConfigs.length}
                    onPageChange={setInstDbPage}
                    onPageSizeChange={prefs.setTablePageSize}
                  />
                ) : null}

                {filteredDbBotConfigs.length > 0 ? (
                  <ConsoleCardBulkBar
                    pageAllSelected={dbCardsPageAllSelected}
                    selectedCount={selectedAccounts.size}
                    deleteBusy={deleteBusy}
                    onToggleSelectAll={toggleSelectAllDbOnPage}
                    onClearSelection={() => setSelectedAccounts(new Set())}
                    onDelete={openDeleteModal}
                  />
                ) : null}
              </CardContent>
            ) : null}
          </Card>

          <Card className={INST_PANEL}>
            <CardHeader className={INST_PANEL_HD_SIMPLE}>
              <CardTitle className="panel__title flex flex-wrap items-center gap-1.5">
                <PanelTitleIcon icon={Cable} />
                消息框架
                <PanelHdCollapseCaret
                  expanded={expNonebot}
                  label="消息框架"
                  onToggle={() => setExpNonebot((v) => !v)}
                />
              </CardTitle>
            </CardHeader>
            {expNonebot ? (
              <CardContent className={INST_PANEL_BD}>
                {nonebotBotsNeedingInit.length ? (
                  <p className="muted" style={{ margin: "0 0 10px" }}>
                    {nonebotBotsNeedingInit.length} 个已连接牛牛尚未写入数据库配置，可在下表点{" "}
                    <strong>初始化配置</strong> 添加号主。
                  </p>
                ) : null}
                <div className="table-wrap">
                  <table className="data console-data-table">
                    <thead>
                      <tr>
                        <th>昵称</th>
                        <th>self_id</th>
                        <th>适配器</th>
                        <th>连接键</th>
                        <th>库配置</th>
                        <th style={{ minWidth: 96, width: "1%" }}>
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedNonebotBots.map((b, i) => {
                        const acc = parseSelfId(b.self_id);
                        return (
                          <tr key={b.connection_key || `${b.self_id}-${i}`}>
                            <td className="inst-account-nick">{nonebotRowNick(b.self_id) || "—"}</td>
                            <td>{b.self_id}</td>
                            <td className="muted">{b.adapter}</td>
                            <td className="muted">{b.connection_key}</td>
                            <td>
                              {acc != null && accountInDb(acc) ? (
                                <span className="data-pill data-pill--on">已入库</span>
                              ) : acc != null ? (
                                <span className="data-pill data-pill--off">未入库</span>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                            <td>
                              {acc != null && !accountInDb(acc) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="inst-nonebot-init-btn"
                                  onClick={() => startInit(acc)}
                                >
                                  初始化配置
                                </Button>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {sortedNonebotBots.length > 0 ? (
                  <ConsolePagerBar
                    page={instNbPage}
                    pageSize={prefs.tablePageSize}
                    total={sortedNonebotBots.length}
                    onPageChange={setInstNbPage}
                    onPageSizeChange={prefs.setTablePageSize}
                  />
                ) : null}
              </CardContent>
            ) : null}
          </Card>
        </>
      ) : (
        <Card className={INST_PANEL}>
          <CardContent className={INST_PANEL_BD}>
            <p className="muted mb-3">实例数据未加载，可尝试重新拉取。</p>
            <Button type="button" disabled={reloadBusy} onClick={() => void reloadFromUser()}>
              重新加载
            </Button>
          </CardContent>
        </Card>
      )}

      <BotConfigModal
        account={editModalAccount}
        isInit={editModalIsInit}
        botNickname={editModalAccount != null ? botNickname(editModalAccount) : undefined}
        initialConfig={editModalConfig}
        plugins={plugins}
        onClose={closeEditModal}
        onSaved={() => void reloadFromUser()}
      />

      <ConsoleDeleteConfirmModal
        open={deleteModalOpen}
        title="删除账号"
        subtitle={`将删除以下账号（共 ${selectedAccounts.size} 个），数据库 bot_config 行将被移除，操作不可撤销。`}
        items={deleteModalItems}
        warnings={deleteModalWarnings}
        busy={deleteBusy}
        error={deleteErr}
        titleId="inst-delete-modal-title"
        onClose={closeDeleteModal}
        onConfirm={() => void confirmDeleteSelectedDb()}
      />
    </div>
  );
}
