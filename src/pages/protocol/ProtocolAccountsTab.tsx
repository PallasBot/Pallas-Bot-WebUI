import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { disconnectBotWs } from "@/api/fullConsole";
import type { InstancesData, NapcatAccountRow, SystemData } from "@/api/pallasTypes";
import {
  isExternalProtocolAccount,
  isPluginManagedProtocolAccount,
  mergeProtocolDisplayAccounts,
  protocolAccountDisplayName,
} from "@/utils/protocolDisplayAccounts";
import {
  accountConnectedWsPortLabel,
  accountProtocolId,
  accountWebUiHref,
} from "@/utils/protocolLinks";
import { qqAvatarUrl } from "@/utils/botDisplay";
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
import PanelHdCollapseCaret from "@/components/PanelHdCollapseCaret";
import PendingValue from "@/components/PendingValue";
import ProtocolAccountConfigDialog from "@/components/ProtocolAccountConfigDialog";
import ProtocolAccountQrcodeModal from "@/components/ProtocolAccountQrcodeModal";
import StatusTone from "@/components/StatusTone";
import { useRegisterProtocolChrome } from "@/components/protocol/ProtocolChromeContext";
import ChromeStatusFilter, {
  type ChromeStatusFilterOption,
} from "@/components/ChromeStatusFilter";
import { CHROME_SEARCH_INPUT } from "@/components/ChromeTools";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Cable,
  ChevronDown,
  Loader2,
  Play,
  QrCode,
  RefreshCw,
  Search,
  Square,
  Unplug,
} from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import { querySettled } from "@/utils/querySettled";
import type { ProtocolOutletContext } from "@/pages/ProtocolPage";
import { useBotFavorites } from "@/hooks/useBotFavorites";
import { useConfirmAgain } from "@/hooks/useConfirmAgain";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";
import { useConsolePrefs } from "@/hooks/useConsolePrefs";
import { pushConsoleToast } from "@/utils/consoleToast";
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

const EMPTY_PROTOCOL_ACCOUNTS: NapcatAccountRow[] = [];
const EMPTY_SNOWLUMA_RUNTIMES: SnowlumaRuntimeRow[] = [];

type ProtoStatusFilter =
  | "all"
  | "connected"
  | "disconnected"
  | "process_running"
  | "external";

const PROTO_STATUS_FILTER_OPTIONS: readonly ChromeStatusFilterOption<ProtoStatusFilter>[] = [
  { value: "all", label: "全部" },
  { value: "connected", label: "已连接" },
  { value: "disconnected", label: "未连接" },
  { value: "process_running", label: "进程运行中" },
  { value: "external", label: "外置账号" },
];

type ProtocolAccountAction = "power" | "restart" | "disconnect";
type SelectedBatchKind = "restart" | "stop";

function protocolAccountNumber(a: NapcatAccountRow): number | null {
  const q = parseInt(String(a.qq ?? a.id ?? "").replace(/\s/g, ""), 10);
  if (Number.isFinite(q) && q > 0) return Math.floor(q);
  return null;
}

function primaryTitle(a: NapcatAccountRow, instances: InstancesData | null): string {
  const nick = protocolAccountDisplayName(a, instances);
  if (nick) return nick;
  return "BOT";
}

function AccountAvatar({ qq }: { qq: number | null }) {
  if (qq == null) {
    return <div className="data-summary-card__avatar" aria-hidden />;
  }
  return (
    <div className="data-summary-card__avatar">
      <img
        src={qqAvatarUrl(qq)}
        alt=""
        width={36}
        height={36}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={(e) => {
          (e.target as HTMLImageElement).style.visibility = "hidden";
        }}
      />
    </div>
  );
}

function isProcessRunning(a: NapcatAccountRow): boolean {
  // 以 process_running 为准；勿回退 running（后者含 connected，停 QQ 后仍可能为 true）
  if (a.process_running !== undefined && a.process_running !== null) {
    return coerceBoolean(a.process_running) === true;
  }
  return coerceBoolean(a.running) === true;
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
    if (snow) return running ? "正在停止 QQ" : "正在启动 QQ";
    return running ? "正在停止" : "正在启动";
  }
  if (snow) return running ? "停 QQ" : "启 QQ";
  return running ? "停止" : "启动";
}

