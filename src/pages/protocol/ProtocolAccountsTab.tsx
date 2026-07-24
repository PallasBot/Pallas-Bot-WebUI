import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { InstancesData, NapcatAccountRow, SystemData } from "@/api/pallasTypes";
import {
  isExternalProtocolAccount,
  isPluginManagedProtocolAccount,
  mergeProtocolDisplayAccounts,
} from "@/utils/protocolDisplayAccounts";
import {
  accountConnectedWsPortLabel,
  accountProtocolId,
  accountWebUiHref,
} from "@/utils/protocolLinks";
import { slicePage } from "@/utils/paginate";
import {
  protocolApiErrorMessage,
  protocolDeleteAccount,
  protocolListAccounts,
  protocolListSnowlumaRuntimes,
  protocolRestartAccount,
  protocolStartAccount,
  protocolStartAccountBatch,
  protocolStopAccount,
  type ProtocolBatchJobPayload,
  type SnowlumaRuntimeRow,
} from "@/api/protocol";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal";
import ConsolePagerBar from "@/components/ConsolePagerBar";
import { ConsoleBlockSkeleton } from "@/components/ConsolePageSkeleton";
import PanelHdCollapseCaret from "@/components/PanelHdCollapseCaret";
import ProtocolAccountConfigDialog from "@/components/ProtocolAccountConfigDialog";
import ProtocolAccountQrcodeModal from "@/components/ProtocolAccountQrcodeModal";
import { useRegisterProtocolChrome } from "@/components/protocol/ProtocolChromeContext";
import SegTabs from "@/components/SegTabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Cable } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import type { ProtocolOutletContext } from "@/pages/ProtocolPage";
import { useBotFavorites } from "@/hooks/useBotFavorites";
import { useConsolePrefs } from "@/hooks/useConsolePrefs";
import {
  coerceBoolean,
  protocolBackendDisplayName,
  protocolRuntimeModeLabel,
  protocolRuntimeVersionText,
} from "@/utils/protocolUi";
import {
  protocolBatchPhaseLabel,
  protocolBatchProgressPercent,
  waitForProtocolBatchJob,
} from "@/utils/protocolBatch";
import { pushConsoleToast } from "@/utils/consoleToast";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PROTO_PANEL =
  "protocol-page__panel flex flex-col overflow-hidden shadow-none";
const PROTO_PANEL_HD =
  "panel__hd panel__hd--split inst-db-panel__hd flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const PROTO_PANEL_BD = "panel__bd px-4 pb-4 pt-3";

type ProtocolAccountAction = "power" | "restart";
type SelectedBatchKind = "restart" | "stop";

function protocolAccountNumber(a: NapcatAccountRow): number | null {
  const q = parseInt(String(a.qq ?? a.id ?? "").replace(/\s/g, ""), 10);
  if (Number.isFinite(q) && q > 0) return Math.floor(q);
  return null;
}

function profileNick(a: NapcatAccountRow, instances: InstancesData | null): string {
  const q = protocolAccountNumber(a);
  const nick = q != null ? instances?.bot_profiles?.[String(q)]?.nickname?.trim() : "";
  if (nick) return nick;
  return String(a.display_name ?? "").trim();
}

function primaryTitle(a: NapcatAccountRow, instances: InstancesData | null): string {
  const nick = profileNick(a, instances);
  if (nick) return nick;
  return "BOT";
}

function isProcessRunning(a: NapcatAccountRow): boolean {
  return coerceBoolean(a.process_running ?? a.running) === true;
}

function runningCapsuleClass(a: NapcatAccountRow): string {
  if (isExternalProtocolAccount(a)) return "muted";
  return isProcessRunning(a)
    ? "data-conn-capsule data-conn-capsule--run"
    : "data-conn-capsule data-conn-capsule--off";
}

function processStateLabel(a: NapcatAccountRow): string {
  if (isExternalProtocolAccount(a)) return "—";
  return isProcessRunning(a) ? "运行中" : "未运行";
}

function cardKey(a: NapcatAccountRow, index: number): string {
  return accountProtocolId(a) ?? `row-${index}`;
}

function actionBusyKey(accountId: string, action: ProtocolAccountAction): string {
  return `${action}:${accountId}`;
}

function isSnowlumaAccount(a: NapcatAccountRow): boolean {
  return String(a.protocol_backend ?? "").trim().toLowerCase() === "snowluma";
}

