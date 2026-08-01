import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  installCommunityPluginAsync,
  installOfficialExtensionAsync,
  openPluginInstallJobEventSource,
  uninstallCommunityPluginAsync,
  uninstallOfficialExtensionAsync,
  updateCommunityPluginAsync,
  updateOfficialExtensionAsync,
} from "@/api/console";
import {
  fetchCommunityPluginStore,
  fetchOfficialExtensions,
  fetchPluginStoreJobActive,
  fetchPlugins,
  fetchPluginStoreChangelog,
  fetchPluginStoreReadme,
  refreshPluginStore,
  refreshPluginUpdateSnapshot,
} from "@/api/fullConsole";
import NoticeDot from "@/components/NoticeDot";
import {
  countNewPluginStoreIds,
  ensurePluginStoreSeenBaseline,
  markPluginStoreIdsSeen,
} from "@/utils/pluginStoreNotice";
import type {
  CommunityPluginActionResult,
  CommunityPluginRow,
  CommunityPluginStoreData,
  OfficialExtensionInstallResult,
  OfficialExtensionRow,
  PluginRow,
} from "@/api/pallasTypes";
import { copyTextToClipboard } from "@/utils/clipboard";
import { readmeMarkdownToSafeHtml } from "@/utils/pluginReadme";
import {
  formatPluginStoreActiveHint,
  formatPluginStoreBatchCompleteHint,
  formatPluginStoreEnqueuedHint,
  isPluginStoreTaskQueued,
  pluginStoreQueuePendingAfterActive,
  type PluginStoreQueueAction,
  type PluginStoreQueueKind,
} from "@/utils/pluginStoreActionQueue";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, { CHROME_SEARCH_INPUT, CHROME_SELECT_TRIGGER } from "@/components/ChromeTools";
import GitMirrorDialog from "@/components/GitMirrorDialog";
import PageMasthead from "@/components/PageMasthead";
import { cn } from "@/lib/utils";
import PluginStoreCard, { type PluginStoreMenuItem } from "@/components/PluginStoreCard";
import PluginStoreCardSkeleton from "@/components/PluginStoreCardSkeleton";
import ReadmeMarkdown from "@/components/ReadmeMarkdown";
import RefreshIconButton from "@/components/RefreshIconButton";
import { BadgeCheck, Filter, FolderOpen, Package, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBotSystemRestart } from "@/hooks/useBotSystemRestart";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";
import { waitForPluginStoreJob } from "@/utils/pluginStoreJobStream";
import { InstallJobFailedError, InstallJobStreamInterruptedError } from "@/utils/installJobStream";
import { getActiveJob } from "@/utils/activeJobSession";
import {
  COMMUNITY_INDEX_REPO_URL,
  PLUGIN_ID_PATTERN,
  StoreSection,
  StoreTab,
  communityActivationHint,
  communityInstalled,
  communityInstalledVersionLabel,
  communityRowAvatarUrl,
  communityRowIconUrl,
  communityUpdateEnabled,
  updateLatestLabel,
  communityUpdateLabel,
  extensionInstalled,
  localCommunityMatch,
  localPluginAuthor,
  localPluginAvatarUrl,
  localPluginDescription,
  localPluginIconUrl,
  localPluginRepoUrl,
  localPluginTitle,
  officialActivationHint,
  officialInstalledVersionLabel,
  officialRowDescription,
  officialRowIconUrl,
  officialRowPluginId,
  officialRowTitle,
  officialUpdateEnabled,
  officialUpdateLabel,
  resolveCommunityIndexSourceDisplay,
  resultNeedsRestart,
} from "@/utils/pluginStorePageHelpers";

type DetailTab = "readme" | "changelog";
type DetailKind = "official" | "community";

type StoreDetail = {
  kind: DetailKind;
  id: string;
  title: string;
  subtitle: string;
  description: string;
  repositoryUrl: string | null;
  official?: OfficialExtensionRow;
  community?: CommunityPluginRow;
};

type OfficialQueueEntry = {
  kind: "official";
  action: PluginStoreQueueAction;
  restart: boolean;
  row: OfficialExtensionRow;
};

type CommunityQueueEntry = {
  kind: "community";
  action: PluginStoreQueueAction;
  restart: boolean;
  row: CommunityPluginRow;
};

type InstallUpdateQueueEntry = OfficialQueueEntry | CommunityQueueEntry;

const sectionOptions: { value: StoreSection; label: string }[] = [
  { value: "official", label: "官方插件" },
  { value: "community", label: "社区插件" },
  { value: "local", label: "本地插件" },
];

const tabOptions: { value: StoreTab; label: string }[] = [
  { value: "all", label: "全部插件" },
  { value: "installed", label: "已安装" },
  { value: "available", label: "可安装" },
  { value: "updates", label: "可更新" },
];

function queueTaskDescriptor(entry: InstallUpdateQueueEntry): {
  kind: PluginStoreQueueKind;
  key: string;
  action: PluginStoreQueueAction;
} {
  if (entry.kind === "official") {
    return { kind: "official", key: entry.row.package, action: entry.action };
  }
  return { kind: "community", key: entry.row.plugin_id, action: entry.action };
}

function queueEntryLabel(entry: InstallUpdateQueueEntry): string {
  if (entry.kind === "official") return officialRowTitle(entry.row);
  return (entry.row.name || entry.row.plugin_id).trim();
}