function togglePowerContent(a: NapcatAccountRow, busy: boolean) {
  if (busy) {
    return <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />;
  }
  const running = isProcessRunning(a);
  const snow = isSnowlumaAccount(a);
  const Icon = running ? Square : Play;
  const text = snow ? (running ? "停 QQ" : "启 QQ") : running ? "停止" : "启动";
  return (
    <>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {text}
    </>
  );
}

function restartContent(busy: boolean) {
  if (busy) {
    return <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />;
  }
  return (
    <>
      <RefreshCw className="size-3.5 shrink-0" aria-hidden />
      重启
    </>
  );
}

function restartLabel(busy: boolean): string {
  return busy ? "正在重启" : "重启";
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
  const { confirm, confirmDialog } = useConsoleConfirm();
  const again = useConfirmAgain();

  const [expProtocolAccounts, setExpProtocolAccounts] = useState(true);
  const [protoSearchQ, setProtoSearchQ] = useState("");
  const [protoStatusFilter, setProtoStatusFilter] = useState<ProtoStatusFilter>("all");
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
  const [listRefreshBusy, setListRefreshBusy] = useState(false);

  const accountsQ = useQuery({
    queryKey: ["protocol-accounts", mountUrl],
    queryFn: () => protocolListAccounts(mountUrl!),
    enabled: Boolean(mountUrl),
    refetchInterval: 8000,
  });

  const runtimesQ = useQuery({
    queryKey: ["protocol-snowluma-runtimes", mountUrl, "lite"],
    queryFn: () => protocolListSnowlumaRuntimes(mountUrl!, { lite: true }),
    enabled: Boolean(mountUrl),
    refetchInterval: 8000,
  });

  const pluginAccounts = accountsQ.data ?? EMPTY_PROTOCOL_ACCOUNTS;
  const snowlumaRuntimes = runtimesQ.data ?? EMPTY_SNOWLUMA_RUNTIMES;
  const accountsSettled = !mountUrl || querySettled(accountsQ);
  const hasOnlineBots = (instances?.nonebot_bots?.length ?? 0) > 0;
  const location = useLocation();
  const previewExternalOnly =
    new URLSearchParams(location.search).get("preview_external") === "1";
  /** 等插件账号与实例侧数据齐了再出卡，避免先出外置/骨架再补托管 */
  const accountsListReady = previewExternalOnly || accountsSettled;
  const showAccountsLoading =
    !previewExternalOnly && Boolean(mountUrl) && !accountsSettled;

  const protocolAccountsSorted = useMemo(() => {
    if (previewExternalOnly) {
      return [
        {
          id: "3023094357",
          qq: "3023094357",
          connected: true,
          process_running: false,
          account_source: "external" as const,
          protocol_backend: "external",
          external_adapter: "OneBot V11",
          ws_port: 8090,
          ws_url: "ws://127.0.0.1:8090/onebot/v11/ws",
        },
      ];
    }
    if (!accountsListReady) return [];
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
      const ra = isProcessRunning(a) ? 1 : 0;
      const rb = isProcessRunning(b) ? 1 : 0;
      if (ra !== rb) return rb - ra;
      const na = protocolAccountDisplayName(a, instances).toLowerCase();
      const nb = protocolAccountDisplayName(b, instances).toLowerCase();
      const cmp = na.localeCompare(nb, "zh-CN");
      if (cmp !== 0) return cmp;
      return String(a.qq ?? a.id ?? "").localeCompare(String(b.qq ?? b.id ?? ""), "zh-CN", { numeric: true });
    });
    return list;
  }, [accountsListReady, instances, pluginAccounts, favorites, previewExternalOnly]);

  const filteredProtocolAccounts = useMemo(() => {
    const q = protoSearchQ.trim().toLowerCase();
    return protocolAccountsSorted.filter((a) => {
      if (q) {
        const hay = [
          String(a.qq ?? ""),
          String(a.id ?? ""),
          protocolAccountDisplayName(a, instances),
          primaryTitle(a, instances),
          accountProtocolId(a) ?? "",
          protocolBackendDisplayName(a),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (protoStatusFilter === "connected") return a.connected === true;
      if (protoStatusFilter === "disconnected") return a.connected !== true;
      if (protoStatusFilter === "process_running") return isProcessRunning(a);
      if (protoStatusFilter === "external") return isExternalProtocolAccount(a);
      return true;
    });
  }, [protocolAccountsSorted, protoSearchQ, protoStatusFilter, instances]);

  const pagedProtocolAccounts = useMemo(
    () => slicePage(filteredProtocolAccounts, protoAccPage, prefs.tablePageSize),
    [filteredProtocolAccounts, protoAccPage, prefs.tablePageSize],
  );

  const pagedProtocolIds = useMemo(
    () =>
      pagedProtocolAccounts
        .map((a) => accountProtocolId(a))
        .filter((id): id is string => Boolean(id)),
    [pagedProtocolAccounts],
  );

  const protoCardsPageAllSelected = useMemo(
    () => pagedProtocolIds.length > 0 && pagedProtocolIds.every((id) => selected.has(id)),
    [pagedProtocolIds, selected],
  );

  const hasManagedProtocolAccounts = useMemo(
    () => protocolAccountsSorted.some((a) => isPluginManagedProtocolAccount(a)),
    [protocolAccountsSorted],
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

  const selectedManagedIds = useMemo(
    () =>
      [...selected].filter((id) => {
        const a = accountById.get(id);
        return a != null && isPluginManagedProtocolAccount(a);
      }),
    [selected, accountById],
  );

  const selectedExternalIds = useMemo(
    () =>
      [...selected].filter((id) => {
        const a = accountById.get(id);
        return a != null && isExternalProtocolAccount(a);
      }),
    [selected, accountById],
  );

  const deleteModalItems = useMemo(
    () =>
      [...selected]
        .sort()
        .map((id) => {
          const a = accountById.get(id);
          const title = a ? primaryTitle(a, instances) : id;
          const qq = a?.qq ?? a?.id ?? id;
          const tag = a && isExternalProtocolAccount(a) ? "外置" : "托管";
          return { key: id, label: `${title} · ${qq}（${tag}）` };
        }),
    [selected, accountById, instances],
  );

  const deleteModalWarnings = useMemo(() => {
    const running: string[] = [];
    const connectedManaged: string[] = [];
    for (const id of [...selectedManagedIds].sort()) {
      const a = accountById.get(id);
      if (!a) continue;
      if (isProcessRunning(a)) running.push(id);
      if (a.connected === true) connectedManaged.push(id);
    }
    const out: string[] = [];
    if (running.length) {
      out.push(`以下托管账号进程仍在运行：${running.join("、")}。删除前将尝试停止，请确认。`);
    }
    if (connectedManaged.length) {
      out.push(
        `以下托管账号当前仍在线：${connectedManaged.join("、")}。删除后可能导致运行异常，请确认。`,
      );
    }
    if (selectedExternalIds.length) {
      out.push(
        `外置连接 ${selectedExternalIds.length} 个将只断开本机 OneBot WS，不会停止外置协议端进程。`,
      );
    }
    return out;
  }, [selectedManagedIds, selectedExternalIds, accountById]);

  useEffect(() => {
    setProtoAccPage(1);
  }, [protoSearchQ, protoStatusFilter, prefs.tablePageSize]);

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

  const refreshLists = useCallback(async () => {
    setListRefreshBusy(true);
    try {
      await Promise.all([
        qc.refetchQueries({ queryKey: ["protocol-accounts", mountUrl] }),
        qc.refetchQueries({ queryKey: ["protocol-snowluma-runtimes", mountUrl] }),
        reload(),
      ]);
    } finally {
      setListRefreshBusy(false);
    }
  }, [mountUrl, qc, reload]);

  /** 单账号启停后静默拉列表，避免 listRefreshBusy 骨架整页闪白 */
  const refreshAccountsQuiet = useCallback(async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ["protocol-accounts", mountUrl] }),
      qc.refetchQueries({ queryKey: ["protocol-snowluma-runtimes", mountUrl] }),
    ]);
  }, [mountUrl, qc]);

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
    return (
      isAccountActionBusy(a, "power") ||
      isAccountActionBusy(a, "restart") ||
      isAccountActionBusy(a, "disconnect")
    );
  }

  function webUiHref(a: NapcatAccountRow): string | null {
    return accountWebUiHref(a, system as SystemData | null);
  }

  async function runBatch(body: {
    action: "restart" | "start" | "stop";
    account_ids: string[];
  }): Promise<ProtocolBatchJobPayload | null> {
    if (!mountUrl) {
      pushConsoleToast("协议端未启用", "warn");
      return null;
    }
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
      await refreshAccountsQuiet();
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
      await refreshAccountsQuiet();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "重启失败"), "err");
    } finally {
      setAccountActionBusy(id, "restart", false);
    }
  }

  async function disconnectExternalWs(a: NapcatAccountRow) {
    const id = accountProtocolId(a);
    const qq = protocolAccountNumber(a);
    if (!id || qq == null || isAnyAccountActionBusy(a)) return;
    if (a.connected !== true) {
      pushConsoleToast("当前未连接", "warn");
      return;
    }
    const title = primaryTitle(a, instances);
    const ok = await confirm({
      title: "断开连接",
      subtitle: `将关闭 Bot 对本机账号 ${title}（${qq}）的 OneBot WS。外置协议端进程不会被停止，可自行重连。`,
      confirmLabel: "断开",
      confirmVariant: "destructive",
    });
    if (!ok) return;
    setAccountActionBusy(id, "disconnect", true);
    try {
      await disconnectBotWs(qq);
      pushConsoleToast(`已断开 ${title}`, "warn");
      await reload();
      await qc.invalidateQueries({ queryKey: ["instances"] });
    } catch (e) {
      pushConsoleToast(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setAccountActionBusy(id, "disconnect", false);
    }
  }

  async function restartSelectedAccounts() {
    const ids = [...selectedManagedIds].sort();
    if (!ids.length) {
      pushConsoleToast(
        selectedExternalIds.length
          ? "所选均为外置连接，无法重启；请选择托管账号"
          : "请先选择要重启的账号",
        "warn",
      );
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
    const ids = [...selectedManagedIds].sort();
    if (!ids.length) {
      pushConsoleToast(
        selectedExternalIds.length
          ? "所选均为外置连接，无法停止；请选择托管账号"
          : "请先选择要停止的账号",
        "warn",
      );
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
      .filter((a) => isPluginManagedProtocolAccount(a))
      .map((a) => accountProtocolId(a))
      .filter((id): id is string => Boolean(id));
    if (!mountUrl || !ids.length) {
      pushConsoleToast("当前没有可重启的托管账号", "warn");
      return;
    }
    if (restartAllBusy) return;
    const ok = await confirm({
      title: "重启全部账号",
      subtitle: `将按间隔依次重启全部 ${ids.length} 个账号，以降低系统负载。`,
      confirmVariant: "default",
      confirmLabel: "确认重启",
    });
    if (!ok) return;
    setRestartAllBusy(true);
    try {
      const job = await runBatch({ action: "restart", account_ids: ids });
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
    if (selectedManagedIds.length === 0) {
      pushConsoleToast(
        selected.size > 0 ? "所选不含可启停的托管账号" : "请先选择账号",
        "warn",
      );
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
    const managedIds = [...selectedManagedIds].sort();
    const externalIds = [...selectedExternalIds].sort();
    if (!managedIds.length && !externalIds.length) return;
    if (managedIds.length && !mountUrl) {
      setDeleteErr("协议 API 未挂载，无法删除托管账号");
      return;
    }
    setDeleteBusy(true);
    setDeleteErr("");
    try {
      let deleted = 0;
      let disconnected = 0;
      for (const id of managedIds) {
        await protocolDeleteAccount(mountUrl!, id);
        deleted += 1;
      }
      for (const id of externalIds) {
        const a = accountById.get(id);
        const qq = a ? protocolAccountNumber(a) : null;
        if (qq == null) continue;
        try {
          await disconnectBotWs(qq);
          disconnected += 1;
        } catch (e) {
          throw e instanceof Error ? e : new Error(String(e));
        }
      }
      const parts: string[] = [];
      if (deleted) parts.push(`删除托管 ${deleted}`);
      if (disconnected) parts.push(`断开外置 ${disconnected}`);
      pushConsoleToast(parts.join("，") || "已处理", "warn");
      setSelected(new Set());
      setDeleteModalOpen(false);
      if (configAccountId && managedIds.includes(configAccountId)) setConfigAccountId(null);
      await refreshLists();
      await qc.invalidateQueries({ queryKey: ["instances"] });
    } catch (e) {
      setDeleteErr(
        e instanceof Error && !mountUrl
          ? e.message
          : protocolApiErrorMessage(e, managedIds.length ? "删除失败" : "断开失败"),
      );
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

  function toggleSelectedId(id: string) {
    setSelectedId(id, !selected.has(id));
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
  }, [refreshLists]);

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
            className={CHROME_SEARCH_INPUT}
            placeholder="搜索账号…"
            aria-label="搜索账号"
            autoComplete="off"
            value={protoSearchQ}
            onChange={(e) => setProtoSearchQ(e.target.value)}
          />
        </div>
        <ChromeStatusFilter
          value={protoStatusFilter}
          onValueChange={setProtoStatusFilter}
          options={PROTO_STATUS_FILTER_OPTIONS}
        />
        {protoActionsEnabled || protocolAccountsTotalCount > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1"
                disabled={
                  restartAllBusy ||
                  restartSelectedBusy ||
                  stopSelectedBusy ||
                  deleteBusy ||
                  batchBusy ||
                  actionBusy.size > 0
                }
                aria-label="选项"
              >
                {restartAllBusy || restartSelectedBusy || stopSelectedBusy
                  ? "处理中…"
                  : `选项${selected.size > 0 ? `（${selected.size}）` : ""}`}
                <ChevronDown className="size-3.5 opacity-70" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-0 w-max">
              {protoActionsEnabled ? (
                <>
                  <DropdownMenuItem
                    disabled={
                      restartAllBusy ||
                      batchBusy ||
                      actionBusy.size > 0 ||
                      !hasManagedProtocolAccounts
                    }
                    onSelect={() => void restartAllAccounts()}
                  >
                    {restartAllBusy ? "重启全部中…" : "重启全部"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
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
              {protoActionsEnabled ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={selectedManagedIds.length === 0 || restartSelectedBusy || batchBusy}
                    onSelect={() => openSelectedBatchConfirm("restart")}
                  >
                    重启所选
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={selectedManagedIds.length === 0 || stopSelectedBusy || batchBusy}
                    onSelect={() => openSelectedBatchConfirm("stop")}
                  >
                    停止所选
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                disabled={selected.size === 0 || deleteBusy}
                onSelect={() => openDeleteModal()}
              >
                {selectedExternalIds.length && !selectedManagedIds.length
                  ? "断开选中"
                  : selectedExternalIds.length
                    ? "删除/断开选中"
                    : "删除选中"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </>
    ),
    [
      protoSearchQ,
      protoStatusFilter,
      protoActionsEnabled,
      restartAllBusy,
      restartSelectedBusy,
      stopSelectedBusy,
      deleteBusy,
      batchBusy,
      protocolAccountsTotalCount,
      hasManagedProtocolAccounts,
      selected.size,
      selectedManagedIds.length,
      selectedExternalIds.length,
      actionBusy.size,
      pagedProtocolIds.length,
      protoCardsPageAllSelected,
    ],
  );

  useRegisterProtocolChrome(
    useMemo(
      () => ({ middle: chromeMiddle, onRefresh: chromeRefresh, refreshing: listRefreshBusy }),
      [chromeMiddle, chromeRefresh, listRefreshBusy],
    ),
  );

  const batchPhase = batchBusy
    ? protocolBatchPhaseLabel(batchJob) || "批量任务进行中…"
    : protocolBatchPhaseLabel(batchJob);

  return (
    <div className="protocol-accounts-tab">
      {!mountUrl && !hasOnlineBots ? (
        <p className="muted text-sm">协议 API 未挂载，且当前无在线连接。</p>
      ) : null}

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
              当前已连接{" "}
              <strong className="inst-db-stat__num">
                {showAccountsLoading ? <PendingValue pending /> : protocolConnectedCount}
              </strong>{" "}
              / {showAccountsLoading ? <PendingValue pending /> : protocolAccountsTotalCount} 账号
            </span>
          </div>
        </CardHeader>

        {expProtocolAccounts ? (
          <CardContent className={PROTO_PANEL_BD}>
            {showAccountsLoading ? (
              <p className="muted text-sm" role="status" aria-busy="true">
                账号列表加载中…
              </p>
            ) : null}
            {!showAccountsLoading && accountsQ.error ? (
              <p className="alert alert--err">{protocolApiErrorMessage(accountsQ.error, "加载失败")}</p>
            ) : null}

            {!showAccountsLoading && !filteredProtocolAccounts.length ? (
              <p className="muted">
                {protocolAccountsSorted.length
                  ? "没有匹配的协议账号，试试调整搜索或筛选。"
                  : "没有匹配的协议账号"}
              </p>
            ) : null}

            {!showAccountsLoading && filteredProtocolAccounts.length > 0 ? (
              <div className="data-card-grid data-card-grid--bots">
                {pagedProtocolAccounts.map((a, i) => {
                  const id = accountProtocolId(a);
                  const favNum = protocolAccountNumber(a);
                  const href = webUiHref(a);
                  const external = isExternalProtocolAccount(a);
                  const managed = isPluginManagedProtocolAccount(a);
                  const canSelect = Boolean(id);
                  const isSelected = Boolean(id && selected.has(id));
                  return (
                    <div
                      key={cardKey(a, i)}
                      className={cn(
                        "data-summary-card data-summary-card--kv data-summary-card--bot",
                        canSelect && "data-summary-card--selectable",
                        isSelected && "data-summary-card--selected",
                      )}
                      role={canSelect ? "button" : undefined}
                      tabIndex={canSelect ? 0 : undefined}
                      aria-pressed={canSelect ? isSelected : undefined}
                      aria-label={
                        canSelect
                          ? `${isSelected ? "取消选择" : "选择"}账号 ${id}`
                          : undefined
                      }
                      onClick={
                        canSelect && id
                          ? () => toggleSelectedId(id)
                          : undefined
                      }
                      onKeyDown={
                        canSelect && id
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleSelectedId(id);
                              }
                            }
                          : undefined
                      }
                    >
                      <div className="data-summary-card__head data-summary-card__head--bot">
                        <AccountAvatar qq={favNum} />
                        <div className="data-summary-card__head-main">
                          <div className="data-summary-card__title-line">
                            <div className="data-summary-card__primary">
                              {managed && id ? (
                                <button
                                  type="button"
                                  className="data-summary-card__title-link"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAccountConfig(id);
                                  }}
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(favNum);
                                }}
                              >
                                ★
                              </button>
                            ) : null}
                          </div>
                          <div className="data-summary-card__secondary muted">{a.qq ?? a.id ?? "—"}</div>
                        </div>
                        <div className="data-summary-card__head-badges">
                          <StatusTone
                            className="data-conn-capsule"
                            ok={a.connected === true}
                            pendingLabel="探测中"
                            okLabel="已连接"
                            offLabel="未连接"
                          />
                          {managed ? (
                            <StatusTone
                              className={
                                isProcessRunning(a)
                                  ? "data-conn-capsule data-conn-capsule--run"
                                  : "data-conn-capsule"
                              }
                              ok={isProcessRunning(a)}
                              pendingLabel="探测中"
                              okLabel="运行中"
                              offLabel="未运行"
                            />
                          ) : null}
                        </div>
                      </div>
                      {managed ? (
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
                            <span className="data-summary-card__label">原生 WebUI</span>
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
                            <span className="data-summary-card__val">{accountConnectedWsPortLabel(a)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="data-summary-card__body">
                          <div className="data-summary-card__row">
                            <span className="data-summary-card__label">协议</span>
                            <span className="data-summary-card__val">{protocolBackendDisplayName(a)}</span>
                          </div>
                          <div className="data-summary-card__row">
                            <span className="data-summary-card__label">WS 端口</span>
                            <span className="data-summary-card__val">{accountConnectedWsPortLabel(a)}</span>
                          </div>
                        </div>
                      )}
                      {external ? (
                        <div
                          className="data-summary-card__tags data-summary-card__foot inst-card-actions protocol-acc-card-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn btn--sm gap-1"
                            disabled={
                              a.connected !== true ||
                              isAccountActionBusy(a, "disconnect") ||
                              protocolAccountNumber(a) == null
                            }
                            title={a.connected === true ? "断开本机 OneBot WS" : "当前未连接"}
                            aria-label="断开连接"
                            onClick={() => void disconnectExternalWs(a)}
                          >
                            {isAccountActionBusy(a, "disconnect") ? (
                              <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                            ) : (
                              <Unplug className="size-3.5 shrink-0" aria-hidden />
                            )}
                            {isAccountActionBusy(a, "disconnect") ? "断开中…" : "断开连接"}
                          </button>
                        </div>
                      ) : null}
                      {managed && protoActionsEnabled ? (
                        <div
                          className="data-summary-card__tags data-summary-card__foot inst-card-actions protocol-acc-card-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className={`btn btn--sm gap-1${again.isArmed(`restart:${id}`) ? " btn--primary" : ""}`}
                            disabled={isAnyAccountActionBusy(a)}
                            title={again.label(
                              `restart:${id}`,
                              restartLabel(isAccountActionBusy(a, "restart")),
                            )}
                            aria-label={again.label(
                              `restart:${id}`,
                              restartLabel(isAccountActionBusy(a, "restart")),
                            )}
                            onClick={() =>
                              again.run(`restart:${id}`, () => void restartAccount(a))
                            }
                          >
                            {again.isArmed(`restart:${id}`)
                              ? "再点一次确认"
                              : restartContent(isAccountActionBusy(a, "restart"))}
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm gap-1"
                            disabled={!mountUrl || !id}
                            title="二维码"
                            aria-label="二维码"
                            onClick={() => openQrcodeModal(a)}
                          >
                            <QrCode className="size-3.5 shrink-0" aria-hidden />
                            二维码
                          </button>
                          <button
                            type="button"
                            className={`btn btn--sm gap-1${
                              again.isArmed(`stop:${id}`)
                                ? " btn--primary"
                                : isProcessRunning(a)
                                  ? ""
                                  : " btn--primary"
                            }`}
                            disabled={isAnyAccountActionBusy(a)}
                            title={
                              isProcessRunning(a)
                                ? again.label(
                                    `stop:${id}`,
                                    togglePowerLabel(a, isAccountActionBusy(a, "power")),
                                  )
                                : togglePowerLabel(a, isAccountActionBusy(a, "power"))
                            }
                            aria-label={
                              isProcessRunning(a)
                                ? again.label(
                                    `stop:${id}`,
                                    togglePowerLabel(a, isAccountActionBusy(a, "power")),
                                  )
                                : togglePowerLabel(a, isAccountActionBusy(a, "power"))
                            }
                            onClick={() => {
                              if (isProcessRunning(a)) {
                                again.run(`stop:${id}`, () => void toggleAccountPower(a));
                                return;
                              }
                              void toggleAccountPower(a);
                            }}
                          >
                            {isProcessRunning(a) && again.isArmed(`stop:${id}`)
                              ? "再点一次确认"
                              : togglePowerContent(a, isAccountActionBusy(a, "power"))}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {!showAccountsLoading && filteredProtocolAccounts.length > 0 ? (
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
        title={
          selectedExternalIds.length && !selectedManagedIds.length
            ? "断开外置连接"
            : selectedExternalIds.length
              ? "删除托管并断开外置"
              : "删除账号"
        }
        subtitle={
          selectedExternalIds.length && !selectedManagedIds.length
            ? `将断开以下外置连接（共 ${selectedExternalIds.length} 个）的本机 OneBot WS；外置协议端进程不会被停止。`
            : selectedExternalIds.length
              ? `将删除托管账号并断开外置连接（共 ${selected.size} 个）。托管账号数据目录是否保留取决于主仓配置；外置仅断 WS。`
              : `将删除以下托管账号（共 ${selectedManagedIds.length} 个），协议端账号将被移除，数据目录是否保留取决于主仓配置，操作不可撤销。`
        }
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
            ? `将按间隔依次停止 ${selectedManagedIds.length} 个托管账号。请确认后再继续。`
            : `将按间隔依次重启 ${selectedManagedIds.length} 个托管账号，以降低系统负载。请确认后再继续。`
        }
        items={deleteModalItems.filter((it) => selectedManagedIds.includes(it.key))}
        busy={restartSelectedBusy || stopSelectedBusy || batchBusy}
        confirmVariant="default"
        confirmLabel={selectedBatchKind === "stop" ? "确认停止" : "确认重启"}
        busyLabel={selectedBatchKind === "stop" ? "停止中…" : "重启中…"}
        titleId="proto-selected-batch-modal-title"
        onClose={closeSelectedBatchConfirm}
        onConfirm={() => void confirmSelectedBatch()}
      />
      {confirmDialog}
    </div>
  );
}
