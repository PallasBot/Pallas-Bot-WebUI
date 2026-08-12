import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  protocolApiErrorMessage,
  protocolDeleteSnowlumaRuntime,
  protocolListAccounts,
  protocolListSnowlumaRuntimes,
  protocolStartSnowlumaRuntime,
  protocolStopSnowlumaRuntime,
  type NapcatAccountRow,
  type SnowlumaRuntimeRow,
} from "@/api/protocol";
import ConsolePagerBar from "@/components/ConsolePagerBar";
import { ConsoleBlockSkeleton } from "@/components/ConsolePageSkeleton";
import ProtocolRuntimeConfigDialog from "@/components/ProtocolRuntimeConfigDialog";
import ProtocolRuntimeImageSwitchDialog from "@/components/ProtocolRuntimeImageSwitchDialog";
import StatusTone from "@/components/StatusTone";
import { Badge } from "@/components/ui/badge";
import { useRegisterProtocolChrome } from "@/components/protocol/ProtocolChromeContext";
import { CHROME_SEARCH_INPUT } from "@/components/ChromeTools";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ChevronDown, Cpu, Play, Search, Settings2, Square, Trash2 } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import type { ProtocolOutletContext } from "@/pages/ProtocolPage";
import { useBotFavorites } from "@/hooks/useBotFavorites";
import { useConsolePrefs } from "@/hooks/useConsolePrefs";
import { pushConsoleToast } from "@/utils/consoleToast";
import { botAccountFavoriteRank } from "@/utils/botDisplay";
import { slicePage } from "@/utils/paginate";
import { snowlumaRuntimeWebUiHref } from "@/utils/protocolLinks";
import { querySettled } from "@/utils/querySettled";
import { cn } from "@/lib/utils";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";
import { useConfirmAgain } from "@/hooks/useConfirmAgain";

const PROTO_PANEL = "protocol-page__panel flex flex-col overflow-hidden shadow-none";
const PROTO_PANEL_HD =
  "panel__hd panel__hd--split inst-db-panel__hd flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const PROTO_PANEL_BD = "panel__bd px-4 pb-4 pt-3";
const CHIP_PREVIEW_LIMIT = 4;

function accountLabel(account: NapcatAccountRow): string {
  const name = String(account.display_name ?? "").trim();
  const qq = String(account.qq ?? account.id ?? "").trim();
  if (name && qq && name !== qq) return `${name}（${qq}）`;
  return name || qq || "未知账号";
}

