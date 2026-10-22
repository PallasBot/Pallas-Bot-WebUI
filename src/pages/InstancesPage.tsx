import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteBotConfig, fetchInstances, fetchPlugins } from "@/api/fullConsole";
import type { BotConfigPublic, InstancesData, PluginRow } from "@/api/pallasTypes";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { qqAvatarUrl } from "@/utils/botDisplay";
import { formatDisabledPluginIds } from "@/utils/pluginDisplay";
import { slicePage } from "@/utils/paginate";
import BotConfigModal from "@/components/BotConfigModal";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal";
import ConsolePagerBar from "@/components/ConsolePagerBar";
import ChromeStatusFilter, {
  type ChromeStatusFilterOption,
} from "@/components/ChromeStatusFilter";
import ChromeTools, { CHROME_SEARCH_INPUT, CHROME_TOOLS_TRAILING } from "@/components/ChromeTools";
import PageMasthead from "@/components/PageMasthead";
import PanelHdCollapseCaret from "@/components/PanelHdCollapseCaret";
import PendingValue from "@/components/PendingValue";
import RefreshIconButton from "@/components/RefreshIconButton";
import StatusTone from "@/components/StatusTone";
import { Card, Dropdown as HeroDropdown, Input, Separator } from "@heroui/react";
import { Button } from "@/components/ui/button";
import { useBotFavorites } from "@/hooks/useBotFavorites";
import { useConsolePrefs } from "@/hooks/useConsolePrefs";
import { pushConsoleToast } from "@/utils/consoleToast";
import { ChevronDown, Search, Database, Cable, Settings2, RefreshCw } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import { cn } from "@/lib/utils";

type InstStatusFilter = "all" | "connected" | "disconnected";

const INST_STATUS_FILTER_OPTIONS: readonly ChromeStatusFilterOption<InstStatusFilter>[] = [
  { value: "all", label: "全部" },
  { value: "connected", label: "已连接" },
  { value: "disconnected", label: "未连接" },
];

const INST_PANEL = "instances-page__panel flex flex-col overflow-hidden";
const INST_PANEL_HD =
  "panel__hd panel__hd--split inst-db-panel__hd flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const INST_PANEL_HD_SIMPLE =
  "panel__hd panel__hd--split flex-row items-center justify-between space-y-0 border-b px-4 py-3";
const INST_PANEL_BD = "panel__bd px-4 pb-4 pt-3";
const PALLAS_CARD = "pallas-card-frame block static gap-0 p-0";
const PALLAS_CARD_HEADER = "flex flex-col space-y-1.5 p-5 gap-0";
const PALLAS_CARD_CONTENT = "pallas-card-content block gap-0 p-5 pt-0";
const PALLAS_INPUT_BASE = "flex h-9 min-h-[var(--ui-ctrl-height,36px)] w-full";

