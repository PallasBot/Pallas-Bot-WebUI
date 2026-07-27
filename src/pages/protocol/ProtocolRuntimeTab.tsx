import { useCallback, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  protocolApiErrorMessage,
  protocolDeleteSnowlumaRuntime,
  protocolListAccounts,
  protocolListSnowlumaRuntimes,
  protocolStartSnowlumaRuntime,
  protocolStopSnowlumaRuntime,
  protocolSwitchAccountRuntime,
  type NapcatAccountRow,
  type SnowlumaRuntimeRow,
} from "@/api/protocol";
import { useRegisterProtocolChrome } from "@/components/protocol/ProtocolChromeContext";
import { CHROME_SEARCH_INPUT } from "@/components/ChromeTools";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ChevronDown, Cpu, Search, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import type { ProtocolOutletContext } from "@/pages/ProtocolPage";
import { pushConsoleToast } from "@/utils/consoleToast";
import { cn } from "@/lib/utils";

const PROTO_PANEL = "protocol-page__panel flex flex-col overflow-hidden shadow-none";
const PROTO_PANEL_HD =
  "panel__hd panel__hd--split inst-db-panel__hd flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const PROTO_PANEL_BD = "panel__bd px-4 pb-4 pt-3";

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

export default function ProtocolRuntimeTab() {
  const { mountUrl } = useOutletContext<ProtocolOutletContext>();
  const qc = useQueryClient();
  const [searchQ, setSearchQ] = useState("");
  const [snowlumaRuntimeBusyId, setSnowlumaRuntimeBusyId] = useState<string | null>(null);
  const [memberBusyKey, setMemberBusyKey] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addAccountId, setAddAccountId] = useState<Record<string, string>>({});
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
    return snowlumaRuntimes.filter((rt) => runtimeMatchesQuery(rt, q));
  }, [searchQ, snowlumaRuntimes]);

  const emptyRuntimeIds = useMemo(
    () => filteredRuntimes.filter((rt) => runtimeMemberCount(rt) === 0).map((rt) => rt.id),
    [filteredRuntimes],
  );

  const selectedRows = useMemo(
    () => filteredRuntimes.filter((rt) => selected.has(rt.id)),
    [filteredRuntimes, selected],
  );

  const filteredAllSelected = useMemo(
    () => filteredRuntimes.length > 0 && filteredRuntimes.every((rt) => selected.has(rt.id)),
    [filteredRuntimes, selected],
  );

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["protocol-snowluma-runtimes", mountUrl] });
    void qc.invalidateQueries({ queryKey: ["protocol-accounts", mountUrl] });
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

  function toggleSelectFiltered() {
    setSelected((prev) => {
      if (filteredRuntimes.length > 0 && filteredRuntimes.every((rt) => prev.has(rt.id))) {
        return new Set();
      }
      return new Set(filteredRuntimes.map((rt) => rt.id));
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
        ? window.confirm(
            `Runtime「${title}」仍有 ${members} 个账号。\n强制删除会一并删除这些协议账号、容器与数据，确定？`,
          )
        : window.confirm(`删除空闲 Runtime「${title}」？\n将停止并移除对应容器与注册记录。`);
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
      if (expandedId === rt.id) setExpandedId(null);
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
    const ok = withMembers.length
      ? window.confirm(
          `将删除 ${selectedRows.length} 个 Runtime（空闲 ${emptyCount}，含账号 ${withMembers.length}）。\n` +
            `含账号的项会强制删除协议账号、容器与数据，确定？`,
        )
      : window.confirm(`将删除 ${emptyCount} 个空闲 Runtime（容器与注册记录），确定？`);
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
      setExpandedId(null);
      refresh();
    } finally {
      setBatchBusy(false);
    }
  }

  function addableOptions(runtime: SnowlumaRuntimeRow): ComboboxOption[] {
    const mounted = new Set((runtime.member_account_ids ?? []).map((id) => String(id).trim()));
    return accounts
      .filter((row) => {
        const id = String(row.id ?? "").trim();
        return id && !mounted.has(id);
      })
      .map((row) => {
        const id = String(row.id ?? "").trim();
        const label = accountLabel(row);
        return {
          value: id,
          label,
          keywords: [label, id, String(row.qq ?? "")].join(" "),
        };
      });
  }

  async function attachAccount(runtimeId: string, accountId: string) {
    if (!mountUrl || !accountId) return;
    const busy = `${runtimeId}:add:${accountId}`;
    setMemberBusyKey(busy);
    try {
      await protocolSwitchAccountRuntime(mountUrl, accountId, {
        protocol_backend: "snowluma",
        runtime_mode: "existing",
        runtime_id: runtimeId,
      });
      pushConsoleToast(`已挂载账号 ${accountId}`, "ok");
      setAddAccountId((prev) => ({ ...prev, [runtimeId]: "" }));
      refresh();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "挂载失败"), "err");
    } finally {
      setMemberBusyKey(null);
    }
  }

  async function detachAccount(runtimeId: string, accountId: string) {
    if (!mountUrl || !accountId) return;
    if (
      !window.confirm(
        `将账号 ${accountId} 从该 Runtime 卸下？会为其新建独立 Runtime，账号仍为 SnowLuma。`,
      )
    ) {
      return;
    }
    const busy = `${runtimeId}:rm:${accountId}`;
    setMemberBusyKey(busy);
    try {
      await protocolSwitchAccountRuntime(mountUrl, accountId, {
        protocol_backend: "snowluma",
        runtime_mode: "new",
      });
      pushConsoleToast(`已卸下账号 ${accountId}`, "ok");
      refresh();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "卸下失败"), "err");
    } finally {
      setMemberBusyKey(null);
    }
  }

  const actionsBusy = batchBusy || snowlumaRuntimeBusyId != null || memberBusyKey != null;

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
              disabled={!filteredRuntimes.length || actionsBusy}
              onSelect={() => toggleSelectFiltered()}
            >
              {filteredAllSelected ? "取消全选" : "全选列表"}
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
      filteredRuntimes.length,
      filteredAllSelected,
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
              一个 Runtime 对应一个 SnowLuma 进程/容器，可挂多个 QQ。停某个 QQ 不会停 Runtime。
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className={PROTO_PANEL_BD}>
          {runtimesQ.isLoading ? (
            <p className="muted">加载中…</p>
          ) : !snowlumaRuntimes.length ? (
            <p className="muted">暂无 SnowLuma Runtime。可在「创建账号」里新建或选用已有 Runtime。</p>
          ) : !filteredRuntimes.length ? (
            <p className="muted">无匹配 Runtime，试试其它关键词。</p>
          ) : (
            <div className="protocol-runtime-grid">
              {filteredRuntimes.map((rt) => {
                const members = rt.member_account_ids ?? [];
                const expanded = expandedId === rt.id;
                const addOpts = addableOptions(rt);
                const selectedAdd = addAccountId[rt.id] ?? "";
                const runtimeBusy = snowlumaRuntimeBusyId === rt.id || batchBusy;
                const checked = selected.has(rt.id);
                return (
                  <div
                    key={rt.id}
                    className={cn(
                      "protocol-runtime-card",
                      checked && "protocol-runtime-card--selected",
                    )}
                  >
                    <div className="protocol-runtime-card__hd">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <label
                          className="protocol-runtime-card__select mt-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={actionsBusy}
                            aria-label={`选择 Runtime ${runtimeTitle(rt)}`}
                            onCheckedChange={(value) => setSelectedId(rt.id, value === true)}
                          />
                        </label>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="truncate">{rt.display_name || rt.id}</strong>
                            <span className={rt.process_running ? "pill pill--ok" : "pill"}>
                              {rt.process_running ? "运行中" : "已停止"}
                            </span>
                            {!members.length ? <span className="pill">空闲</span> : null}
                          </div>
                          <div className="muted text-xs break-all">{rt.id}</div>
                          <div className="muted flex flex-wrap gap-x-3 gap-y-1 text-xs">
                            <span>{members.length} 个 QQ</span>
                            {rt.webui_port != null && String(rt.webui_port).trim() ? (
                              <span>WebUI :{rt.webui_port}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="row-actions protocol-runtime-card__actions">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={runtimeBusy}
                          onClick={() => void startSnowlumaRuntime(rt.id)}
                        >
                          {runtimeBusy ? "…" : "启"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={runtimeBusy}
                          onClick={() => void stopSnowlumaRuntime(rt.id)}
                        >
                          {runtimeBusy ? "…" : "停"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1 text-rose-600 hover:text-rose-700"
                          disabled={runtimeBusy}
                          onClick={() => void deleteSnowlumaRuntime(rt)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          {snowlumaRuntimeBusyId === rt.id ? "…" : "删"}
                        </Button>
                      </div>
                    </div>

                    {members.length ? (
                      <div className="protocol-runtime-card__chips">
                        {members.map((memberId) => {
                          const account = accountById.get(String(memberId));
                          const label = account ? accountLabel(account) : String(memberId);
                          return (
                            <span key={memberId} className="protocol-runtime-chip" title={label}>
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted text-xs">尚未挂载账号</p>
                    )}

                    <div className="protocol-runtime-card__footer">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() =>
                          setExpandedId((prev) => (prev === rt.id ? null : rt.id))
                        }
                      >
                        {expanded ? (
                          <>
                            <X className="size-3.5" aria-hidden />
                            收起挂载
                          </>
                        ) : (
                          <>
                            <UserPlus className="size-3.5" aria-hidden />
                            编辑挂载
                          </>
                        )}
                      </Button>
                    </div>

                    {expanded ? (
                      <div className="protocol-runtime-card__edit">
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">已挂载</div>
                          {members.length ? (
                            <ul className="space-y-1.5">
                              {members.map((memberId) => {
                                const id = String(memberId);
                                const account = accountById.get(id);
                                const label = account ? accountLabel(account) : id;
                                const busy = memberBusyKey === `${rt.id}:rm:${id}`;
                                return (
                                  <li
                                    key={id}
                                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-sm"
                                  >
                                    <span className="min-w-0 truncate" title={label}>
                                      {label}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="shrink-0 gap-1 text-rose-600"
                                      disabled={busy || memberBusyKey != null || batchBusy}
                                      onClick={() => void detachAccount(rt.id, id)}
                                    >
                                      <UserMinus className="size-3.5" aria-hidden />
                                      {busy ? "卸下中…" : "卸下"}
                                    </Button>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="muted text-xs">暂无成员</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">添加账号</div>
                          {addOpts.length ? (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <div className="min-w-0 flex-1">
                                <Combobox
                                  value={selectedAdd}
                                  onValueChange={(id) =>
                                    setAddAccountId((prev) => ({ ...prev, [rt.id]: id }))
                                  }
                                  options={addOpts}
                                  placeholder="选择要挂载的账号"
                                  emptyText="无匹配账号"
                                  searchPlaceholder="搜索名称 / QQ…"
                                  searchThreshold={1}
                                  loading={accountsQ.isLoading}
                                  loadingText="正在读取账号…"
                                  ariaLabel={`向 ${rt.display_name || rt.id} 添加账号`}
                                />
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                className="shrink-0 gap-1"
                                disabled={
                                  !selectedAdd ||
                                  memberBusyKey === `${rt.id}:add:${selectedAdd}` ||
                                  memberBusyKey != null ||
                                  batchBusy
                                }
                                onClick={() => void attachAccount(rt.id, selectedAdd)}
                              >
                                <UserPlus className="size-3.5" aria-hidden />
                                {memberBusyKey === `${rt.id}:add:${selectedAdd}`
                                  ? "挂载中…"
                                  : "挂载"}
                              </Button>
                            </div>
                          ) : (
                            <p className="muted text-xs">没有可再挂载的协议账号</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