export default function PluginStorePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pageReady, setPageReady] = useState(false);
  const [seenTick, setSeenTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [storeSection, setStoreSection] = useState<StoreSection>("official");
  const [rows, setRows] = useState<OfficialExtensionRow[]>([]);
  const [communityStore, setCommunityStore] = useState<CommunityPluginStoreData | null>(null);
  const [localPlugins, setLocalPlugins] = useState<PluginRow[]>([]);
  const [storeErr, setStoreErr] = useState("");
  const [storeCopyHint, setStoreCopyHint] = useState("");
  const [storeActionHint, setStoreActionHint] = useState("");
  const [storeActionNeedsRestart, setStoreActionNeedsRestart] = useState(false);
  const [storeBusyPackage, setStoreBusyPackage] = useState("");
  const [storeBusyPluginId, setStoreBusyPluginId] = useState("");
  const [storeBusyOfficialAction, setStoreBusyOfficialAction] = useState<"" | "install" | "update" | "uninstall">("");
  const [storeBusyCommunityAction, setStoreBusyCommunityAction] = useState<"" | "install" | "update" | "uninstall">("");
  const [installUpdateQueue, setInstallUpdateQueue] = useState<InstallUpdateQueueEntry[]>([]);
  const [installUpdateQueueRunning, setInstallUpdateQueueRunning] = useState(false);
  const installUpdateQueueRef = useRef<InstallUpdateQueueEntry[]>([]);
  const installUpdateQueueRunningRef = useRef(false);
  const installUpdateQueueDeferredRestartRef = useRef(false);

  const syncInstallUpdateQueue = useCallback((next: InstallUpdateQueueEntry[]) => {
    installUpdateQueueRef.current = next;
    setInstallUpdateQueue(next);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<StoreTab>("all");
  const [officialActionState, setOfficialActionState] = useState<Record<string, OfficialExtensionInstallResult>>({});
  const [communityActionState, setCommunityActionState] = useState<Record<string, CommunityPluginActionResult>>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<StoreDetail | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("readme");
  const [detailReadmeHtml, setDetailReadmeHtml] = useState("");
  const [detailReadmeLoading, setDetailReadmeLoading] = useState(false);
  const [detailReadmeErr, setDetailReadmeErr] = useState("");
  const [detailChangelogHtml, setDetailChangelogHtml] = useState("");
  const [detailChangelogLoading, setDetailChangelogLoading] = useState(false);
  const [detailChangelogErr, setDetailChangelogErr] = useState("");
  const [detailChangelogSource, setDetailChangelogSource] = useState<"changelog" | "git" | "">("");
  const [detailChangelogLoaded, setDetailChangelogLoaded] = useState(false);
  const [gitInstallOpen, setGitInstallOpen] = useState(false);
  const [gitMirrorOpen, setGitMirrorOpen] = useState(false);
  const [gitPluginId, setGitPluginId] = useState("");
  const [gitRepositoryUrl, setGitRepositoryUrl] = useState("");
  const [gitRef, setGitRef] = useState("main");
  const [gitInstallBusy, setGitInstallBusy] = useState(false);
  const [cardProgress, setCardProgress] = useState<{ key: string; percent: number; message: string } | null>(null);

  const {
    restartBusy,
    restartErr,
    restartProgressLabel,
    restartInProgress,
    restartAvailable: systemRestartAvailable,
    shardedRuntime,
    ensureRestartContext,
    restartBot,
    restartConfirmDialog,
    trackRestartFromPluginResult,
  } = useBotSystemRestart();
  const { confirm, confirmDialog } = useConsoleConfirm();

  const webuiInstallEnabled = rows.some((row) => row.webui_install);
  const communityRows = communityStore?.plugins ?? [];
  const communityRestartAvailable = Boolean(communityStore?.restart_available);
  const communityExtraDirsReady = communityStore?.extra_plugin_dirs_ready !== false;
  const communityIndexError = (communityStore?.error || "").trim();
  const communityIndexSourceDisplay = resolveCommunityIndexSourceDisplay((communityStore?.source || "").trim());
  const communityWebuiInstallEnabled = communityStore?.webui_install !== false;
  const gitInstallValid = Boolean(
    gitPluginId.trim() && PLUGIN_ID_PATTERN.test(gitPluginId.trim()) && gitRepositoryUrl.trim(),
  );
  const communityIndexUpdatedAt = useMemo(() => {
    const meta = communityStore?.meta;
    if (!meta || typeof meta !== "object") return "";
    const raw = (meta as { updated_at?: unknown }).updated_at;
    return raw != null ? String(raw).trim() : "";
  }, [communityStore?.meta]);

  const applyCardProgress = useCallback((key: string) => {
    return (progress: { percent: number; message: string }) => {
      setCardProgress({
        key,
        percent: progress.percent,
        message: progress.message,
      });
    };
  }, []);

  const communityRowById = useMemo(() => {
    const map = new Map<string, CommunityPluginRow>();
    for (const row of communityRows) {
      const id = (row.plugin_id || "").trim();
      if (id) map.set(id, row);
    }
    return map;
  }, [communityRows]);

  const localRows = useMemo(
    () => localPlugins.filter((p) => p.plugin_source === "local"),
    [localPlugins],
  );

  const catalogIds = useMemo(
    () => [
      ...communityRows.map((p) => `community:${p.plugin_id}`),
      ...rows.map((p) => `official:${String(p.package || "").trim()}`).filter((x) => x !== "official:"),
    ],
    [communityRows, rows],
  );

  const storeNoticeFlags = useMemo(() => {
    void seenTick;
    const seen = ensurePluginStoreSeenBaseline(catalogIds);
    const newCount = countNewPluginStoreIds(catalogIds, seen);
    const officialUpdates = rows.filter((r) => r.has_update === true).length;
    const communityUpdates = communityRows.filter((r) => r.has_update === true).length;
    const officialNew = countNewPluginStoreIds(
      rows.map((p) => `official:${String(p.package || "").trim()}`).filter((x) => x !== "official:"),
      seen,
    );
    const communityNew = countNewPluginStoreIds(
      communityRows.map((p) => `community:${p.plugin_id}`),
      seen,
    );
    return {
      newCount,
      updateCount: officialUpdates + communityUpdates,
      officialUpdates,
      communityUpdates,
      officialNew,
      communityNew,
      updatesTabNotice: officialUpdates + communityUpdates > 0,
    };
  }, [catalogIds, rows, communityRows, seenTick]);

  useEffect(() => {
    if (!pageReady || !catalogIds.length) return;
    markPluginStoreIdsSeen(catalogIds);
    setSeenTick((n) => n + 1);
    void qc.invalidateQueries({ queryKey: ["plugins-community-store", "nav-notice"] });
    void qc.invalidateQueries({ queryKey: ["plugins-official-extensions", "nav-notice"] });
  }, [pageReady, catalogIds, qc]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = rows;
    if (activeTab === "installed") list = list.filter((row) => extensionInstalled(row) || row.bundled_in_repo);
    else if (activeTab === "available") list = list.filter((row) => row.can_install);
    else if (activeTab === "updates") list = list.filter((row) => row.has_update === true);
    if (!q) return list;
    return list.filter((row) => {
      const title = officialRowTitle(row).toLowerCase();
      const pkg = row.package.toLowerCase();
      const ids = (row.plugin_ids || []).join(" ").toLowerCase();
      const desc = officialRowDescription(row).toLowerCase();
      return title.includes(q) || pkg.includes(q) || ids.includes(q) || desc.includes(q);
    });
  }, [rows, searchQuery, activeTab]);

  const filteredCommunityRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = communityRows;
    if (activeTab === "installed") list = list.filter((row) => communityInstalled(row));
    else if (activeTab === "available") list = list.filter((row) => row.can_install);
    else if (activeTab === "updates") list = list.filter((row) => row.has_update === true);
    if (!q) return list;
    return list.filter((row) => {
      const id = row.plugin_id.toLowerCase();
      const name = (row.name || "").toLowerCase();
      const desc = (row.description || "").toLowerCase();
      const tags = (row.tags || []).join(" ").toLowerCase();
      return id.includes(q) || name.includes(q) || desc.includes(q) || tags.includes(q);
    });
  }, [communityRows, searchQuery, activeTab]);

  const filteredLocalRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = localRows;
    if (activeTab === "available" || activeTab === "updates") return [];
    if (!q) return list;
    return list.filter((row) => {
      const name = (row.metadata?.name || row.name).toLowerCase();
      const id = row.name.toLowerCase();
      const desc = (row.metadata?.description || "").toLowerCase();
      return name.includes(q) || id.includes(q) || desc.includes(q);
    });
  }, [localRows, searchQuery, activeTab]);

  const resultCount =
    storeSection === "official"
      ? filteredRows.length
      : storeSection === "community"
        ? filteredCommunityRows.length
        : filteredLocalRows.length;

  const emptyHint = useMemo(() => {
    if (storeSection === "official") {
      if (searchQuery.trim()) return "试试更短的关键词，或切换「全部」筛选。";
      if (activeTab === "installed") return "已安装的官方插件会出现在这里。";
      if (activeTab === "available") return "当前没有可一键安装的官方插件。";
      return "官方插件列表为空。";
    }
    if (storeSection === "community") {
      if (searchQuery.trim()) return "换个关键词，或切到「全部」。";
      if (activeTab === "installed") return "已安装到本地的插件会出现在这里。";
      if (activeTab === "available") return "当前没有可安装的插件。";
      return "列表为空，请稍后再试。";
    }
    if (searchQuery.trim()) return "换个关键词试试。";
    if (!localRows.length) return "暂无本地插件，可将插件放入 local/plugins/ 目录。";
    return "";
  }, [storeSection, searchQuery, activeTab, localRows.length]);

  const noteStoreActionResult = useCallback(
    async (
      message: string,
      result: { needs_restart?: boolean; restart_scheduled?: boolean; activation_action?: string | null } | null,
      queuePending = 0,
    ) => {
      await ensureRestartContext();
      const needsRestart = Boolean(systemRestartAvailable && result && resultNeedsRestart(result));
      if (result?.restart_scheduled) {
        setStoreActionHint(message);
        setStoreActionNeedsRestart(false);
        const ok = await trackRestartFromPluginResult(result);
        if (ok) setStoreActionHint("Bot 已恢复在线。");
        return;
      }
      // Active task stays in the queue until finished; only defer when others remain.
      if (queuePending > 0 || installUpdateQueueRef.current.length > 1) {
        installUpdateQueueDeferredRestartRef.current =
          installUpdateQueueDeferredRestartRef.current || needsRestart;
        return;
      }
      setStoreActionHint(message);
      setStoreActionNeedsRestart(needsRestart || installUpdateQueueDeferredRestartRef.current);
      installUpdateQueueDeferredRestartRef.current = false;
    },
    [ensureRestartContext, systemRestartAvailable, trackRestartFromPluginResult],
  );

  const refreshOfficialStore = useCallback(async () => {
    setRows(await fetchOfficialExtensions());
  }, []);

  const refreshCommunityStore = useCallback(async (force = false) => {
    setCommunityStore(await fetchCommunityPluginStore({ refresh: force }));
  }, []);

  const refreshLocalStore = useCallback(async () => {
    try {
      const [plugins] = await Promise.all([
        fetchPlugins(),
        communityStore ? Promise.resolve() : refreshCommunityStore().catch(() => {}),
      ]);
      setLocalPlugins(plugins);
    } catch {
      /* keep previous */
    }
  }, [communityStore, refreshCommunityStore]);

  const refreshStore = useCallback(
    async (force = false) => {
      setLoading(true);
      setStoreErr("");
      if (force) setStoreActionNeedsRestart(false);
      try {
        if (force && storeSection !== "local") {
          const out = await refreshPluginStore();
          if (storeSection === "official") await refreshOfficialStore();
          else await refreshCommunityStore(false);
          const n = (out.store_assets.community_count ?? 0) + (out.store_assets.official_count ?? 0);
          setStoreActionHint(n ? `已同步 ${n} 个插件的商店资源。` : "已完成插件商店刷新。");
        } else if (storeSection === "official") {
          await refreshOfficialStore();
        } else if (storeSection === "community") {
          await refreshCommunityStore(force);
        } else {
          await refreshLocalStore();
        }
      } catch (e) {
        setStoreErr(axiosErrorDetail(e));
      } finally {
        setLoading(false);
      }
    },
    [storeSection, refreshOfficialStore, refreshCommunityStore, refreshLocalStore],
  );

  const refreshUpdateSnapshotAfterUpdate = useCallback(async () => {
    try {
      await refreshPluginUpdateSnapshot();
      if (storeSection === "official") await refreshOfficialStore();
      else if (storeSection === "community") await refreshCommunityStore(true);
    } catch {
      /* ignore */
    }
  }, [storeSection, refreshOfficialStore, refreshCommunityStore]);

  const isOfficialInstallUpdateQueued = useCallback(
    (packageName: string, action: PluginStoreQueueAction) =>
      isPluginStoreTaskQueued(installUpdateQueue.map(queueTaskDescriptor), {
        kind: "official",
        key: packageName,
        action,
      }),
    [installUpdateQueue],
  );

  const isCommunityInstallUpdateQueued = useCallback(
    (pluginId: string, action: PluginStoreQueueAction) =>
      isPluginStoreTaskQueued(installUpdateQueue.map(queueTaskDescriptor), {
        kind: "community",
        key: pluginId,
        action,
      }),
    [installUpdateQueue],
  );

  const isInstallUpdatePipelineBusy = useCallback(
    () => {
      if (installUpdateQueueRunningRef.current || installUpdateQueueRunning) return true;
      if (gitInstallBusy) return true;
      const official = storeBusyOfficialAction;
      if (official === "install" || official === "update") return true;
      const community = storeBusyCommunityAction;
      return community === "install" || community === "update";
    },
    [installUpdateQueueRunning, gitInstallBusy, storeBusyOfficialAction, storeBusyCommunityAction],
  );

  const executeInstallExtension = useCallback(
    async (row: OfficialExtensionRow, restart: boolean, queuePending = 0) => {
      setStoreErr("");
      setStoreActionHint("");
      setStoreActionNeedsRestart(false);
      setStoreBusyPackage(row.package);
      setStoreBusyOfficialAction("install");
      setCardProgress({ key: row.package, percent: 0, message: formatPluginStoreActiveHint("install", officialRowTitle(row)) });
      let keepProgress = false;
      try {
        const job = await installOfficialExtensionAsync(row.package, { restart });
        const payload = await waitForPluginStoreJob(
          job.job_id,
          openPluginInstallJobEventSource,
          applyCardProgress(row.package),
          { kind: "official", target: row.package, action: "install" },
        );
        const result = payload.result as OfficialExtensionInstallResult | undefined;
        if (result) {
          setOfficialActionState((prev) => ({ ...prev, [row.package]: result }));
          await noteStoreActionResult(result.message || payload.message || "安装完成。", result, queuePending);
        } else {
          await noteStoreActionResult(payload.message || "安装完成。", null, queuePending);
        }
        await refreshOfficialStore();
      } catch (e) {
        if (e instanceof InstallJobStreamInterruptedError) {
          setStoreActionHint("操作仍在后台进行，返回本页可续看进度");
          keepProgress = true;
        } else {
          setStoreErr(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e));
        }
      } finally {
        if (!keepProgress) {
          setStoreBusyPackage("");
          setStoreBusyOfficialAction("");
          setCardProgress(null);
        }
      }
    },
    [applyCardProgress, noteStoreActionResult, refreshOfficialStore],
  );

  const executeUpdateExtension = useCallback(
    async (row: OfficialExtensionRow, restart: boolean, queuePending = 0) => {
      setStoreErr("");
      setStoreActionHint("");
      setStoreActionNeedsRestart(false);
      setStoreBusyPackage(row.package);
      setStoreBusyOfficialAction("update");
      setCardProgress({ key: row.package, percent: 0, message: formatPluginStoreActiveHint("update", officialRowTitle(row)) });
      let keepProgress = false;
      try {
        const job = await updateOfficialExtensionAsync(row.package, { restart });
        const payload = await waitForPluginStoreJob(
          job.job_id,
          openPluginInstallJobEventSource,
          applyCardProgress(row.package),
          { kind: "official", target: row.package, action: "update" },
        );
        const out = (payload.result ?? {}) as OfficialExtensionInstallResult;
        setOfficialActionState((prev) => ({ ...prev, [row.package]: out }));
        await noteStoreActionResult(out.message || payload.message || "更新完成。", out, queuePending);
        await refreshOfficialStore();
      } catch (e) {
        if (e instanceof InstallJobStreamInterruptedError) {
          setStoreActionHint("操作仍在后台进行，返回本页可续看进度");
          keepProgress = true;
        } else {
          setStoreErr(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e));
        }
      } finally {
        if (!keepProgress) {
          setStoreBusyPackage("");
          setStoreBusyOfficialAction("");
          setCardProgress(null);
        }
      }
    },
    [applyCardProgress, noteStoreActionResult, refreshOfficialStore],
  );

  const executeInstallCommunity = useCallback(
    async (row: CommunityPluginRow, restart: boolean, queuePending = 0) => {
      setStoreErr("");
      setStoreActionHint("");
      setStoreActionNeedsRestart(false);
      setStoreBusyPluginId(row.plugin_id);
      setStoreBusyCommunityAction("install");
      const label = (row.name || row.plugin_id).trim();
      setCardProgress({ key: row.plugin_id, percent: 0, message: formatPluginStoreActiveHint("install", label) });
      let keepProgress = false;
      try {
        const job = await installCommunityPluginAsync(row.plugin_id, {
          restart,
          repositoryUrl: row.repository_url || undefined,
          ref: row.ref,
        });
        const payload = await waitForPluginStoreJob(
          job.job_id,
          openPluginInstallJobEventSource,
          applyCardProgress(row.plugin_id),
          { kind: "community", target: row.plugin_id, action: "install" },
        );
        const out = (payload.result ?? {}) as CommunityPluginActionResult;
        setCommunityActionState((prev) => ({ ...prev, [row.plugin_id]: out }));
        await noteStoreActionResult(out.message || payload.message || "安装完成。", out, queuePending);
        await refreshCommunityStore();
      } catch (e) {
        if (e instanceof InstallJobStreamInterruptedError) {
          setStoreActionHint("操作仍在后台进行，返回本页可续看进度");
          keepProgress = true;
        } else {
          setStoreErr(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e));
        }
      } finally {
        if (!keepProgress) {
          setStoreBusyPluginId("");
          setStoreBusyCommunityAction("");
          setCardProgress(null);
        }
      }
    },
    [applyCardProgress, noteStoreActionResult, refreshCommunityStore],
  );

  const executeUpdateCommunity = useCallback(
    async (row: CommunityPluginRow, restart: boolean, queuePending = 0) => {
      setStoreErr("");
      setStoreActionHint("");
      setStoreActionNeedsRestart(false);
      setStoreBusyPluginId(row.plugin_id);
      setStoreBusyCommunityAction("update");
      const label = (row.name || row.plugin_id).trim();
      setCardProgress({ key: row.plugin_id, percent: 0, message: formatPluginStoreActiveHint("update", label) });
      let keepProgress = false;
      try {
        const job = await updateCommunityPluginAsync(row.plugin_id, { restart, ref: row.ref });
        const payload = await waitForPluginStoreJob(
          job.job_id,
          openPluginInstallJobEventSource,
          applyCardProgress(row.plugin_id),
          { kind: "community", target: row.plugin_id, action: "update" },
        );
        const out = (payload.result ?? {}) as CommunityPluginActionResult;
        setCommunityActionState((prev) => ({ ...prev, [row.plugin_id]: out }));
        await noteStoreActionResult(out.message || payload.message || "更新完成。", out, queuePending);
        await refreshCommunityStore();
      } catch (e) {
        if (e instanceof InstallJobStreamInterruptedError) {
          setStoreActionHint("操作仍在后台进行，返回本页可续看进度");
          keepProgress = true;
        } else {
          setStoreErr(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e));
        }
      } finally {
        if (!keepProgress) {
          setStoreBusyPluginId("");
          setStoreBusyCommunityAction("");
          setCardProgress(null);
        }
      }
    },
    [applyCardProgress, noteStoreActionResult, refreshCommunityStore],
  );

  const drainInstallUpdateQueue = useCallback(
    async () => {
      if (installUpdateQueueRunningRef.current) return;
      installUpdateQueueRunningRef.current = true;
      setInstallUpdateQueueRunning(true);
      installUpdateQueueDeferredRestartRef.current = false;
      let processedCount = 0;
      let batchHadUpdate = false;
      try {
        while (installUpdateQueueRef.current.length > 0) {
          const current = installUpdateQueueRef.current[0];
          const pendingAfter = pluginStoreQueuePendingAfterActive(installUpdateQueueRef.current.length);
          if (current.kind === "official") {
            if (current.action === "install") {
              await executeInstallExtension(current.row, current.restart, pendingAfter);
            } else {
              await executeUpdateExtension(current.row, current.restart, pendingAfter);
            }
          } else if (current.action === "install") {
            await executeInstallCommunity(current.row, current.restart, pendingAfter);
          } else {
            await executeUpdateCommunity(current.row, current.restart, pendingAfter);
          }
          if (current.action === "update") batchHadUpdate = true;
          processedCount += 1;
          // Drop the finished task; keep any tasks enqueued while this one ran.
          const done = queueTaskDescriptor(current);
          const beforeLen = installUpdateQueueRef.current.length;
          let removed = false;
          const rest = installUpdateQueueRef.current.filter((item) => {
            if (removed) return true;
            const d = queueTaskDescriptor(item);
            if (d.kind === done.kind && d.key === done.key && d.action === done.action) {
              removed = true;
              return false;
            }
            return true;
          });
          syncInstallUpdateQueue(removed && rest.length < beforeLen ? rest : installUpdateQueueRef.current.slice(1));
        }
        if (batchHadUpdate && !storeErr) {
          await refreshUpdateSnapshotAfterUpdate();
          if (!storeErr) {
            const base =
              processedCount > 1 ? `已完成 ${processedCount} 项安装/更新。` : "更新完成，已刷新版本状态。";
            setStoreActionHint((prev) =>
              storeActionNeedsRestart ? `${base}需重启 Bot 才能加载新版本。` : base || prev,
            );
          }
        } else {
          const batchHint = formatPluginStoreBatchCompleteHint(processedCount);
          if (batchHint && !storeErr) setStoreActionHint(batchHint);
        }
      } finally {
        installUpdateQueueRunningRef.current = false;
        setInstallUpdateQueueRunning(false);
        installUpdateQueueDeferredRestartRef.current = false;
      }
    },
    [
      executeInstallCommunity,
      executeInstallExtension,
      executeUpdateCommunity,
      executeUpdateExtension,
      refreshUpdateSnapshotAfterUpdate,
      storeActionNeedsRestart,
      storeErr,
      syncInstallUpdateQueue,
    ],
  );

  const enqueueInstallUpdate = useCallback(
    async (entry: InstallUpdateQueueEntry) => {
      const name = queueEntryLabel(entry);
      const isInstall = entry.action === "install";
      const ok = await confirm({
        title: entry.restart
          ? isInstall
            ? "安装并重启"
            : "更新并重启"
          : isInstall
            ? "安装插件"
            : "更新插件",
        subtitle: entry.restart
          ? `将${isInstall ? "安装" : "更新"}「${name}」并重启 Bot。`
          : `将${isInstall ? "安装" : "更新"}「${name}」。完成后可能需要重启 Bot 才能加载。`,
        confirmVariant: "default",
        confirmLabel: entry.restart
          ? isInstall
            ? "确认安装并重启"
            : "确认更新并重启"
          : isInstall
            ? "确认安装"
            : "确认更新",
      });
      if (!ok) return;
      const descriptor = queueTaskDescriptor(entry);
      const queued = isPluginStoreTaskQueued(installUpdateQueueRef.current.map(queueTaskDescriptor), descriptor);
      const active =
        entry.kind === "official"
          ? storeBusyPackage === entry.row.package && storeBusyOfficialAction === entry.action
          : storeBusyPluginId === entry.row.plugin_id && storeBusyCommunityAction === entry.action;
      if (queued || active) return;
      setStoreErr("");
      setStoreActionNeedsRestart(false);
      const wasRunning = installUpdateQueueRunningRef.current || isInstallUpdatePipelineBusy();
      const next = [...installUpdateQueueRef.current, entry];
      syncInstallUpdateQueue(next);
      if (wasRunning) {
        setStoreActionHint(
          formatPluginStoreEnqueuedHint(entry.action, queueEntryLabel(entry), next.length),
        );
        return;
      }
      void drainInstallUpdateQueue();
    },
    [
      confirm,
      drainInstallUpdateQueue,
      isInstallUpdatePipelineBusy,
      storeBusyCommunityAction,
      storeBusyOfficialAction,
      storeBusyPackage,
      storeBusyPluginId,
      syncInstallUpdateQueue,
    ],
  );

  useEffect(() => {
    void ensureRestartContext();
    void refreshOfficialStore().finally(() => setPageReady(true));
  }, [ensureRestartContext, refreshOfficialStore]);

  useEffect(() => {
    let cancelled = false;
    const resume = async () => {
      let jobId = "";
      let kind = "";
      let target = "";
      let action = "";
      let percent = 0;
      let message = "正在恢复进度…";
      try {
        const active = await fetchPluginStoreJobActive();
        if (cancelled) return;
        if (active?.job_id && (active.phase === "queued" || active.phase === "running")) {
          jobId = active.job_id;
          kind = String(active.kind || "");
          target = String(active.target || "");
          action = String(active.action || "");
          percent = Math.max(0, Number(active.progress_percent) || 0);
          if (active.message) message = active.message;
        }
      } catch {
        /* ignore */
      }
      if (!jobId) {
        const saved = getActiveJob("plugin-store");
        if (!saved?.jobId) return;
        jobId = saved.jobId;
        kind = saved.meta?.kind || "";
        target = saved.meta?.target || "";
        action = saved.meta?.action || "";
      }
      if (kind === "official") {
        setStoreBusyPackage(target);
        if (action === "install" || action === "update" || action === "uninstall") {
          setStoreBusyOfficialAction(action);
        }
      } else if (kind === "community") {
        setStoreBusyPluginId(target);
        if (action === "install" || action === "update" || action === "uninstall") {
          setStoreBusyCommunityAction(action);
        }
      }
      if (target) {
        setCardProgress({ key: target, percent, message });
      }
      setStoreActionHint(message);
      try {
        const payload = await waitForPluginStoreJob(
          jobId,
          openPluginInstallJobEventSource,
          applyCardProgress(target || jobId),
          { kind, target, action },
        );
        if (cancelled) return;
        const out = payload.result as
          | OfficialExtensionInstallResult
          | CommunityPluginActionResult
          | null
          | undefined;
        await noteStoreActionResult(out?.message || payload.message || "操作完成。", out ?? null);
        if (kind === "official") await refreshOfficialStore();
        else await refreshCommunityStore();
      } catch (e) {
        if (cancelled || e instanceof InstallJobStreamInterruptedError) {
          if (!cancelled) setStoreActionHint("操作仍在后台进行，返回本页可续看进度");
          return;
        }
        setStoreErr(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e));
      } finally {
        if (!cancelled) {
          const still = getActiveJob("plugin-store");
          if (!still?.jobId || still.jobId !== jobId) {
            setStoreBusyPackage("");
            setStoreBusyOfficialAction("");
            setStoreBusyPluginId("");
            setStoreBusyCommunityAction("");
            setCardProgress(null);
          }
        }
      }
    };
    void resume();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setActiveTab("all");
    setSearchQuery("");
    closeDetail();
    void refreshStore();
    // 切官方/社区时清提示；首挂留给 resume job 用，勿立刻清空
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSection]);

  const storeSectionPrevRef = useRef<typeof storeSection | null>(null);
  useEffect(() => {
    const prev = storeSectionPrevRef.current;
    storeSectionPrevRef.current = storeSection;
    if (prev == null || prev === storeSection) return;
    setStoreActionHint("");
    setStoreActionNeedsRestart(false);
  }, [storeSection]);

  function closeDetail() {
    setDetailOpen(false);
    setDetailTarget(null);
    setDetailTab("readme");
    setDetailReadmeHtml("");
    setDetailReadmeErr("");
    setDetailChangelogHtml("");
    setDetailChangelogErr("");
    setDetailChangelogSource("");
    setDetailChangelogLoaded(false);
  }

  async function loadDetailReadme(target: StoreDetail) {
    setDetailTab("readme");
    setDetailChangelogHtml("");
    setDetailChangelogErr("");
    setDetailChangelogSource("");
    setDetailChangelogLoaded(false);
    setDetailReadmeLoading(true);
    setDetailReadmeHtml("");
    setDetailReadmeErr("");
    if (!target.repositoryUrl) {
      setDetailReadmeErr("该条目未提供仓库链接");
      setDetailReadmeLoading(false);
      return;
    }
    try {
      const md = await fetchPluginStoreReadme(target.kind, target.id, { repositoryUrl: target.repositoryUrl });
      setDetailReadmeHtml(readmeMarkdownToSafeHtml(md, target.repositoryUrl));
    } catch (e) {
      setDetailReadmeErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailReadmeLoading(false);
    }
  }

  async function loadDetailChangelog(target: StoreDetail) {
    if (detailChangelogLoaded || detailChangelogLoading) return;
    setDetailChangelogLoaded(true);
    setDetailChangelogLoading(true);
    setDetailChangelogHtml("");
    setDetailChangelogErr("");
    setDetailChangelogSource("");
    try {
      const data = await fetchPluginStoreChangelog(target.kind, target.id, {
        repositoryUrl: target.repositoryUrl,
      });
      const markdown = (data.markdown || "").trim();
      if (markdown) {
        setDetailChangelogHtml(readmeMarkdownToSafeHtml(data.markdown, target.repositoryUrl));
        setDetailChangelogSource(data.source);
      }
    } catch (e) {
      setDetailChangelogLoaded(false);
      setDetailChangelogErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailChangelogLoading(false);
    }
  }

  async function openOfficialReadme(row: OfficialExtensionRow) {
    const target: StoreDetail = {
      kind: "official",
      id: row.package,
      title: officialRowTitle(row),
      subtitle: row.package,
      description: officialRowDescription(row),
      repositoryUrl: row.repository_url || null,
      official: row,
    };
    setDetailTarget(target);
    setDetailOpen(true);
    await loadDetailReadme(target);
  }

  async function openCommunityReadme(row: CommunityPluginRow) {
    const target: StoreDetail = {
      kind: "community",
      id: row.plugin_id,
      title: row.name || row.plugin_id,
      subtitle: row.plugin_id,
      description: row.description || "",
      repositoryUrl: row.repository_url || null,
      community: row,
    };
    setDetailTarget(target);
    setDetailOpen(true);
    await loadDetailReadme(target);
  }

  async function checkUpdates() {
    if (checkingUpdate) return;
    setStoreErr("");
    setStoreActionHint("");
    setStoreActionNeedsRestart(false);
    setCheckingUpdate(true);
    try {
      const out = await refreshPluginUpdateSnapshot();
      if (storeSection === "official") await refreshOfficialStore();
      else if (storeSection === "community") await refreshCommunityStore(true);
      const n = (out.community_count ?? 0) + (out.official_count ?? 0);
      setStoreActionHint(n ? `已检查 ${n} 个插件的版本。` : "已完成版本检查。");
    } catch (e) {
      setStoreErr(axiosErrorDetail(e));
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function restartBotNow(workersOnly = false) {
    setStoreErr("");
    const ok = await restartBot(workersOnly);
    if (ok) {
      setStoreActionNeedsRestart(false);
      setStoreActionHint(restartProgressLabel || "Bot 已恢复在线。");
    } else if (restartErr) {
      setStoreErr(restartErr);
    }
  }

  async function uninstallExtension(row: OfficialExtensionRow, restart = false) {
    if (storeBusyPackage) return;
    const ok = await confirm({
      title: restart ? "卸载并重启" : "卸载扩展",
      subtitle: restart
        ? `将卸载 ${row.package} 并重启 Bot。`
        : `将卸载 ${row.package}。卸载后需重启 Bot，且不会删除 local/plugins 副本。`,
      confirmLabel: restart ? "确认卸载并重启" : "确认卸载",
    });
    if (!ok) return;
    setStoreErr("");
    setStoreActionHint("");
    setStoreActionNeedsRestart(false);
    setStoreBusyPackage(row.package);
    setStoreBusyOfficialAction("uninstall");
    setCardProgress({ key: row.package, percent: 0, message: `正在卸载 ${row.package}…` });
    let keepProgress = false;
    try {
      const job = await uninstallOfficialExtensionAsync(row.package, { restart });
      const payload = await waitForPluginStoreJob(
        job.job_id,
        openPluginInstallJobEventSource,
        applyCardProgress(row.package),
        { kind: "official", target: row.package, action: "uninstall" },
      );
      const out = (payload.result ?? {}) as OfficialExtensionInstallResult;
      setOfficialActionState((prev) => ({ ...prev, [row.package]: out }));
      await noteStoreActionResult(out.message || payload.message || (restart ? "已卸载。" : "已卸载，请重启 Bot。"), out);
      await refreshOfficialStore();
    } catch (e) {
      if (e instanceof InstallJobStreamInterruptedError) {
        setStoreActionHint("操作仍在后台进行，返回本页可续看进度");
        keepProgress = true;
      } else {
        setStoreErr(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e));
      }
    } finally {
      if (!keepProgress) {
        setStoreBusyPackage("");
        setStoreBusyOfficialAction("");
        setCardProgress(null);
      }
    }
  }

  async function uninstallCommunity(row: CommunityPluginRow, restart = false) {
    if (storeBusyPluginId) return;
    const ok = await confirm({
      title: restart ? "删除并重启" : "删除社区插件",
      subtitle: restart
        ? `将删除 local/plugins/${row.plugin_id} 并重启 Bot。`
        : `将删除 local/plugins/${row.plugin_id}。删除后需重启 Bot。`,
      confirmLabel: restart ? "确认删除并重启" : "确认删除",
    });
    if (!ok) return;
    setStoreErr("");
    setStoreActionHint("");
    setStoreActionNeedsRestart(false);
    setStoreBusyPluginId(row.plugin_id);
    setStoreBusyCommunityAction("uninstall");
    setCardProgress({ key: row.plugin_id, percent: 0, message: `正在删除 ${row.plugin_id}…` });
    let keepProgress = false;
    try {
      const job = await uninstallCommunityPluginAsync(row.plugin_id, { restart });
      const payload = await waitForPluginStoreJob(
        job.job_id,
        openPluginInstallJobEventSource,
        applyCardProgress(row.plugin_id),
        { kind: "community", target: row.plugin_id, action: "uninstall" },
      );
      const out = (payload.result ?? {}) as CommunityPluginActionResult;
      setCommunityActionState((prev) => ({ ...prev, [row.plugin_id]: out }));
      await noteStoreActionResult(out.message || payload.message || "已卸载。", out);
      await refreshCommunityStore();
    } catch (e) {
      if (e instanceof InstallJobStreamInterruptedError) {
        setStoreActionHint("操作仍在后台进行，返回本页可续看进度");
        keepProgress = true;
      } else {
        setStoreErr(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e));
      }
    } finally {
      if (!keepProgress) {
        setStoreBusyPluginId("");
        setStoreBusyCommunityAction("");
        setCardProgress(null);
      }
    }
  }

  async function installCommunityFromGit(restart = false) {
    if (gitInstallBusy || !gitInstallValid) return;
    const pluginId = gitPluginId.trim();
    const ok = await confirm({
      title: restart ? "Git 安装并重启" : "从 Git 安装",
      subtitle: restart
        ? `将从仓库安装「${pluginId}」并重启 Bot。`
        : `将从仓库安装「${pluginId}」。完成后可能需要重启 Bot。`,
      confirmVariant: "default",
      confirmLabel: restart ? "确认安装并重启" : "确认安装",
    });
    if (!ok) return;
    setStoreErr("");
    setStoreActionHint("");
    setStoreActionNeedsRestart(false);
    setGitInstallBusy(true);
    setStoreBusyPluginId(pluginId);
    setCardProgress({ key: pluginId, percent: 0, message: "正在安装…" });
    let keepProgress = false;
    try {
      const job = await installCommunityPluginAsync(pluginId, {
        restart,
        repositoryUrl: gitRepositoryUrl.trim(),
        ref: gitRef.trim() || "main",
      });
      const payload = await waitForPluginStoreJob(
        job.job_id,
        openPluginInstallJobEventSource,
        applyCardProgress(pluginId),
        { kind: "community", target: pluginId, action: "install" },
      );
      const out = (payload.result ?? {}) as CommunityPluginActionResult;
      setCommunityActionState((prev) => ({ ...prev, [pluginId]: out }));
      await noteStoreActionResult(out.message || payload.message || "安装完成。", out);
      setGitInstallOpen(false);
      await refreshCommunityStore();
    } catch (e) {
      if (e instanceof InstallJobStreamInterruptedError) {
        setStoreActionHint("操作仍在后台进行，返回本页可续看进度");
        keepProgress = true;
      } else {
        setStoreErr(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e));
      }
    } finally {
      if (!keepProgress) {
        setGitInstallBusy(false);
        setStoreBusyPluginId("");
        setCardProgress(null);
      }
    }
  }

  async function copyInstallCli(row: OfficialExtensionRow) {
    const cmd = (row.install_cli || "").trim();
    if (!cmd) return;
    if (await copyTextToClipboard(cmd)) {
      setStoreCopyHint(`已复制安装命令：${row.package}`);
      window.setTimeout(() => setStoreCopyHint(""), 2500);
    }
  }

  function openExternalUrl(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function officialMenuItems(row: OfficialExtensionRow): PluginStoreMenuItem[] {
    const items: PluginStoreMenuItem[] = [];
    const result = officialActionState[row.package] ?? null;
    if (row.can_install && row.restart_available) items.push({ id: "install-restart", label: "安装并重启" });
    if (row.can_uninstall && row.restart_available) {
      items.push({ id: "uninstall-restart", label: "卸载并重启", danger: true });
    }
    if (officialUpdateEnabled(row, result) && row.restart_available) {
      items.push({ id: "update-restart", label: "更新并重启" });
    }
    if (resultNeedsRestart(result) && row.restart_available) items.push({ id: "restart-now", label: "立即重启" });
    if (row.install_cli) items.push({ id: "copy-cli", label: "复制安装命令" });
    if (row.repository_url) items.push({ id: "open-repo", label: "打开仓库" });
    return items;
  }

  function communityMenuItems(row: CommunityPluginRow): PluginStoreMenuItem[] {
    const items: PluginStoreMenuItem[] = [];
    const result = communityActionState[row.plugin_id] ?? null;
    if (row.can_install && communityRestartAvailable) items.push({ id: "install-restart", label: "安装并重启" });
    if (row.can_uninstall && communityRestartAvailable) {
      items.push({ id: "uninstall-restart", label: "删除并重启", danger: true });
    }
    if (communityUpdateEnabled(row, result) && communityRestartAvailable) {
      items.push({ id: "update-restart", label: "更新并重启" });
    }
    if (resultNeedsRestart(result) && communityRestartAvailable) items.push({ id: "restart-now", label: "立即重启" });
    if (row.homepage) items.push({ id: "open-homepage", label: "打开主页" });
    if (row.repository_url) items.push({ id: "open-repo", label: "打开仓库" });
    return items;
  }

  function handleOfficialMenu(row: OfficialExtensionRow, actionId: string) {
    if (actionId === "install-restart") enqueueInstallUpdate({ kind: "official", action: "install", restart: true, row });
    if (actionId === "uninstall-restart") void uninstallExtension(row, true);
    if (actionId === "update-restart") enqueueInstallUpdate({ kind: "official", action: "update", restart: true, row });
    if (actionId === "restart-now") void restartBotNow();
    if (actionId === "copy-cli") void copyInstallCli(row);
    if (actionId === "open-repo" && row.repository_url) openExternalUrl(row.repository_url);
  }

  function handleCommunityMenu(row: CommunityPluginRow, actionId: string) {
    if (actionId === "install-restart") enqueueInstallUpdate({ kind: "community", action: "install", restart: true, row });
    if (actionId === "uninstall-restart") void uninstallCommunity(row, true);
    if (actionId === "update-restart") enqueueInstallUpdate({ kind: "community", action: "update", restart: true, row });
    if (actionId === "restart-now") void restartBotNow(Boolean(shardedRuntime));
    if (actionId === "open-homepage" && row.homepage) openExternalUrl(row.homepage);
    if (actionId === "open-repo" && row.repository_url) openExternalUrl(row.repository_url);
  }

  function renderEmpty(title: string) {
    return (
      <div className="plugin-store-page__empty-panel">
        <div className="panel__bd plugin-store-page__empty">
          <div className="plugin-store-page__empty-icon" aria-hidden="true">
            🏪
          </div>
          <p className="plugin-store-page__empty-title">{title}</p>
          <p className="muted plugin-store-page__empty-hint">{emptyHint}</p>
        </div>
      </div>
    );
  }

  const pageLead =
    storeSection === "official" ? (
      webuiInstallEnabled ? (
        "安装官方扩展包。"
      ) : (
        <>
          官方扩展；可复制命令或放入 <span className="console-hub-chip">local/plugins/</span>。
        </>
      )
    ) : storeSection === "community" ? (
      <>
        <a href={COMMUNITY_INDEX_REPO_URL} target="_blank" rel="noopener noreferrer">
          社区插件
        </a>
        与 Git 安装。
      </>
    ) : (
      <>
        <code>local/plugins/</code> 本地插件。
      </>
    );

  if (!pageReady) {
    return (
      <div className="console-hub-page plugin-store-page plugin-store-page--hub">
        <PageMasthead title="插件商店" description="加载商店目录…" />
        <div className="plugin-store-page__grid">
          {Array.from({ length: 8 }, (_, i) => (
            <PluginStoreCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const mastheadActions = (
    <div className="flex flex-nowrap items-center gap-1.5">
      <Button type="button" variant="secondary" size="sm" onClick={() => setGitMirrorOpen(true)}>
        镜像源
      </Button>
      {storeSection === "community" && communityWebuiInstallEnabled ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => setGitInstallOpen(true)}>
          Git 安装
        </Button>
      ) : null}
      {storeSection !== "local" ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={checkingUpdate || loading}
          onClick={() => void checkUpdates()}
        >
          {checkingUpdate ? "检查中…" : "检查更新"}
        </Button>
      ) : (
        <RefreshIconButton busy={loading} label="刷新列表" showLabel onClick={() => void refreshStore(true)} />
      )}
    </div>
  );

  return (
    <div className="console-hub-page plugin-store-page plugin-store-page--hub">
      <PageMasthead title="插件商店" description={pageLead} actions={mastheadActions} />

      <ChromeTools>
        {/* 搜索 flex 铺满；类型/筛选 Select shrink-0 + nowrap，避免挤换行 */}
        <div className="relative min-w-[8rem] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <Input
            type="search"
            className={CHROME_SEARCH_INPUT}
            placeholder={storeSection === "official" ? "搜索扩展…" : "搜索插件…"}
            aria-label={storeSection === "official" ? "搜索扩展" : "搜索插件"}
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <ChromeField label="类型" icon={Package}>
          <Select value={storeSection} onValueChange={(v) => setStoreSection(v as StoreSection)}>
            <SelectTrigger
              className={cn(CHROME_SELECT_TRIGGER, "whitespace-nowrap [&>span]:whitespace-nowrap")}
              aria-label="商店类型"
            >
              <SelectValue placeholder="类型">
                {sectionOptions.find((s) => s.value === storeSection)?.label ?? "类型"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className="min-w-[9rem]">
              {sectionOptions.map((sec) => {
                const sectionNotice =
                  sec.value === "official"
                    ? storeNoticeFlags.officialUpdates > 0 || storeNoticeFlags.officialNew > 0
                    : sec.value === "community"
                      ? storeNoticeFlags.communityUpdates > 0 || storeNoticeFlags.communityNew > 0
                      : false;
                return (
                  <SelectItem key={sec.value} value={sec.value}>
                    <span className="inline-flex min-w-0 items-center">
                      <ChromeOptionLabel
                        icon={
                          sec.value === "official"
                            ? BadgeCheck
                            : sec.value === "community"
                              ? Users
                              : FolderOpen
                        }
                      >
                        {sec.label}
                      </ChromeOptionLabel>
                      {sectionNotice ? <NoticeDot /> : null}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </ChromeField>
        <ChromeField label="筛选" icon={Filter}>
          <Select value={activeTab} onValueChange={(v) => setActiveTab(v as StoreTab)}>
            <SelectTrigger
              className={cn(CHROME_SELECT_TRIGGER, "min-w-[6.75rem] whitespace-nowrap [&>span]:whitespace-nowrap")}
              aria-label="列表筛选"
            >
              <SelectValue placeholder="筛选">
                <span className="inline-flex items-center">
                  {tabOptions.find((t) => t.value === activeTab)?.label ?? "筛选"}
                  {activeTab === "updates" && storeNoticeFlags.updatesTabNotice ? <NoticeDot /> : null}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className="min-w-[8.5rem]">
              {tabOptions.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  <span className="inline-flex min-w-0 items-center">
                    <ChromeOptionLabel icon={Filter}>{tab.label}</ChromeOptionLabel>
                    {tab.value === "updates" && storeNoticeFlags.updatesTabNotice ? <NoticeDot /> : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ChromeField>
      </ChromeTools>

      <p className="muted text-sm">共 {resultCount} 项</p>

      {storeSection === "community" && communityIndexSourceDisplay ? (
        <div className="console-hint plugin-store-page__hint" role="status">
          <span>
            索引来源：
            {communityIndexSourceDisplay.href ? (
              <a href={communityIndexSourceDisplay.href} target="_blank" rel="noopener noreferrer">
                {communityIndexSourceDisplay.label}
              </a>
            ) : (
              communityIndexSourceDisplay.label
            )}
          </span>
        </div>
      ) : null}
      {storeSection === "community" && !communityExtraDirsReady ? (
        <p className="alert plugin-store-page__hint" role="status">
          尚未配置本地插件目录。安装后请重启 Bot；若未自动加载，可在
          <span className="plugin-store-page__chip">pallas.toml</span>
          中设置
          <span className="plugin-store-page__chip">extra_plugin_dirs</span>。
        </p>
      ) : null}
      {storeSection === "community" && communityIndexError ? (
        <p className="alert alert--err plugin-store-page__hint">索引加载失败：{communityIndexError}</p>
      ) : null}

      {storeActionHint ? (
        <div
          className={cn(
            "plugin-store-page__action-hint",
            storeActionNeedsRestart && "plugin-store-page__action-hint--with-action",
          )}
          role="status"
        >
          <p className="plugin-store-page__hint plugin-store-page__hint--ok plugin-store-page__action-hint-text">
            {restartInProgress ? restartProgressLabel || storeActionHint : storeActionHint}
          </p>
          {storeActionNeedsRestart ? (
            <button
              type="button"
              className="btn btn--primary plugin-store-page__action-hint-btn"
              disabled={restartBusy || restartInProgress}
              onClick={() => void restartBotNow()}
            >
              {restartInProgress ? "重启中…" : "立即重启 Bot"}
            </button>
          ) : null}
        </div>
      ) : null}
      {storeCopyHint ? (
        <div className="plugin-store-page__action-hint" role="status">
          <p className="plugin-store-page__hint plugin-store-page__hint--ok plugin-store-page__action-hint-text">
            {storeCopyHint}
          </p>
        </div>
      ) : null}
      {storeErr ? <div className="alert alert--err plugin-store-page__hint">{storeErr}</div> : null}

      {storeSection === "official" ? (
        loading && !rows.length ? (
          <div className="plugin-store-page__grid">
            {Array.from({ length: 8 }, (_, i) => (
              <PluginStoreCardSkeleton key={i} />
            ))}
          </div>
        ) : !filteredRows.length ? (
          renderEmpty(
            searchQuery
              ? "没有匹配的扩展"
              : activeTab === "installed"
                ? "暂无已安装扩展"
                : activeTab === "available"
                  ? "暂无可安装扩展"
                  : "暂无扩展",
          )
        ) : (
          <div className="plugin-store-page__grid">
            {filteredRows.map((row) => {
              const result = officialActionState[row.package] ?? null;
              return (
                <PluginStoreCard
                  key={row.package}
                  title={officialRowTitle(row)}
                  description={officialRowDescription(row)}
                  author="by PallasBot"
                  pluginId={officialRowPluginId(row)}
                  iconUrl={officialRowIconUrl(row)}
                  installed={extensionInstalled(row)}
                  installBusy={storeBusyPackage === row.package && storeBusyOfficialAction === "install"}
                  updateBusy={storeBusyPackage === row.package && storeBusyOfficialAction === "update"}
                  uninstallBusy={storeBusyPackage === row.package && storeBusyOfficialAction === "uninstall"}
                  installQueued={isOfficialInstallUpdateQueued(row.package, "install")}
                  updateQueued={isOfficialInstallUpdateQueued(row.package, "update")}
                  repoUrl={row.repository_url || null}
                  metaLinkLabel="GitHub"
                  metaLinkUrl={row.repository_url || null}
                  menuItems={officialMenuItems(row)}
                  showInstall={Boolean(row.can_install)}
                  showUninstall={Boolean(row.can_uninstall)}
                  showUpdate={officialUpdateEnabled(row, result)}
                  updateLabel={officialUpdateLabel(result)}
                  latestLabel={updateLatestLabel(row)}
                  installedVersionLabel={officialInstalledVersionLabel(row, result)}
                  progressPercent={cardProgress?.key === row.package ? cardProgress.percent : null}
                  progressMessage={cardProgress?.key === row.package ? cardProgress.message : ""}
                  detailLabel="仓库"
                  canOpen={Boolean(row.repository_url)}
                  onOpen={() => void openOfficialReadme(row)}
                  onInstall={() => enqueueInstallUpdate({ kind: "official", action: "install", restart: false, row })}
                  onUpdate={() => enqueueInstallUpdate({ kind: "official", action: "update", restart: false, row })}
                  onUninstall={() => void uninstallExtension(row, false)}
                  onMenuAction={(id) => handleOfficialMenu(row, id)}
                />
              );
            })}
          </div>
        )
      ) : storeSection === "community" ? (
        loading && !communityRows.length ? (
          <div className="plugin-store-page__grid">
            {Array.from({ length: 8 }, (_, i) => (
              <PluginStoreCardSkeleton key={i} />
            ))}
          </div>
        ) : !filteredCommunityRows.length ? (
          renderEmpty(
            searchQuery
              ? "没有匹配的插件"
              : activeTab === "installed"
                ? "暂无已安装"
                : activeTab === "available"
                  ? "暂无可安装"
                  : "列表为空",
          )
        ) : (
          <div className="plugin-store-page__grid">
            {filteredCommunityRows.map((row) => {
              const result = communityActionState[row.plugin_id] ?? null;
              return (
                <PluginStoreCard
                  key={row.plugin_id}
                  title={row.name || row.plugin_id}
                  description={row.description || row.plugin_id}
                  author={row.author ? `by ${row.author}` : ""}
                  pluginId={row.plugin_id}
                  iconUrl={communityRowIconUrl(row, communityIndexUpdatedAt)}
                  avatarUrl={communityRowAvatarUrl(row, communityIndexUpdatedAt)}
                  installed={communityInstalled(row)}
                  installBusy={storeBusyPluginId === row.plugin_id && storeBusyCommunityAction === "install"}
                  updateBusy={storeBusyPluginId === row.plugin_id && storeBusyCommunityAction === "update"}
                  uninstallBusy={storeBusyPluginId === row.plugin_id && storeBusyCommunityAction === "uninstall"}
                  installQueued={isCommunityInstallUpdateQueued(row.plugin_id, "install")}
                  updateQueued={isCommunityInstallUpdateQueued(row.plugin_id, "update")}
                  repoUrl={row.repository_url || null}
                  metaLinkLabel="GitHub"
                  metaLinkUrl={row.repository_url || row.homepage || null}
                  menuItems={communityMenuItems(row)}
                  showInstall={Boolean(row.can_install)}
                  showUninstall={Boolean(row.can_uninstall)}
                  showUpdate={communityUpdateEnabled(row, result)}
                  uninstallLabel="删除"
                  updateLabel={communityUpdateLabel(result)}
                  latestLabel={updateLatestLabel(row)}
                  installedVersionLabel={communityInstalledVersionLabel(row, result)}
                  progressPercent={cardProgress?.key === row.plugin_id ? cardProgress.percent : null}
                  progressMessage={cardProgress?.key === row.plugin_id ? cardProgress.message : ""}
                  detailLabel="仓库"
                  canOpen={Boolean(row.repository_url)}
                  onOpen={() => void openCommunityReadme(row)}
                  onInstall={() => enqueueInstallUpdate({ kind: "community", action: "install", restart: false, row })}
                  onUpdate={() => enqueueInstallUpdate({ kind: "community", action: "update", restart: false, row })}
                  onUninstall={() => void uninstallCommunity(row, false)}
                  onMenuAction={(id) => handleCommunityMenu(row, id)}
                />
              );
            })}
          </div>
        )
      ) : loading && !localRows.length ? (
        <div className="plugin-store-page__grid">
          {Array.from({ length: 4 }, (_, i) => (
            <PluginStoreCardSkeleton key={i} />
          ))}
        </div>
      ) : !filteredLocalRows.length ? (
        renderEmpty(searchQuery ? "没有匹配的插件" : "暂无本地插件")
      ) : (
        <div className="plugin-store-page__grid">
          {filteredLocalRows.map((row) => {
            const community = localCommunityMatch(row, communityRowById);
            return (
              <PluginStoreCard
                key={row.name}
                title={localPluginTitle(row, community)}
                description={localPluginDescription(row, community)}
                author={localPluginAuthor(row, community)}
                pluginId={row.name}
                iconUrl={localPluginIconUrl(row, community, communityIndexUpdatedAt)}
                avatarUrl={localPluginAvatarUrl(row, community, communityIndexUpdatedAt)}
                installed
                repoUrl={localPluginRepoUrl(community)}
                metaLinkLabel="GitHub"
                metaLinkUrl={localPluginRepoUrl(community)}
                menuItems={[]}
                showInstall={false}
                showUninstall={false}
                showUpdate={false}
                detailLabel="配置"
                canOpen
                onOpen={() => navigate(`/plugins/${encodeURIComponent(row.name)}`)}
              />
            );
          })}
        </div>
      )}

      <Dialog
        open={detailOpen && Boolean(detailTarget)}
        onOpenChange={(next) => {
          if (!next) closeDetail();
        }}
      >
        <DialogContent className="plugin-store-page__detail-dialog flex max-h-[min(860px,calc(100dvh-32px))] w-[min(720px,calc(100vw-32px))] max-w-[min(720px,calc(100vw-32px))] gap-0 overflow-hidden bg-card p-0">
          <DialogHeader className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left">
            <DialogTitle id="plugin-store-detail-title">{detailTarget?.title}</DialogTitle>
            <DialogDescription asChild>
              <div>
                <p className="m-0 text-sm text-muted-foreground">
                  <code>{detailTarget?.subtitle}</code>
                  {detailTarget?.description ? (
                    <span className="plugin-store-page__detail-sub"> · {detailTarget.description}</span>
                  ) : null}
                </p>
                {detailTarget?.kind === "official" && detailTarget.official ? (
                  <p className="plugin-store-page__detail-activation mt-1.5">
                    {officialActivationHint(detailTarget.official)}
                  </p>
                ) : null}
                {detailTarget?.kind === "community" && detailTarget.community ? (
                  <p className="plugin-store-page__detail-activation mt-1.5">
                    {communityActivationHint(detailTarget.community)}
                  </p>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="plugin-store-page__detail-bd min-h-0 flex-1 overflow-auto px-4 py-3">
        {detailTarget ? (
          <>
            <div className="plugin-store-page__detail-pane-bar">
              <Select
                value={detailTab}
                onValueChange={(v) => {
                  const next = v === "changelog" ? "changelog" : "readme";
                  setDetailTab(next);
                  if (next === "changelog" && detailTarget) void loadDetailChangelog(detailTarget);
                }}
              >
                <SelectTrigger className="h-9 w-auto min-w-[8.5rem]" aria-label="详情分栏">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="readme">README</SelectItem>
                  <SelectItem value="changelog">更新日志</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {detailTab === "readme" ? (
              detailReadmeLoading ? (
                <div className="plugin-store-page__detail-skeleton">
                  <div className="plugin-store-page__detail-skel-line" />
                  <div className="plugin-store-page__detail-skel-line plugin-store-page__detail-skel-line--short" />
                </div>
              ) : detailReadmeErr ? (
                <p className="muted plugin-store-page__detail-fallback">{detailReadmeErr}</p>
              ) : detailReadmeHtml ? (
                <ReadmeMarkdown html={detailReadmeHtml} />
              ) : (
                <p className="muted plugin-store-page__detail-fallback">暂无 README 内容</p>
              )
            ) : detailChangelogLoading ? (
              <div className="plugin-store-page__detail-skeleton">
                <div className="plugin-store-page__detail-skel-line" />
              </div>
            ) : detailChangelogErr ? (
              <p className="muted plugin-store-page__detail-fallback">{detailChangelogErr}</p>
            ) : detailChangelogHtml ? (
              <>
                {detailChangelogSource === "git" ? (
                  <p className="muted plugin-store-page__changelog-note">
                    该插件未提供 CHANGELOG.md，以下为根据 git 提交历史自动生成。
                  </p>
                ) : null}
                <ReadmeMarkdown html={detailChangelogHtml} />
              </>
            ) : (
              <p className="muted plugin-store-page__detail-fallback">暂无更新日志</p>
            )}
          </>
        ) : null}
          </div>

          {detailTarget ? (
            <DialogFooter className="plugin-store-page__detail-foot flex-row flex-nowrap items-center justify-end gap-2 border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3">
              {detailTarget.kind === "official" && detailTarget.official ? (
                <>
                  {detailTarget.official.can_install ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        isOfficialInstallUpdateQueued(detailTarget.official.package, "install")
                        || (storeBusyPackage === detailTarget.official.package
                          && storeBusyOfficialAction === "install")
                      }
                      onClick={() =>
                        enqueueInstallUpdate({
                          kind: "official",
                          action: "install",
                          restart: false,
                          row: detailTarget.official!,
                        })
                      }
                    >
                      一键安装
                    </Button>
                  ) : null}
                  {officialUpdateEnabled(detailTarget.official, officialActionState[detailTarget.official.package] ?? null) ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        isOfficialInstallUpdateQueued(detailTarget.official.package, "update")
                        || (storeBusyPackage === detailTarget.official.package
                          && storeBusyOfficialAction === "update")
                      }
                      onClick={() =>
                        enqueueInstallUpdate({
                          kind: "official",
                          action: "update",
                          restart: false,
                          row: detailTarget.official!,
                        })
                      }
                    >
                      更新
                    </Button>
                  ) : null}
                  {detailTarget.official.can_uninstall ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={
                        storeBusyPackage === detailTarget.official.package
                        && storeBusyOfficialAction === "uninstall"
                      }
                      onClick={() => void uninstallExtension(detailTarget.official!, false)}
                    >
                      卸载
                    </Button>
                  ) : null}
                </>
              ) : null}
              {detailTarget.kind === "community" && detailTarget.community ? (
                <>
                  {detailTarget.community.can_install ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        isCommunityInstallUpdateQueued(detailTarget.community.plugin_id, "install")
                        || (storeBusyPluginId === detailTarget.community.plugin_id
                          && storeBusyCommunityAction === "install")
                      }
                      onClick={() =>
                        enqueueInstallUpdate({
                          kind: "community",
                          action: "install",
                          restart: false,
                          row: detailTarget.community!,
                        })
                      }
                    >
                      安装
                    </Button>
                  ) : null}
                  {communityUpdateEnabled(
                    detailTarget.community,
                    communityActionState[detailTarget.community.plugin_id] ?? null,
                  ) ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        isCommunityInstallUpdateQueued(detailTarget.community.plugin_id, "update")
                        || (storeBusyPluginId === detailTarget.community.plugin_id
                          && storeBusyCommunityAction === "update")
                      }
                      onClick={() =>
                        enqueueInstallUpdate({
                          kind: "community",
                          action: "update",
                          restart: false,
                          row: detailTarget.community!,
                        })
                      }
                    >
                      更新
                    </Button>
                  ) : null}
                  {detailTarget.community.can_uninstall ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={
                        storeBusyPluginId === detailTarget.community.plugin_id
                        && storeBusyCommunityAction === "uninstall"
                      }
                      onClick={() => void uninstallCommunity(detailTarget.community!, false)}
                    >
                      删除
                    </Button>
                  ) : null}
                </>
              ) : null}
              {detailTarget.repositoryUrl ? (
                <Button asChild type="button" variant="outline" size="sm">
                  <a href={detailTarget.repositoryUrl} target="_blank" rel="noopener noreferrer">
                    打开仓库
                  </a>
                </Button>
              ) : null}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={gitInstallOpen}
        onOpenChange={(next) => {
          if (!next && !gitInstallBusy) setGitInstallOpen(false);
        }}
      >
        <DialogContent
          className="plugin-store-page__git-dialog flex max-h-[min(640px,calc(100dvh-32px))] w-[min(480px,calc(100vw-32px))] max-w-[min(480px,calc(100vw-32px))] gap-0 overflow-hidden bg-card p-0"
          onEscapeKeyDown={(e) => {
            if (gitInstallBusy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (gitInstallBusy) e.preventDefault();
          }}
        >
          <DialogHeader className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left">
            <DialogTitle id="plugin-store-git-install-title">从 Git 安装</DialogTitle>
            <DialogDescription>
              无需收录到社区索引，直接 clone 到 <code>local/plugins/&lt;ID&gt;/</code>
            </DialogDescription>
          </DialogHeader>

          <div className="plugin-store-page__git-bd px-4 py-3">
        <div className="plugin-store-page__git-form">
          <label className="plugin-store-page__git-field">
            <span className="plugin-store-page__git-label">插件 ID</span>
            <Input
              className="plugin-store-page__git-input h-9"
              value={gitPluginId}
              disabled={gitInstallBusy}
              placeholder="小写字母开头，如 my_plugin"
              onChange={(e) => setGitPluginId(e.target.value)}
            />
            <span className="muted plugin-store-page__git-hint">
              须与目录名一致，安装路径为 local/plugins/&lt;ID&gt;/
            </span>
          </label>
          <label className="plugin-store-page__git-field">
            <span className="plugin-store-page__git-label">Git 仓库</span>
            <Input
              className="plugin-store-page__git-input h-9"
              value={gitRepositoryUrl}
              disabled={gitInstallBusy}
              placeholder="https://github.com/org/repo.git"
              onChange={(e) => setGitRepositoryUrl(e.target.value)}
            />
          </label>
          <label className="plugin-store-page__git-field">
            <span className="plugin-store-page__git-label">分支 / Tag</span>
            <Input
              className="plugin-store-page__git-input h-9"
              value={gitRef}
              disabled={gitInstallBusy}
              placeholder="main"
              onChange={(e) => setGitRef(e.target.value)}
            />
          </label>
        </div>
          </div>

          <DialogFooter className="plugin-store-page__git-foot border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 sm:justify-end sm:space-x-2">
            <Button type="button" variant="outline" size="sm" disabled={gitInstallBusy} onClick={() => setGitInstallOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!gitInstallValid || gitInstallBusy}
              onClick={() => void installCommunityFromGit(false)}
            >
              {gitInstallBusy ? "安装中…" : "安装"}
            </Button>
            {communityRestartAvailable ? (
              <Button
                type="button"
                size="sm"
                disabled={!gitInstallValid || gitInstallBusy}
                onClick={() => void installCommunityFromGit(true)}
              >
                安装并重启
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GitMirrorDialog open={gitMirrorOpen} onClose={() => setGitMirrorOpen(false)} />
      {restartConfirmDialog}
      {confirmDialog}
    </div>
  );
}