function runtimeMatchesQuery(rt: SnowlumaRuntimeRow, q: string): boolean {
  if (!q) return true;
  const hay = [
    rt.display_name,
    rt.id,
    ...(rt.member_account_ids ?? []),
    rt.webui_port != null ? String(rt.webui_port) : "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function runtimeMemberCount(rt: SnowlumaRuntimeRow): number {
  return (rt.member_account_ids ?? []).filter((id) => String(id || "").trim()).length;
}

function runtimeTitle(rt: SnowlumaRuntimeRow): string {
  return String(rt.display_name || rt.id || "Runtime").trim() || "Runtime";
}

function memberAccountNumber(account: NapcatAccountRow | undefined, memberId: string): number | null {
  const raw = String(account?.qq ?? account?.id ?? memberId ?? "").trim();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function runtimeFavoriteRank(
  rt: SnowlumaRuntimeRow,
  accountById: Map<string, NapcatAccountRow>,
  favorites: ReadonlySet<number>,
): number {
  for (const memberId of rt.member_account_ids ?? []) {
    const id = String(memberId || "").trim();
    if (!id) continue;
    const n = memberAccountNumber(accountById.get(id), id);
    if (n != null && botAccountFavoriteRank(favorites, n)) return 1;
  }
  return 0;
}

function runtimeConnectedRank(
  rt: SnowlumaRuntimeRow,
  accountById: Map<string, NapcatAccountRow>,
): number {
  for (const memberId of rt.member_account_ids ?? []) {
    const id = String(memberId || "").trim();
    if (!id) continue;
    if (accountById.get(id)?.connected === true) return 1;
  }
  return 0;
}

export default function ProtocolRuntimeTab() {
  const { mountUrl, system } = useOutletContext<ProtocolOutletContext>();
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConsoleConfirm();
  const again = useConfirmAgain();
  const prefs = useConsolePrefs();
  const { favorites } = useBotFavorites();
  const [searchQ, setSearchQ] = useState("");
  const [runtimePage, setRuntimePage] = useState(1);
  const [snowlumaRuntimeBusyId, setSnowlumaRuntimeBusyId] = useState<string | null>(null);
  const [configRuntimeId, setConfigRuntimeId] = useState<string | null>(null);
  const [imageSwitchOpen, setImageSwitchOpen] = useState(false);
  const [imageSwitchBusy, setImageSwitchBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  const runtimesQ = useQuery({
    queryKey: ["protocol-snowluma-runtimes", mountUrl, "full"],
    queryFn: () => protocolListSnowlumaRuntimes(mountUrl!),
    enabled: Boolean(mountUrl),
  });
  const accountsQ = useQuery({
    queryKey: ["protocol-accounts", mountUrl],
    queryFn: () => protocolListAccounts(mountUrl!),
    enabled: Boolean(mountUrl),
  });

  const snowlumaRuntimes = runtimesQ.data ?? [];
  const runtimesPending = Boolean(mountUrl) && !querySettled(runtimesQ);
  const accounts = accountsQ.data ?? [];

  const accountById = useMemo(() => {
    const map = new Map<string, NapcatAccountRow>();
    for (const row of accounts) {
      const id = String(row.id ?? "").trim();
      if (id) map.set(id, row);
    }
    return map;
  }, [accounts]);

  const filteredRuntimes = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    const list = snowlumaRuntimes.filter((rt) => runtimeMatchesQuery(rt, q));
    list.sort((a, b) => {
      const favA = runtimeFavoriteRank(a, accountById, favorites);
      const favB = runtimeFavoriteRank(b, accountById, favorites);
      if (favA !== favB) return favB - favA;
      const ca = runtimeConnectedRank(a, accountById);
      const cb = runtimeConnectedRank(b, accountById);
      if (ca !== cb) return cb - ca;
      const ra = a.process_running ? 1 : 0;
      const rb = b.process_running ? 1 : 0;
      if (ra !== rb) return rb - ra;
      const titleCmp = runtimeTitle(a).localeCompare(runtimeTitle(b), "zh-CN");
      if (titleCmp !== 0) return titleCmp;
      return String(a.id).localeCompare(String(b.id), "zh-CN");
    });
    return list;
  }, [accountById, favorites, searchQ, snowlumaRuntimes]);

  useEffect(() => {
    setRuntimePage(1);
  }, [searchQ, prefs.tablePageSize]);

  const pagedRuntimes = useMemo(
    () => slicePage(filteredRuntimes, runtimePage, prefs.tablePageSize),
    [filteredRuntimes, runtimePage, prefs.tablePageSize],
  );

  const pagedRuntimeIds = useMemo(() => pagedRuntimes.map((rt) => rt.id), [pagedRuntimes]);

  const emptyRuntimeIds = useMemo(
    () => filteredRuntimes.filter((rt) => runtimeMemberCount(rt) === 0).map((rt) => rt.id),
    [filteredRuntimes],
  );

  const selectedRows = useMemo(
    () => filteredRuntimes.filter((rt) => selected.has(rt.id)),
    [filteredRuntimes, selected],
  );

  const pageAllSelected = useMemo(
    () => pagedRuntimeIds.length > 0 && pagedRuntimeIds.every((id) => selected.has(id)),
    [pagedRuntimeIds, selected],
  );

  const configRuntime = useMemo(
    () => (configRuntimeId ? snowlumaRuntimes.find((rt) => rt.id === configRuntimeId) ?? null : null),
    [configRuntimeId, snowlumaRuntimes],
  );

  useEffect(() => {
    if (configRuntimeId && !configRuntime) setConfigRuntimeId(null);
  }, [configRuntime, configRuntimeId]);

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["protocol-snowluma-runtimes", mountUrl] });
    void qc.invalidateQueries({ queryKey: ["protocol-accounts", mountUrl] });
    void qc.invalidateQueries({ queryKey: ["instances"] });
  }, [qc, mountUrl]);

  function setSelectedId(runtimeId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(runtimeId);
      else next.delete(runtimeId);
      return next;
    });
  }

  function selectEmptyRuntimes() {
    setSelected(new Set(emptyRuntimeIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function toggleSelectPage() {
    setSelected((prev) => {
      if (pagedRuntimeIds.length > 0 && pagedRuntimeIds.every((id) => prev.has(id))) {
        const next = new Set(prev);
        for (const id of pagedRuntimeIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of pagedRuntimeIds) next.add(id);
      return next;
    });
  }

  async function startSnowlumaRuntime(runtimeId: string) {
    if (!mountUrl) return;
    setSnowlumaRuntimeBusyId(runtimeId);
    try {
      await protocolStartSnowlumaRuntime(mountUrl, runtimeId);
      pushConsoleToast("已请求启动 Runtime", "ok");
      refresh();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "启动失败"), "err");
    } finally {
      setSnowlumaRuntimeBusyId(null);
    }
  }

  async function stopSnowlumaRuntime(runtimeId: string) {
    if (!mountUrl) return;
    setSnowlumaRuntimeBusyId(runtimeId);
    try {
      await protocolStopSnowlumaRuntime(mountUrl, runtimeId);
      pushConsoleToast("已请求停止 Runtime", "ok");
      refresh();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "停止失败"), "err");
    } finally {
      setSnowlumaRuntimeBusyId(null);
    }
  }

  async function deleteOneRuntime(rt: SnowlumaRuntimeRow, opts?: { skipConfirm?: boolean }) {
    if (!mountUrl) return false;
    const members = runtimeMemberCount(rt);
    const title = runtimeTitle(rt);
    const force = members > 0;
    if (!opts?.skipConfirm) {
      const ok = force
        ? await confirm({
            title: "强制删除 Runtime",
            subtitle: `Runtime「${title}」仍有 ${members} 个账号。`,
            warnings: ["会一并删除这些协议账号、容器与数据。"],
            confirmLabel: "强制删除",
          })
        : await confirm({
            title: "删除空闲 Runtime",
            subtitle: `删除空闲 Runtime「${title}」？`,
            warnings: ["将停止并移除对应容器与注册记录。"],
            confirmLabel: "删除",
          });
      if (!ok) return false;
    }
    await protocolDeleteSnowlumaRuntime(mountUrl, rt.id, force);
    return true;
  }

  async function deleteSnowlumaRuntime(rt: SnowlumaRuntimeRow) {
    if (!mountUrl || batchBusy) return;
    setSnowlumaRuntimeBusyId(rt.id);
    try {
      const deleted = await deleteOneRuntime(rt);
      if (!deleted) return;
      pushConsoleToast(`已删除 Runtime ${runtimeTitle(rt)}`, "ok");
      setSelected((prev) => {
        if (!prev.has(rt.id)) return prev;
        const next = new Set(prev);
        next.delete(rt.id);
        return next;
      });
      if (configRuntimeId === rt.id) setConfigRuntimeId(null);
      refresh();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "删除失败"), "err");
    } finally {
      setSnowlumaRuntimeBusyId(null);
    }
  }

  async function deleteSelectedRuntimes() {
    if (!mountUrl || !selectedRows.length || batchBusy) return;
    const withMembers = selectedRows.filter((rt) => runtimeMemberCount(rt) > 0);
    const emptyCount = selectedRows.length - withMembers.length;
    const ok = await confirm({
      title: "批量删除 Runtime",
      subtitle: withMembers.length
        ? `将删除 ${selectedRows.length} 个 Runtime（空闲 ${emptyCount}，含账号 ${withMembers.length}）。`
        : `将删除 ${emptyCount} 个空闲 Runtime。`,
      warnings: withMembers.length
        ? ["含账号的项会强制删除协议账号、容器与数据。"]
        : ["将移除对应容器与注册记录。"],
      confirmLabel: "删除",
    });
    if (!ok) return;

    setBatchBusy(true);
    let okCount = 0;
    let failCount = 0;
    try {
      for (const rt of selectedRows) {
        try {
          await deleteOneRuntime(rt, { skipConfirm: true });
          okCount += 1;
        } catch {
          failCount += 1;
        }
      }
      if (failCount === 0) {
        pushConsoleToast(`已删除 ${okCount} 个 Runtime`, "ok");
      } else {
        pushConsoleToast(
          `删除完成：成功 ${okCount}，失败 ${failCount}`,
          failCount === okCount ? "err" : "warn",
        );
      }
      clearSelection();
      setConfigRuntimeId(null);
      refresh();
    } finally {
      setBatchBusy(false);
    }
  }

  const actionsBusy = batchBusy || imageSwitchBusy || snowlumaRuntimeBusyId != null;

  const chromeMiddle = useMemo(
    () => (
      <>
        <div className="protocol-runtime-search relative min-w-[calc(13ch+2.75rem)] flex-1 basis-[calc(13ch+2.75rem)]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <Input
            type="search"
            className={CHROME_SEARCH_INPUT}
            placeholder="搜索 Runtime / QQ…"
            aria-label="搜索 SnowLuma Runtime"
            autoComplete="off"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 gap-1"
              disabled={!mountUrl || actionsBusy}
              aria-label="选项"
            >
              {batchBusy ? "处理中…" : `选项${selected.size > 0 ? `（${selected.size}）` : ""}`}
              <ChevronDown className="size-3.5 opacity-70" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-0 w-max">
            <DropdownMenuItem
              disabled={!pagedRuntimeIds.length || actionsBusy}
              onSelect={() => toggleSelectPage()}
            >
              {pageAllSelected ? "取消全选" : "全选本页"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!emptyRuntimeIds.length || actionsBusy}
              onSelect={() => selectEmptyRuntimes()}
            >
              选择空闲{emptyRuntimeIds.length ? `（${emptyRuntimeIds.length}）` : ""}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={selected.size === 0 || actionsBusy} onSelect={() => clearSelection()}>
              清除选择
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!snowlumaRuntimes.length || actionsBusy} onSelect={() => setImageSwitchOpen(true)}>
              批量切换镜像
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={selected.size === 0 || actionsBusy}
              onSelect={() => void deleteSelectedRuntimes()}
            >
              {batchBusy ? "删除中…" : "删除选中"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    ),
    [
      searchQ,
      mountUrl,
      actionsBusy,
      batchBusy,
      selected.size,
      snowlumaRuntimes.length,
      pagedRuntimeIds.length,
      pageAllSelected,
      emptyRuntimeIds.length,
    ],
  );

  useRegisterProtocolChrome(
    useMemo(
      () => ({
        middle: chromeMiddle,
        onRefresh: refresh,
        refreshing: runtimesQ.isFetching || accountsQ.isFetching,
      }),
      [accountsQ.isFetching, chromeMiddle, refresh, runtimesQ.isFetching],
    ),
  );

  return (
    <div className="protocol-runtime-tab console-panel-stack">
      {!mountUrl ? <p className="muted text-sm">协议 API 未挂载，无法加载 Runtime。</p> : null}

      <Card className={PROTO_PANEL}>
        <CardHeader className={cn(PROTO_PANEL_HD, "border-b")}>
          <div className="min-w-0 space-y-1">
            <CardTitle className="panel__title flex items-center gap-1.5">
              <PanelTitleIcon icon={Cpu} />
              SnowLuma Runtime
            </CardTitle>
            <CardDescription>
              卡片管理容器启停；点「配置」挂载账号或启停单个 QQ。
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className={PROTO_PANEL_BD}>
          {runtimesPending ? (
            <ConsoleBlockSkeleton lines={4} label="Runtime 加载中" />
          ) : !snowlumaRuntimes.length ? (
            <p className="muted">暂无 SnowLuma Runtime。可在「创建账号」里新建或选用已有 Runtime。</p>
          ) : !filteredRuntimes.length ? (
            <p className="muted">无匹配 Runtime，试试其它关键词。</p>
          ) : (
            <>
              <div className="protocol-runtime-grid">
                {pagedRuntimes.map((rt) => {
                  const members = (rt.member_account_ids ?? [])
                    .map((id) => String(id || "").trim())
                    .filter(Boolean);
                  const runtimeBusy = snowlumaRuntimeBusyId === rt.id || batchBusy;
                  const checked = selected.has(rt.id);
                  const webuiPort =
                    rt.webui_port != null && String(rt.webui_port).trim()
                      ? String(rt.webui_port).trim()
                      : "";
                  const webuiHref = webuiPort
                    ? snowlumaRuntimeWebUiHref(rt, accounts, system)
                    : null;
                  const preview = members.slice(0, CHIP_PREVIEW_LIMIT);
                  const more = members.length - preview.length;
                  return (
                    <div
                      key={rt.id}
                      className={cn(
                        "protocol-runtime-card protocol-runtime-card--selectable",
                        checked && "protocol-runtime-card--selected",
                      )}
                      role="button"
                      tabIndex={0}
                      aria-pressed={checked}
                      aria-label={`选择 Runtime ${runtimeTitle(rt)}`}
                      onClick={() => {
                        if (actionsBusy) return;
                        setSelectedId(rt.id, !checked);
                      }}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (!actionsBusy) setSelectedId(rt.id, !checked);
                        }
                      }}
                    >
                      <div className="protocol-runtime-card__hd">
                        <div className="protocol-runtime-card__identity">
                          <div className="protocol-runtime-card__title-line">
                            <button
                              type="button"
                              className="protocol-runtime-card__title-btn"
                              title="打开配置"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfigRuntimeId(rt.id);
                              }}
                            >
                              {rt.display_name || rt.id}
                            </button>
                            <StatusTone
                              className="data-conn-capsule"
                              ok={Boolean(rt.process_running)}
                              okLabel="运行中"
                              offLabel="已停止"
                            />
                            {!members.length ? (
                              <Badge variant="neutral" size="compact">空闲</Badge>
                            ) : null}
                            {webuiPort ? (
                              webuiHref ? (
                                <a
                                  className="badge badge--compact badge--success protocol-runtime-webui-link"
                                  href={webuiHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`打开 WebUI :${webuiPort}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  WebUI :{webuiPort}
                                </a>
                              ) : (
                                <Badge variant="neutral" size="compact">
                                  WebUI :{webuiPort}
                                </Badge>
                              )
                            ) : null}
                          </div>
                          <div className="protocol-runtime-card__meta muted text-xs">
                            <span>{members.length} 个 QQ</span>
                            <span className="protocol-runtime-card__dot" aria-hidden>
                              ·
                            </span>
                            <span className="protocol-runtime-card__id" title={rt.id}>
                              {rt.id}
                            </span>
                          </div>
                          {rt.snowluma_docker_image ? (
                            <p className="protocol-runtime-card__image muted text-xs" title={rt.snowluma_docker_image}>
                              镜像：{rt.snowluma_docker_image}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {members.length ? (
                        <div className="protocol-runtime-card__chips">
                          {preview.map((memberId) => {
                            const account = accountById.get(memberId);
                            const label = account ? accountLabel(account) : memberId;
                            return (
                              <span key={memberId} className="protocol-runtime-chip" title={label}>
                                {label}
                              </span>
                            );
                          })}
                          {more > 0 ? (
                            <span className="protocol-runtime-chip protocol-runtime-chip--more">
                              +{more}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <p className="protocol-runtime-card__empty muted text-xs">尚未挂载账号</p>
                      )}

                      <div className="protocol-runtime-card__footer">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1 text-rose-600 hover:text-rose-700"
                          title="删除 Runtime"
                          aria-label="删除 Runtime"
                          disabled={runtimeBusy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteSnowlumaRuntime(rt);
                          }}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          删除
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-1"
                          title="配置挂载与 QQ 进程"
                          disabled={actionsBusy}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfigRuntimeId(rt.id);
                          }}
                        >
                          <Settings2 className="size-3.5" aria-hidden />
                          配置
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            rt.process_running && again.isArmed(`runtime-stop:${rt.id}`)
                              ? "destructive"
                              : rt.process_running
                                ? "outline"
                                : "default"
                          }
                          className="gap-1"
                          title={
                            rt.process_running
                              ? "停止 Runtime（容器/进程）"
                              : "启动 Runtime（容器/进程）"
                          }
                          aria-label={rt.process_running ? "停止 Runtime" : "启动 Runtime"}
                          disabled={runtimeBusy}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (rt.process_running) {
                              again.run(`runtime-stop:${rt.id}`, () => stopSnowlumaRuntime(rt.id));
                            } else {
                              void startSnowlumaRuntime(rt.id);
                            }
                          }}
                        >
                          {runtimeBusy && snowlumaRuntimeBusyId === rt.id ? (
                            "…"
                          ) : rt.process_running ? (
                            <>
                              <Square className="size-3.5" aria-hidden />
                              {again.label(`runtime-stop:${rt.id}`, "停止")}
                            </>
                          ) : (
                            <>
                              <Play className="size-3.5" aria-hidden />
                              启动
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <ConsolePagerBar
                page={runtimePage}
                pageSize={prefs.tablePageSize}
                total={filteredRuntimes.length}
                unit="个"
                onPageChange={setRuntimePage}
                onPageSizeChange={prefs.setTablePageSize}
              />
            </>
          )}
        </CardContent>
      </Card>

      <ProtocolRuntimeImageSwitchDialog
        open={imageSwitchOpen}
        mountUrl={mountUrl}
        runtimeCount={snowlumaRuntimes.length}
        onClose={() => setImageSwitchOpen(false)}
        onFinished={refresh}
        onBusyChange={setImageSwitchBusy}
      />
      <ProtocolRuntimeConfigDialog
        open={Boolean(configRuntime)}
        runtime={configRuntime}
        accounts={accounts}
        mountUrl={mountUrl}
        system={system}
        accountsLoading={accountsQ.isLoading}
        onClose={() => setConfigRuntimeId(null)}
        onChanged={refresh}
      />
      {confirmDialog}
    </div>
  );
}