function parseSelfId(raw: string | undefined | null): number | null {
  const n = parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function boolPillClass(on: boolean): string {
  return on ? "chip chip--sm chip--success chip--soft" : "chip chip--sm chip--default chip--soft";
}

function sortedAdminsList(admins: number[] | undefined | null): number[] {
  if (!admins?.length) return [];
  return [...admins].sort((a, b) => a - b);
}

export default function InstancesPage() {
  const prefs = useConsolePrefs();
  const { favorites, toggleFavorite } = useBotFavorites();
  const queryClient = useQueryClient();
  const forceInstancesFetch = useRef(false);
  const forcePluginsFetch = useRef(false);
  const [reloadBusy, setReloadBusy] = useState(false);
  const [expNonebot, setExpNonebot] = useState(true);
  const [expDbBots, setExpDbBots] = useState(true);
  const [dbBotSearchQ, setDbBotSearchQ] = useState("");
  const [dbBotStatusFilter, setDbBotStatusFilter] = useState<InstStatusFilter>("all");
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
    queryFn: () => fetchInstances({ bypassCache: forceInstancesFetch.current }),
  });
  const pluginsQ = useQuery({
    queryKey: ["plugins"],
    queryFn: () => fetchPlugins({ bypassCache: forcePluginsFetch.current }),
  });

  const data = q.data as InstancesData | undefined;
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
    return sortedDbBotConfigs.filter((c) => {
      if (qStr && !dbBotMatchesSearch(c, qStr)) return false;
      if (dbBotStatusFilter === "connected") return isBotConnected(c.account);
      if (dbBotStatusFilter === "disconnected") return !isBotConnected(c.account);
      return true;
    });
  }, [sortedDbBotConfigs, dbBotSearchQ, dbBotStatusFilter, plugins, data?.nonebot_bots]);

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
    forceInstancesFetch.current = true;
    forcePluginsFetch.current = true;
    try {
      const [instancesResult, pluginsResult] = await Promise.all([q.refetch(), pluginsQ.refetch()]);
      if (instancesResult.isError) throw instancesResult.error;
      if (pluginsResult.isError) throw pluginsResult.error;
      if (pluginsResult.data) {
        queryClient.setQueryData(["plugins-catalog"], pluginsResult.data);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["plugin-row"] }),
        queryClient.invalidateQueries({ queryKey: ["home-overview"] }),
      ]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      forceInstancesFetch.current = false;
      forcePluginsFetch.current = false;
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

  function toggleDbSelected(account: number) {
    setDbSelected(account, !selectedAccounts.has(account));
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
        description="点击卡片选中；点击昵称进入编辑。"
      />

      {q.isLoading && !data ? (
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
                className={cn(PALLAS_INPUT_BASE, CHROME_SEARCH_INPUT)}
                data-heroui-skin="true"
                placeholder="搜索账号…"
                aria-label="搜索账号"
                autoComplete="off"
                disabled
                value=""
              />
            </div>
            <ChromeStatusFilter
              value={dbBotStatusFilter}
              onValueChange={setDbBotStatusFilter}
              options={INST_STATUS_FILTER_OPTIONS}
              disabled
            />
            <div className={CHROME_TOOLS_TRAILING}>
              <RefreshIconButton busy label="刷新" showLabel disabled />
            </div>
          </ChromeTools>
          <Card className={cn(PALLAS_CARD, INST_PANEL, "inst-db-panel")}>
            <Card.Header className={cn(PALLAS_CARD_HEADER, INST_PANEL_HD)}>
              <Card.Title className="flex flex-wrap items-center gap-1.5">
                <PanelTitleIcon icon={Database} />
                数据库中的实例
              </Card.Title>
              <div className="inst-db-panel__hd-side">
                <span className="inst-db-stat muted">
                  当前已连接 <PendingValue pending /> / <PendingValue pending /> 账号
                </span>
              </div>
            </Card.Header>
            <Card.Content className={cn(PALLAS_CARD_CONTENT, INST_PANEL_BD)}>
              <p className="muted" role="status" aria-busy="true">
                实例列表加载中
              </p>
            </Card.Content>
          </Card>
        </>
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
                className={cn(PALLAS_INPUT_BASE, CHROME_SEARCH_INPUT)}
                data-heroui-skin="true"
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
            <ChromeStatusFilter
              value={dbBotStatusFilter}
              onValueChange={(v) => {
                setDbBotStatusFilter(v);
                setInstDbPage(1);
              }}
              options={INST_STATUS_FILTER_OPTIONS}
            />
              <HeroDropdown.Root>
              <HeroDropdown.Trigger render={(triggerProps) => (
                <button
                  {...triggerProps}
                  type="button"
                  className="shrink-0 gap-1 button button--secondary button--sm"
                  disabled={deleteBusy || filteredDbBotConfigs.length === 0}
                  aria-label="选项"
                >
                  {deleteBusy
                    ? "处理中…"
                    : `选项${selectedAccounts.size > 0 ? `（${selectedAccounts.size}）` : ""}`}
                  <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                </button>
              )} />
              <HeroDropdown.Popover
                placement="bottom end"
                offset={4}
                className="ui-surface-popover z-[500] min-w-[8rem] overflow-hidden rounded-[var(--radius-control,8px)] border bg-popover p-1 text-popover-foreground shadow-md data-[entering]:animate-in data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[entering]:fade-in-0 data-[exiting]:zoom-out-95 data-[entering]:zoom-in-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 min-w-0 w-max"
              >
                <HeroDropdown.Menu className="w-full">
                <HeroDropdown.Item
                  id="db-select-page"
                  textValue={dbCardsPageAllSelected ? "取消全选" : "全选本页"}
                  isDisabled={pagedDbAccountIds.length === 0}
                  onAction={() => toggleSelectAllDbOnPage()}
                  className="relative flex cursor-default select-none items-center rounded-pallas-sm px-2 py-1.5 text-sm outline-hidden transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[focus-visible=true]:bg-pallas-accent data-[focus-visible=true]:text-pallas-accent-foreground data-[focused=true]:bg-pallas-accent data-[focused=true]:text-pallas-accent-foreground"
                >
                  {dbCardsPageAllSelected ? "取消全选" : "全选本页"}
                </HeroDropdown.Item>
                <HeroDropdown.Item
                  id="db-clear-selection"
                  textValue="清除选择"
                  isDisabled={selectedAccounts.size === 0}
                  onAction={() => setSelectedAccounts(new Set())}
                  className="relative flex cursor-default select-none items-center rounded-pallas-sm px-2 py-1.5 text-sm outline-hidden transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[focus-visible=true]:bg-pallas-accent data-[focus-visible=true]:text-pallas-accent-foreground data-[focused=true]:bg-pallas-accent data-[focused=true]:text-pallas-accent-foreground"
                >
                  清除选择
                </HeroDropdown.Item>
                <Separator className="-mx-1 my-1 h-px bg-pallas-muted" />
                <HeroDropdown.Item
                  id="db-delete-selected"
                  textValue="删除选中"
                   className="relative flex cursor-default select-none items-center rounded-pallas-sm px-2 py-1.5 text-sm outline-hidden transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[focus-visible=true]:bg-pallas-accent data-[focus-visible=true]:text-pallas-accent-foreground data-[focused=true]:bg-pallas-accent data-[focused=true]:text-pallas-accent-foreground text-destructive focus:text-destructive"
                  isDisabled={selectedAccounts.size === 0 || deleteBusy}
                  onAction={() => openDeleteModal()}
                >
                  删除选中
                </HeroDropdown.Item>
                </HeroDropdown.Menu>
              </HeroDropdown.Popover>
            </HeroDropdown.Root>
            <div className={CHROME_TOOLS_TRAILING}>
              <RefreshIconButton
                busy={reloadBusy}
                label="刷新"
                showLabel
                onClick={() => void reloadFromUser()}
              />
            </div>
          </ChromeTools>

          <Card className={cn(PALLAS_CARD, INST_PANEL, "inst-db-panel")}>
            <Card.Header className={cn(PALLAS_CARD_HEADER, INST_PANEL_HD)}>
              <Card.Title className="flex flex-wrap items-center gap-1.5">
                <PanelTitleIcon icon={Database} />
                数据库中的实例
                <PanelHdCollapseCaret
                  expanded={expDbBots}
                  label="数据库中的实例"
                  onToggle={() => setExpDbBots((v) => !v)}
                />
              </Card.Title>
              <div className="inst-db-panel__hd-side">
                <span className="inst-db-stat muted">
                  当前已连接 <strong className="inst-db-stat__num">{dbBotsConnectedCount}</strong> /{" "}
                  {dbBotsTotalCount} 账号
                </span>
              </div>
            </Card.Header>
            {expDbBots ? (
              <Card.Content className={cn(PALLAS_CARD_CONTENT, INST_PANEL_BD)}>
                {pluginLoadErr ? (
                  <p className="muted" style={{ margin: "0 0 10px" }}>
                    插件列表加载失败，禁用插件勾选不可用：{pluginLoadErr}
                  </p>
                ) : null}
                {!filteredDbBotConfigs.length && sortedDbBotConfigs.length ? (
                  <p className="muted" style={{ margin: "0 0 10px" }}>
                    没有匹配的账号，试试调整搜索或筛选。
                  </p>
                ) : !filteredDbBotConfigs.length && nonebotBotsNeedingInit.length ? (
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
                        className={cn(
                          "data-summary-card data-summary-card--kv data-summary-card--bot data-summary-card--selectable",
                          selectedAccounts.has(c.account) && "data-summary-card--selected",
                        )}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selectedAccounts.has(c.account)}
                        aria-label={`${selectedAccounts.has(c.account) ? "取消选择" : "选择"}账号 ${c.account}`}
                        onClick={() => toggleDbSelected(c.account)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleDbSelected(c.account);
                          }
                        }}
                      >
                        <div className="data-summary-card__head data-summary-card__head--bot">
                          <div className="data-summary-card__avatar">
                            <img
                              src={qqAvatarUrl(c.account)}
                              alt=""
                              width={40}
                              height={40}
                              decoding="async"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.visibility = "hidden";
                              }}
                            />
                          </div>
                          <div className="data-summary-card__head-main">
                            <div className="data-summary-card__title-line">
                              <div className="data-summary-card__primary">
                                <button
                                  type="button"
                                  className="data-summary-card__title-link"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(c);
                                  }}
                                >
                                  {botNickname(c.account) || "BOT"}
                                </button>
                              </div>
                              <button
                                type="button"
                                className="data-card-fav-star"
                                aria-pressed={favorites.has(c.account)}
                                title={favorites.has(c.account) ? "取消收藏" : "收藏"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(c.account);
                                }}
                              >
                                ★
                              </button>
                              <StatusTone
                                size="compact"
                                className="data-summary-card__title-status"
                                ok={isBotConnected(c.account)}
                                pendingLabel="探测中"
                                okLabel="已连接"
                                offLabel="未连接"
                              />
                            </div>
                            <div className="data-summary-card__secondary muted">{c.account}</div>
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
              </Card.Content>
            ) : null}
          </Card>

          <Card className={cn(PALLAS_CARD, INST_PANEL)}>
            <Card.Header className={cn(PALLAS_CARD_HEADER, INST_PANEL_HD_SIMPLE)}>
              <Card.Title className="flex flex-wrap items-center gap-1.5">
                <PanelTitleIcon icon={Cable} />
                消息框架
                <PanelHdCollapseCaret
                  expanded={expNonebot}
                  label="消息框架"
                  onToggle={() => setExpNonebot((v) => !v)}
                />
              </Card.Title>
            </Card.Header>
            {expNonebot ? (
              <Card.Content className={cn(PALLAS_CARD_CONTENT, INST_PANEL_BD)}>
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
                                <span className="badge badge--compact badge--success">已入库</span>
                              ) : acc != null ? (
                                <span className="badge badge--compact badge--neutral">未入库</span>
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
                                  icon={Settings2}
                                  iconMotion="settings"
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
              </Card.Content>
            ) : null}
          </Card>
        </>
      ) : (
        <Card className={cn(PALLAS_CARD, INST_PANEL)}>
          <Card.Content className={cn(PALLAS_CARD_CONTENT, INST_PANEL_BD)}>
            <p className="muted mb-3">实例数据未加载，可尝试重新拉取。</p>
            <Button type="button" icon={RefreshCw} iconMotion="spin" iconBusy={reloadBusy} disabled={reloadBusy} onClick={() => void reloadFromUser()}>
              重新加载
            </Button>
          </Card.Content>
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