function snowlumaRuntimeLabel(a: NapcatAccountRow, runtimes: SnowlumaRuntimeRow[]): string {
  const rid = String(a.snowluma_runtime_id ?? "").trim();
  if (!rid) return "—";
  const hit = runtimes.find((rt) => rt.id === rid);
  return hit?.display_name?.trim() || rid;
}

function togglePowerLabel(a: NapcatAccountRow, busy: boolean): string {
  const running = isProcessRunning(a);
  const snow = isSnowlumaAccount(a);
  if (busy) {
    if (snow) return running ? "停 QQ 中…" : "启 QQ 中…";
    return running ? "停止中…" : "启动中…";
  }
  if (snow) return running ? "停 QQ" : "启 QQ";
  return running ? "停止" : "启动";
}

function restartLabel(busy: boolean): string {
  return busy ? "重启中…" : "重启";
}

export default function ProtocolAccountsTab() {
  const {
    mountUrl,
    instances,
    system,
    protoActionsEnabled,
    reload,
  } = useOutletContext<ProtocolOutletContext>();
  const qc = useQueryClient();
  const prefs = useConsolePrefs();
  const { favorites, toggleFavorite } = useBotFavorites();

  const [expProtocolAccounts, setExpProtocolAccounts] = useState(true);
  const [protoSearchQ, setProtoSearchQ] = useState("");
  const [protoAccPage, setProtoAccPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [configAccountId, setConfigAccountId] = useState<string | null>(null);
  const [configInitialTab, setConfigInitialTab] = useState<"overview" | "settings">("overview");
  const [qrcodeTarget, setQrcodeTarget] = useState<{ id: string; title: string } | null>(null);
  const [actionBusy, setActionBusy] = useState<Set<string>>(new Set());
  const [restartAllBusy, setRestartAllBusy] = useState(false);
  const [restartSelectedBusy, setRestartSelectedBusy] = useState(false);
  const [stopSelectedBusy, setStopSelectedBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");
  const [selectedBatchKind, setSelectedBatchKind] = useState<SelectedBatchKind | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchJob, setBatchJob] = useState<ProtocolBatchJobPayload | null>(null);

  const accountsQ = useQuery({
    queryKey: ["protocol-accounts", mountUrl],
    queryFn: () => protocolListAccounts(mountUrl!),
    enabled: Boolean(mountUrl),
    refetchInterval: 8000,
  });

  const runtimesQ = useQuery({
    queryKey: ["protocol-snowluma-runtimes", mountUrl],
    queryFn: () => protocolListSnowlumaRuntimes(mountUrl!),
    enabled: Boolean(mountUrl),
    refetchInterval: 8000,
  });

  const pluginAccounts = accountsQ.data ?? [];
  const snowlumaRuntimes = runtimesQ.data ?? [];

  const protocolAccountsSorted = useMemo(() => {
    const list = mergeProtocolDisplayAccounts(instances, pluginAccounts);
    list.sort((a, b) => {
      const fa = protocolAccountNumber(a);
      const fb = protocolAccountNumber(b);
      const favA = fa != null && favorites.has(fa) ? 1 : 0;
      const favB = fb != null && favorites.has(fb) ? 1 : 0;
      if (favA !== favB) return favB - favA;
      const ca = a.connected === true ? 1 : 0;
      const cb = b.connected === true ? 1 : 0;
      if (ca !== cb) return cb - ca;
      const na = profileNick(a, instances).toLowerCase();
      const nb = profileNick(b, instances).toLowerCase();
      const cmp = na.localeCompare(nb, "zh-CN");
      if (cmp !== 0) return cmp;
      return String(a.qq ?? a.id ?? "").localeCompare(String(b.qq ?? b.id ?? ""), "zh-CN", { numeric: true });
    });
    return list;
  }, [instances, pluginAccounts, favorites]);

  const filteredProtocolAccounts = useMemo(() => {
    const q = protoSearchQ.trim().toLowerCase();
    if (!q) return protocolAccountsSorted;
    return protocolAccountsSorted.filter((a) => {
      const hay = [
        String(a.qq ?? ""),
        String(a.id ?? ""),
        profileNick(a, instances),
        primaryTitle(a, instances),
        accountProtocolId(a) ?? "",
        protocolBackendDisplayName(a),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [protocolAccountsSorted, protoSearchQ, instances]);

  const pagedProtocolAccounts = useMemo(
    () => slicePage(filteredProtocolAccounts, protoAccPage, prefs.tablePageSize),
    [filteredProtocolAccounts, protoAccPage, prefs.tablePageSize],
  );

  const pagedProtocolIds = useMemo(
    () =>
      pagedProtocolAccounts
        .filter((a) => isPluginManagedProtocolAccount(a))
        .map((a) => accountProtocolId(a))
        .filter((id): id is string => Boolean(id)),
    [pagedProtocolAccounts],
  );

  const protoCardsPageAllSelected = useMemo(
    () => pagedProtocolIds.length > 0 && pagedProtocolIds.every((id) => selected.has(id)),
    [pagedProtocolIds, selected],
  );

  const protocolConnectedCount = protocolAccountsSorted.filter((a) => a.connected === true).length;
  const protocolAccountsTotalCount = protocolAccountsSorted.length;

  const accountById = useMemo(() => {
    const map = new Map<string, NapcatAccountRow>();
    for (const a of protocolAccountsSorted) {
      const id = accountProtocolId(a);
      if (id) map.set(id, a);
    }
    return map;
  }, [protocolAccountsSorted]);

  const deleteModalItems = useMemo(
    () =>
      [...selected]
        .sort()
        .map((id) => {
          const a = accountById.get(id);
          const title = a ? primaryTitle(a, instances) : id;
          const qq = a?.qq ?? a?.id ?? id;
          return { key: id, label: `${title} · ${qq}` };
        }),
    [selected, accountById, instances],
  );

  const deleteModalWarnings = useMemo(() => {
    const running: string[] = [];
    const connected: string[] = [];
    for (const id of [...selected].sort()) {
      const a = accountById.get(id);
      if (!a) continue;
      if (isProcessRunning(a)) running.push(id);
      if (a.connected === true) connected.push(id);
    }
    const out: string[] = [];
    if (running.length) {
      out.push(`以下账号进程仍在运行：${running.join("、")}。删除前将尝试停止，请确认。`);
    }
    if (connected.length) {
      out.push(`其中以下账号当前仍在线连接：${connected.join("、")}。删除后可能导致运行异常，请确认。`);
    }
    return out;
  }, [selected, accountById]);

  useEffect(() => {
    setProtoAccPage(1);
  }, [protoSearchQ, prefs.tablePageSize]);

  useEffect(() => {
    const known = new Set(
      protocolAccountsSorted
        .map((a) => accountProtocolId(a))
        .filter((id): id is string => Boolean(id)),
    );
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => known.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [protocolAccountsSorted]);

  async function refreshLists() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["protocol-accounts", mountUrl] }),
      qc.invalidateQueries({ queryKey: ["protocol-snowluma-runtimes", mountUrl] }),
      reload(),
    ]);
  }

  function setAccountActionBusy(accountId: string, action: ProtocolAccountAction, busy: boolean) {
    const key = actionBusyKey(accountId, action);
    setActionBusy((prev) => {
      const next = new Set(prev);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function isAccountActionBusy(a: NapcatAccountRow, action: ProtocolAccountAction): boolean {
    const id = accountProtocolId(a);
    return Boolean(id && actionBusy.has(actionBusyKey(id, action)));
  }

  function isAnyAccountActionBusy(a: NapcatAccountRow): boolean {
    return isAccountActionBusy(a, "power") || isAccountActionBusy(a, "restart");
  }

  function webUiHref(a: NapcatAccountRow): string | null {
    return accountWebUiHref(a, system as SystemData | null);
  }

  async function runBatch(
    body: { action: "restart" | "start" | "stop"; account_ids: string[] },
    confirmText?: string,
  ): Promise<ProtocolBatchJobPayload | null> {
    if (!mountUrl) {
      pushConsoleToast("协议端未启用", "warn");
      return null;
    }
    if (confirmText && !window.confirm(confirmText)) return null;
    setBatchBusy(true);
    setBatchOpen(true);
    setBatchJob(null);
    try {
      const started = await protocolStartAccountBatch(mountUrl, { ...body, mode: "rolling" });
      const job = await waitForProtocolBatchJob(mountUrl, started.job_id, {
        onProgress: (j) => setBatchJob(j),
      });
      setBatchJob(job);
      return job;
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "批量操作失败"), "err");
      return null;
    } finally {
      setBatchBusy(false);
    }
  }

  function closeBatchPanel() {
    if (batchBusy) return;
    setBatchOpen(false);
    setBatchJob(null);
  }

  async function toggleAccountPower(a: NapcatAccountRow) {
    const id = accountProtocolId(a);
    if (!mountUrl || !id || isAnyAccountActionBusy(a)) return;
    const stop = isProcessRunning(a);
    setAccountActionBusy(id, "power", true);
    try {
      if (stop) await protocolStopAccount(mountUrl, id);
      else await protocolStartAccount(mountUrl, id);
      pushConsoleToast(`${stop ? "已停止" : "已启动"} ${primaryTitle(a, instances)}`, stop ? "warn" : "ok");
      await refreshLists();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, stop ? "停止失败" : "启动失败"), "err");
    } finally {
      setAccountActionBusy(id, "power", false);
    }
  }

  async function restartAccount(a: NapcatAccountRow) {
    const id = accountProtocolId(a);
    if (!mountUrl || !id || isAnyAccountActionBusy(a)) return;
    setAccountActionBusy(id, "restart", true);
    try {
      await protocolRestartAccount(mountUrl, id);
      pushConsoleToast(`已重启 ${primaryTitle(a, instances)}`, "ok");
      await refreshLists();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "重启失败"), "err");
    } finally {
      setAccountActionBusy(id, "restart", false);
    }
  }

  async function restartSelectedAccounts() {
    const ids = [...selected].sort();
    if (!ids.length) {
      pushConsoleToast("请先勾选要重启的账号", "warn");
      return;
    }
    if (restartSelectedBusy) return;
    setRestartSelectedBusy(true);
    try {
      const job = await runBatch({ action: "restart", account_ids: ids });
      if (job) {
        const failed = (job.results ?? []).filter((r) => !r.ok).length;
        pushConsoleToast(
          failed ? `重启完成，${failed} 个失败` : `已重启 ${ids.length} 个账号`,
          failed ? "warn" : "ok",
        );
        setSelected(new Set());
        await refreshLists();
      }
    } finally {
      setRestartSelectedBusy(false);
      closeBatchPanel();
    }
  }

  async function stopSelectedAccounts() {
    const ids = [...selected].sort();
    if (!ids.length) {
      pushConsoleToast("请先勾选要停止的账号", "warn");
      return;
    }
    if (stopSelectedBusy) return;
    setStopSelectedBusy(true);
    try {
      const job = await runBatch({ action: "stop", account_ids: ids });
      if (job) {
        const failed = (job.results ?? []).filter((r) => !r.ok).length;
        pushConsoleToast(
          failed ? `停止完成，${failed} 个失败` : `已停止 ${ids.length} 个账号`,
          failed ? "warn" : "ok",
        );
        setSelected(new Set());
        await refreshLists();
      }
    } finally {
      setStopSelectedBusy(false);
      closeBatchPanel();
    }
  }

  async function restartAllAccounts() {
    const ids = protocolAccountsSorted
      .map((a) => accountProtocolId(a))
      .filter((id): id is string => Boolean(id));
    if (!mountUrl || !ids.length) {
      pushConsoleToast("当前没有可重启的账号", "warn");
      return;
    }
    if (restartAllBusy) return;
    setRestartAllBusy(true);
    try {
      const job = await runBatch(
        { action: "restart", account_ids: ids },
        `将按间隔依次重启全部 ${ids.length} 个账号。继续？`,
      );
      if (job) {
        const failed = (job.results ?? []).filter((r) => !r.ok).length;
        pushConsoleToast(failed ? `重启完成，${failed} 个失败` : "已重启全部账号", failed ? "warn" : "ok");
        await refreshLists();
      }
    } finally {
      setRestartAllBusy(false);
      closeBatchPanel();
    }
  }

  function openDeleteModal() {
    if (selected.size === 0) return;
    setDeleteErr("");
    setDeleteModalOpen(true);
  }

  function openSelectedBatchConfirm(kind: SelectedBatchKind) {
    if (selected.size === 0) {
      pushConsoleToast("请先勾选账号", "warn");
      return;
    }
    setSelectedBatchKind(kind);
  }

  function closeSelectedBatchConfirm() {
    if (restartSelectedBusy || stopSelectedBusy || batchBusy) return;
    setSelectedBatchKind(null);
  }

  async function confirmSelectedBatch() {
    const kind = selectedBatchKind;
    if (!kind) return;
    try {
      if (kind === "restart") await restartSelectedAccounts();
      else await stopSelectedAccounts();
    } finally {
      setSelectedBatchKind(null);
    }
  }

  function closeDeleteModal() {
    if (deleteBusy) return;
    setDeleteModalOpen(false);
    setDeleteErr("");
  }

  async function confirmDeleteSelected() {
    if (!mountUrl) return;
    const ids = [...selected].sort();
    if (!ids.length) return;
    setDeleteBusy(true);
    setDeleteErr("");
    try {
      for (const id of ids) {
        await protocolDeleteAccount(mountUrl, id);
      }
      pushConsoleToast(`已删除 ${ids.length} 个账号`, "warn");
      setSelected(new Set());
      setDeleteModalOpen(false);
      if (configAccountId && ids.includes(configAccountId)) setConfigAccountId(null);
      await refreshLists();
    } catch (e) {
      setDeleteErr(protocolApiErrorMessage(e, "删除失败"));
      await refreshLists();
    } finally {
      setDeleteBusy(false);
    }
  }

  function setSelectedId(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openAccountConfig(accountId: string, tab: "overview" | "settings" = "overview") {
    setConfigInitialTab(tab);
    setConfigAccountId(accountId);
  }

  function openQrcodeModal(a: NapcatAccountRow) {
    const id = accountProtocolId(a);
    if (!mountUrl || !id) {
      pushConsoleToast("无法打开二维码：协议端未启用或缺少账号 ID", "warn");
      return;
    }
    setQrcodeTarget({ id, title: primaryTitle(a, instances) });
  }

  function toggleSelectAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (protoCardsPageAllSelected) {
        for (const id of pagedProtocolIds) next.delete(id);
      } else {
        for (const id of pagedProtocolIds) next.add(id);
      }
      return next;
    });
  }

  const chromeRefresh = useCallback(() => {
    void refreshLists();
  }, [mountUrl, qc, reload]);

  const chromeMiddle = useMemo(
    () => (
      <>
        <div className="protocol-accounts-search relative min-w-[calc(13ch+2.75rem)] flex-1 basis-[calc(13ch+2.75rem)]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <Input
            type="search"
            className="h-8 min-h-8 w-full pl-8"
            placeholder="搜索账号…"
            aria-label="搜索账号"
            autoComplete="off"
            value={protoSearchQ}
            onChange={(e) => setProtoSearchQ(e.target.value)}
          />
        </div>
        <SegTabs
          size="toolbar"
          className="shrink-0"
          ariaLabel="实例表格或卡片视图"
          value={prefs.protocolAccountsView}
          onValueChange={(v) => prefs.setProtocolAccountsView(v === "cards" ? "cards" : "table")}
          options={[
            { value: "table", label: "表格" },
            { value: "cards", label: "卡片" },
          ]}
        />
        {protoActionsEnabled ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                restartAllBusy ||
                stopSelectedBusy ||
                restartSelectedBusy ||
                batchBusy ||
                protocolAccountsTotalCount === 0 ||
                actionBusy.size > 0
              }
              onClick={() => void restartAllAccounts()}
            >
              {restartAllBusy ? "重启全部中…" : "重启全部"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  disabled={
                    restartSelectedBusy ||
                    stopSelectedBusy ||
                    deleteBusy ||
                    batchBusy ||
                    actionBusy.size > 0
                  }
                  aria-label="选项"
                >
                  {restartSelectedBusy || stopSelectedBusy
                    ? "处理中…"
                    : `选项${selected.size > 0 ? `（${selected.size}）` : ""}`}
                  <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-0 w-max">
                <DropdownMenuItem
                  disabled={pagedProtocolIds.length === 0}
                  onSelect={() => toggleSelectAllOnPage()}
                >
                  {protoCardsPageAllSelected ? "取消全选" : "全选本页"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selected.size === 0}
                  onSelect={() => setSelected(new Set())}
                >
                  清除选择
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={selected.size === 0 || restartSelectedBusy || batchBusy}
                  onSelect={() => openSelectedBatchConfirm("restart")}
                >
                  重启所选
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selected.size === 0 || stopSelectedBusy || batchBusy}
                  onSelect={() => openSelectedBatchConfirm("stop")}
                >
                  停止所选
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={selected.size === 0 || deleteBusy}
                  onSelect={() => openDeleteModal()}
                >
                  删除选中
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </>
    ),
    [
      protoSearchQ,
      prefs.protocolAccountsView,
      prefs.setProtocolAccountsView,
      protoActionsEnabled,
      restartAllBusy,
      restartSelectedBusy,
      stopSelectedBusy,
      deleteBusy,
      batchBusy,
      protocolAccountsTotalCount,
      selected.size,
      actionBusy.size,
      pagedProtocolIds.length,
      protoCardsPageAllSelected,
    ],
  );

  useRegisterProtocolChrome(
    useMemo(
      () => ({ middle: chromeMiddle, onRefresh: chromeRefresh }),
      [chromeMiddle, chromeRefresh],
    ),
  );

  const batchPhase = batchBusy
    ? protocolBatchPhaseLabel(batchJob) || "批量任务进行中…"
    : protocolBatchPhaseLabel(batchJob);

  return (
    <div className="protocol-accounts-tab">
      {!mountUrl ? <p className="muted text-sm">协议 API 未挂载，无法加载账号列表。</p> : null}

      {batchOpen ? (
        <Card className="protocol-page__batch shadow-none" role="status" aria-live="polite">
          <CardContent className="space-y-2 p-4">
            <div className="protocol-page__batch-track">
              <div
                className="protocol-page__batch-fill"
                style={{ width: `${protocolBatchProgressPercent(batchJob)}%` }}
              />
            </div>
            <p className="muted protocol-page__batch-msg">{batchPhase}</p>
          </CardContent>
        </Card>
      ) : null}


      <Card className={cn(PROTO_PANEL, "mb-0")}>
        <CardHeader className={PROTO_PANEL_HD}>
          <CardTitle className="panel__title flex items-center gap-1.5">
            <PanelTitleIcon icon={Cable} />
            已连接账号
            <PanelHdCollapseCaret
              expanded={expProtocolAccounts}
              label="已连接账号"
              onToggle={() => setExpProtocolAccounts((v) => !v)}
            />
          </CardTitle>
          <div className="inst-db-panel__hd-side">
            <span className="inst-db-stat muted">
              当前已连接 <strong className="inst-db-stat__num">{protocolConnectedCount}</strong> /{" "}
              {protocolAccountsTotalCount} 账号
            </span>
          </div>
        </CardHeader>

        {expProtocolAccounts ? (
          <CardContent className={PROTO_PANEL_BD}>
            {accountsQ.isLoading ? <ConsoleBlockSkeleton lines={4} label="账号列表加载中" /> : null}
            {accountsQ.error ? (
              <p className="alert alert--err">{protocolApiErrorMessage(accountsQ.error, "加载失败")}</p>
            ) : null}

            {!accountsQ.isLoading && !filteredProtocolAccounts.length ? (
              <p className="muted">没有匹配的协议账号</p>
            ) : null}

            {prefs.protocolAccountsView === "table" && filteredProtocolAccounts.length > 0 ? (
              <div className="table-wrap">
                <table className="data console-data-table">
                  <thead>
                    <tr>
                      <th>昵称</th>
                      <th>账号</th>
                      <th>协议</th>
                      <th>Runtime</th>
                      <th>运行方式</th>
                      <th>版本</th>
                      <th>连接</th>
                      <th>进程</th>
                      <th>WebUI</th>
                      <th>WS 端口</th>
                      <th style={{ width: 220 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedProtocolAccounts.map((a, i) => {
                      const id = accountProtocolId(a);
                      const favNum = protocolAccountNumber(a);
                      const href = webUiHref(a);
                      return (
                        <tr key={`tbl-${cardKey(a, i)}`}>
                          <td className="inst-account-nick">{primaryTitle(a, instances)}</td>
                          <td>{a.qq ?? a.id ?? "—"}</td>
                          <td>{protocolBackendDisplayName(a)}</td>
                          <td
                            className="muted"
                            title={String(a.snowluma_runtime_id ?? "").trim() || undefined}
                          >
                            {isSnowlumaAccount(a) ? snowlumaRuntimeLabel(a, snowlumaRuntimes) : "—"}
                          </td>
                          <td>{protocolRuntimeModeLabel(a)}</td>
                          <td
                            className="muted"
                            title={String(a.runtime_source ?? "").trim() || undefined}
                          >
                            {protocolRuntimeVersionText(a)}
                          </td>
                          <td>
                            <span
                              className={
                                a.connected === true
                                  ? "data-conn-capsule data-conn-capsule--on"
                                  : "data-conn-capsule data-conn-capsule--off"
                              }
                            >
                              {a.connected === true ? "已连接" : "未连接"}
                            </span>
                          </td>
                          <td>
                            <span className={runningCapsuleClass(a)}>{processStateLabel(a)}</span>
                          </td>
                          <td>
                            {href ? (
                              <a className="link-quiet" href={href} target="_blank" rel="noopener noreferrer">
                                {a.webui_port ?? "打开"}
                              </a>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>
                            {isExternalProtocolAccount(a) ? "—" : accountConnectedWsPortLabel(a)}
                          </td>
                          <td>
                            <div className="inst-actions protocol-acc-table-actions">
                              {isPluginManagedProtocolAccount(a) && protoActionsEnabled ? (
                                <>
                                  {id ? (
                                    <button
                                      type="button"
                                      className="btn btn--sm"
                                      onClick={() => openAccountConfig(id)}
                                    >
                                      配置
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="btn btn--sm"
                                    disabled={isAnyAccountActionBusy(a)}
                                    onClick={() => void restartAccount(a)}
                                  >
                                    {restartLabel(isAccountActionBusy(a, "restart"))}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn--sm"
                                    disabled={!mountUrl || !id}
                                    onClick={() => openQrcodeModal(a)}
                                  >
                                    二维码
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn--sm${isProcessRunning(a) ? "" : " btn--primary"}`}
                                    disabled={isAnyAccountActionBusy(a)}
                                    onClick={() => void toggleAccountPower(a)}
                                  >
                                    {togglePowerLabel(a, isAccountActionBusy(a, "power"))}
                                  </button>
                                </>
                              ) : null}
                              {favNum != null ? (
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm inst-fav-star"
                                  aria-pressed={favorites.has(favNum)}
                                  title={favorites.has(favNum) ? "取消收藏" : "收藏"}
                                  onClick={() => toggleFavorite(favNum)}
                                >
                                  ★
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {prefs.protocolAccountsView === "table" && filteredProtocolAccounts.length > 0 ? (
              <ConsolePagerBar
                page={protoAccPage}
                pageSize={prefs.tablePageSize}
                total={filteredProtocolAccounts.length}
                onPageChange={setProtoAccPage}
                onPageSizeChange={prefs.setTablePageSize}
              />
            ) : null}

            {prefs.protocolAccountsView === "cards" && filteredProtocolAccounts.length > 0 ? (
              <div className="data-card-grid data-card-grid--bots">
                {pagedProtocolAccounts.map((a, i) => {
                  const id = accountProtocolId(a);
                  const favNum = protocolAccountNumber(a);
                  const href = webUiHref(a);
                  return (
                    <div
                      key={cardKey(a, i)}
                      className="data-summary-card data-summary-card--kv data-summary-card--bot"
                    >
                      <div className="data-summary-card__head data-summary-card__head--bot">
                        {protoActionsEnabled && id && isPluginManagedProtocolAccount(a) ? (
                          <label className="inst-db-card-select" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selected.has(id)}
                              aria-label={`选择账号 ${id}`}
                              onChange={(e) => setSelectedId(id, e.target.checked)}
                            />
                          </label>
                        ) : null}
                        <div className="data-summary-card__head-main">
                          <div className="data-summary-card__title-line">
                            <div className="data-summary-card__primary">
                              {id ? (
                                <button
                                  type="button"
                                  className="data-summary-card__title-link"
                                  onClick={() => openAccountConfig(id)}
                                >
                                  {primaryTitle(a, instances)}
                                </button>
                              ) : (
                                <span>{primaryTitle(a, instances)}</span>
                              )}
                            </div>
                            {favNum != null ? (
                              <button
                                type="button"
                                className="data-card-fav-star"
                                aria-pressed={favorites.has(favNum)}
                                title={favorites.has(favNum) ? "取消收藏" : "收藏"}
                                onClick={() => toggleFavorite(favNum)}
                              >
                                ★
                              </button>
                            ) : null}
                          </div>
                          <div className="data-summary-card__secondary muted">{a.qq ?? a.id ?? "—"}</div>
                        </div>
                        <div className="data-summary-card__head-badges">
                          <span
                            className={
                              a.connected === true
                                ? "data-conn-capsule data-conn-capsule--on"
                                : "data-conn-capsule data-conn-capsule--off"
                            }
                          >
                            {a.connected === true ? "已连接" : "未连接"}
                          </span>
                          <span className={runningCapsuleClass(a)}>{processStateLabel(a)}</span>
                        </div>
                      </div>
                      <div className="data-summary-card__body">
                        <div className="data-summary-card__row">
                          <span className="data-summary-card__label">协议实现</span>
                          <span className="data-summary-card__val">{protocolBackendDisplayName(a)}</span>
                        </div>
                        {isSnowlumaAccount(a) ? (
                          <div className="data-summary-card__row">
                            <span className="data-summary-card__label">Runtime</span>
                            <span
                              className="data-summary-card__val muted"
                              title={String(a.snowluma_runtime_id ?? "").trim() || undefined}
                            >
                              {snowlumaRuntimeLabel(a, snowlumaRuntimes)}
                            </span>
                          </div>
                        ) : null}
                        <div className="data-summary-card__row">
                          <span className="data-summary-card__label">运行方式</span>
                          <span className="data-summary-card__val data-summary-card__val--mode">
                            {protocolRuntimeModeLabel(a)}
                          </span>
                        </div>
                        <div className="data-summary-card__row">
                          <span className="data-summary-card__label">版本</span>
                          <span
                            className="data-summary-card__val data-summary-card__val--version"
                            title={String(a.runtime_source ?? "").trim() || undefined}
                          >
                            {protocolRuntimeVersionText(a)}
                          </span>
                        </div>
                        <div className="data-summary-card__row">
                          <span className="data-summary-card__label">内置 WebUI</span>
                          {href ? (
                            <a
                              className="data-summary-card__val data-summary-card__val--link link-quiet"
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {a.webui_port ?? "打开"}
                            </a>
                          ) : (
                            <span className="data-summary-card__val muted">{a.webui_port ?? "—"}</span>
                          )}
                        </div>
                        <div className="data-summary-card__row">
                          <span className="data-summary-card__label">WS 端口</span>
                          <span className="data-summary-card__val">
                            {isExternalProtocolAccount(a) ? "—" : accountConnectedWsPortLabel(a)}
                          </span>
                        </div>
                      </div>
                      {isPluginManagedProtocolAccount(a) && protoActionsEnabled ? (
                        <div className="data-summary-card__tags data-summary-card__foot inst-card-actions">
                          {id ? (
                            <button type="button" className="btn btn--sm" onClick={() => openAccountConfig(id)}>
                              配置
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn--sm"
                            disabled={isAnyAccountActionBusy(a)}
                            onClick={() => void restartAccount(a)}
                          >
                            {restartLabel(isAccountActionBusy(a, "restart"))}
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm"
                            disabled={!mountUrl || !id}
                            onClick={() => openQrcodeModal(a)}
                          >
                            二维码
                          </button>
                          <button
                            type="button"
                            className={`btn btn--sm${isProcessRunning(a) ? "" : " btn--primary"}`}
                            disabled={isAnyAccountActionBusy(a)}
                            onClick={() => void toggleAccountPower(a)}
                          >
                            {togglePowerLabel(a, isAccountActionBusy(a, "power"))}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {prefs.protocolAccountsView === "cards" && filteredProtocolAccounts.length > 0 ? (
              <ConsolePagerBar
                page={protoAccPage}
                pageSize={prefs.tablePageSize}
                total={filteredProtocolAccounts.length}
                onPageChange={setProtoAccPage}
                onPageSizeChange={prefs.setTablePageSize}
              />
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <ProtocolAccountConfigDialog
        open={Boolean(configAccountId)}
        accountId={configAccountId ?? ""}
        mountUrl={mountUrl}
        system={system}
        initialTab={configInitialTab}
        onClose={() => setConfigAccountId(null)}
        onDeleted={() => void refreshLists()}
      />
      <ProtocolAccountQrcodeModal
        open={Boolean(qrcodeTarget)}
        mountUrl={mountUrl}
        accountId={qrcodeTarget?.id ?? null}
        accountTitle={qrcodeTarget?.title ?? ""}
        onClose={() => setQrcodeTarget(null)}
      />
      <ConsoleDeleteConfirmModal
        open={deleteModalOpen}
        title="删除账号"
        subtitle={`将删除以下账号（共 ${selected.size} 个），协议端账号将被移除，数据目录是否保留取决于主仓配置，操作不可撤销。`}
        items={deleteModalItems}
        warnings={deleteModalWarnings}
        busy={deleteBusy}
        error={deleteErr}
        titleId="proto-delete-modal-title"
        onClose={closeDeleteModal}
        onConfirm={() => void confirmDeleteSelected()}
      />
      <ConsoleDeleteConfirmModal
        open={selectedBatchKind != null}
        title={selectedBatchKind === "stop" ? "停止所选账号" : "重启所选账号"}
        subtitle={
          selectedBatchKind === "stop"
            ? `将按间隔依次停止 ${selected.size} 个账号。请确认后再继续。`
            : `将按间隔依次重启 ${selected.size} 个账号，以降低系统负载。请确认后再继续。`
        }
        items={deleteModalItems}
        busy={restartSelectedBusy || stopSelectedBusy || batchBusy}
        confirmVariant="default"
        confirmLabel={selectedBatchKind === "stop" ? "确认停止" : "确认重启"}
        busyLabel={selectedBatchKind === "stop" ? "停止中…" : "重启中…"}
        titleId="proto-selected-batch-modal-title"
        onClose={closeSelectedBatchConfirm}
        onConfirm={() => void confirmSelectedBatch()}
      />
    </div>
  );
}
