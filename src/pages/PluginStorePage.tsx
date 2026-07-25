import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { axiosErrorDetail } from "@/api/http";
import {
  installCommunityPluginAsync,
  installOfficialExtensionAsync,
  openPluginInstallJobEventSource,
  uninstallCommunityPlugin,
  uninstallOfficialExtension,
  updateCommunityPlugin,
  updateOfficialExtension,
} from "@/api/console";
import {
  fetchCommunityPluginStore,
  fetchOfficialExtensions,
  fetchPlugins,
  fetchPluginStoreChangelog,
  fetchPluginStoreReadme,
  refreshPluginStore,
  refreshPluginUpdateSnapshot,
} from "@/api/fullConsole";
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
  formatPluginStoreInstallProgressHint,
  isPluginStoreTaskQueued,
  type PluginStoreQueueAction,
  type PluginStoreQueueKind,
  withPluginStoreQueueSuffix,
} from "@/utils/pluginStoreActionQueue";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, { CHROME_SEARCH_INPUT, CHROME_SELECT_TRIGGER } from "@/components/ChromeTools";
import GitMirrorDialog from "@/components/GitMirrorDialog";
import PageMasthead from "@/components/PageMasthead";
import { cn } from "@/lib/utils";
import PluginStoreCard, { type PluginStoreMenuItem } from "@/components/PluginStoreCard";
import PluginStoreCardSkeleton from "@/components/PluginStoreCardSkeleton";
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
import { waitForInstallJob } from "@/utils/installJobStream";
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
import SegTabs from "@/components/SegTabs";

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
  const [pageReady, setPageReady] = useState(false);
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
  const installUpdateQueueDeferredRestartRef = useRef(false);
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

  const {
    restartBusy,
    restartErr,
    restartProgressLabel,
    restartInProgress,
    restartAvailable: systemRestartAvailable,
    shardedRuntime,
    ensureRestartContext,
    restartBot,
    trackRestartFromPluginResult,
  } = useBotSystemRestart();

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

  const storeActionInProgress = Boolean(
    storeBusyOfficialAction || storeBusyCommunityAction || gitInstallBusy
      || installUpdateQueue.length > 0 || installUpdateQueueRunning,
  );

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

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = rows;
    if (activeTab === "installed") list = list.filter((row) => extensionInstalled(row) || row.bundled_in_repo);
    else if (activeTab === "available") list = list.filter((row) => row.can_install);
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
    if (activeTab === "available") return [];
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
      if (queuePending > 0 || installUpdateQueue.length > 0) {
        installUpdateQueueDeferredRestartRef.current =
          installUpdateQueueDeferredRestartRef.current || needsRestart;
        return;
      }
      setStoreActionHint(message);
      setStoreActionNeedsRestart(needsRestart || installUpdateQueueDeferredRestartRef.current);
      installUpdateQueueDeferredRestartRef.current = false;
    },
    [ensureRestartContext, installUpdateQueue.length, systemRestartAvailable, trackRestartFromPluginResult],
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
      if (installUpdateQueueRunning) return true;
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
      setStoreActionHint(withPluginStoreQueueSuffix("正在排队安装…", queuePending));
      setStoreActionNeedsRestart(false);
      setStoreBusyPackage(row.package);
      setStoreBusyOfficialAction("install");
      const label = officialRowTitle(row);
      try {
        const job = await installOfficialExtensionAsync(row.package, { restart });
        setStoreActionHint(
          withPluginStoreQueueSuffix(formatPluginStoreActiveHint("install", label), queuePending),
        );
        const payload = await waitForInstallJob(job.job_id, openPluginInstallJobEventSource, (message) => {
          setStoreActionHint(
            withPluginStoreQueueSuffix(
              formatPluginStoreInstallProgressHint(message, label, row.package, "install"),
              queuePending,
            ),
          );
        });
        const result = payload.result as OfficialExtensionInstallResult | undefined;
        if (result) {
          setOfficialActionState((prev) => ({ ...prev, [row.package]: result }));
          await noteStoreActionResult(result.message || payload.message || "安装完成。", result, queuePending);
        } else {
          await noteStoreActionResult(payload.message || "安装完成。", null, queuePending);
        }
        await refreshOfficialStore();
      } catch (e) {
        setStoreErr(axiosErrorDetail(e));
      } finally {
        setStoreBusyPackage("");
        setStoreBusyOfficialAction("");
      }
    },
    [noteStoreActionResult, refreshOfficialStore],
  );

  const executeUpdateExtension = useCallback(
    async (row: OfficialExtensionRow, restart: boolean, queuePending = 0) => {
      setStoreErr("");
      setStoreActionNeedsRestart(false);
      setStoreBusyPackage(row.package);
      setStoreBusyOfficialAction("update");
      const label = officialRowTitle(row);
      setStoreActionHint(withPluginStoreQueueSuffix(formatPluginStoreActiveHint("update", label), queuePending));
      try {
        const out = await updateOfficialExtension(row.package, { restart });
        setOfficialActionState((prev) => ({ ...prev, [row.package]: out as OfficialExtensionInstallResult }));
        await noteStoreActionResult(out.message || "更新完成。", out, queuePending);
        await refreshOfficialStore();
      } catch (e) {
        setStoreErr(axiosErrorDetail(e));
      } finally {
        setStoreBusyPackage("");
        setStoreBusyOfficialAction("");
      }
    },
    [noteStoreActionResult, refreshOfficialStore],
  );

  const executeInstallCommunity = useCallback(
    async (row: CommunityPluginRow, restart: boolean, queuePending = 0) => {
      setStoreErr("");
      setStoreActionHint(withPluginStoreQueueSuffix("正在排队安装…", queuePending));
      setStoreActionNeedsRestart(false);
      setStoreBusyPluginId(row.plugin_id);
      setStoreBusyCommunityAction("install");
      const label = (row.name || row.plugin_id).trim();
      try {
        const job = await installCommunityPluginAsync(row.plugin_id, {
          restart,
          repositoryUrl: row.repository_url || undefined,
          ref: row.ref,
        });
        setStoreActionHint(
          withPluginStoreQueueSuffix(formatPluginStoreActiveHint("install", label), queuePending),
        );
        const payload = await waitForInstallJob(job.job_id, openPluginInstallJobEventSource, (message) => {
          setStoreActionHint(
            withPluginStoreQueueSuffix(
              formatPluginStoreInstallProgressHint(message, label, row.plugin_id, "install"),
              queuePending,
            ),
          );
        });
        const out = (payload.result ?? {}) as CommunityPluginActionResult;
        setCommunityActionState((prev) => ({ ...prev, [row.plugin_id]: out }));
        await noteStoreActionResult(out.message || payload.message || "安装完成。", out, queuePending);
        await refreshCommunityStore();
      } catch (e) {
        setStoreErr(axiosErrorDetail(e));
      } finally {
        setStoreBusyPluginId("");
        setStoreBusyCommunityAction("");
      }
    },
    [noteStoreActionResult, refreshCommunityStore],
  );

  const executeUpdateCommunity = useCallback(
    async (row: CommunityPluginRow, restart: boolean, queuePending = 0) => {
      setStoreErr("");
      setStoreActionNeedsRestart(false);
      setStoreBusyPluginId(row.plugin_id);
      setStoreBusyCommunityAction("update");
      const label = (row.name || row.plugin_id).trim();
      setStoreActionHint(withPluginStoreQueueSuffix(formatPluginStoreActiveHint("update", label), queuePending));
      try {
        const out = await updateCommunityPlugin(row.plugin_id, { restart, ref: row.ref });
        setCommunityActionState((prev) => ({ ...prev, [row.plugin_id]: out as CommunityPluginActionResult }));
        await noteStoreActionResult(out.message || "更新完成。", out, queuePending);
        await refreshCommunityStore();
      } catch (e) {
        setStoreErr(axiosErrorDetail(e));
      } finally {
        setStoreBusyPluginId("");
        setStoreBusyCommunityAction("");
      }
    },
    [noteStoreActionResult, refreshCommunityStore],
  );

  const drainInstallUpdateQueue = useCallback(
    async (first?: InstallUpdateQueueEntry) => {
      setInstallUpdateQueueRunning(true);
      installUpdateQueueDeferredRestartRef.current = false;
      let current: InstallUpdateQueueEntry | undefined = first;
      let processedCount = 0;
      let batchHadUpdate = false;
      const queueSnapshot = [...installUpdateQueue];
      const pendingQueue = first ? [first, ...queueSnapshot] : [...queueSnapshot];
      setInstallUpdateQueue([]);
      try {
        let idx = 0;
        while (idx < pendingQueue.length) {
          current = pendingQueue[idx];
          idx += 1;
          const pendingAfter = pendingQueue.length - idx;
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
        setInstallUpdateQueueRunning(false);
        installUpdateQueueDeferredRestartRef.current = false;
      }
    },
    [
      executeInstallCommunity,
      executeInstallExtension,
      executeUpdateCommunity,
      executeUpdateExtension,
      installUpdateQueue,
      refreshUpdateSnapshotAfterUpdate,
      storeActionNeedsRestart,
      storeErr,
    ],
  );

  const enqueueInstallUpdate = useCallback(
    (entry: InstallUpdateQueueEntry) => {
      const descriptor = queueTaskDescriptor(entry);
      const queued = isPluginStoreTaskQueued(installUpdateQueue.map(queueTaskDescriptor), descriptor);
      const active =
        entry.kind === "official"
          ? storeBusyPackage === entry.row.package && storeBusyOfficialAction === entry.action
          : storeBusyPluginId === entry.row.plugin_id && storeBusyCommunityAction === entry.action;
      if (queued || active) return;
      setStoreErr("");
      setStoreActionNeedsRestart(false);
      if (isInstallUpdatePipelineBusy()) {
        setInstallUpdateQueue((prev) => [...prev, entry]);
        setStoreActionHint(
          formatPluginStoreEnqueuedHint(entry.action, queueEntryLabel(entry), installUpdateQueue.length + 1),
        );
        return;
      }
      void drainInstallUpdateQueue(entry);
    },
    [
      drainInstallUpdateQueue,
      installUpdateQueue,
      isInstallUpdatePipelineBusy,
      storeBusyCommunityAction,
      storeBusyOfficialAction,
      storeBusyPackage,
      storeBusyPluginId,
    ],
  );

  useEffect(() => {
    void ensureRestartContext();
    void refreshOfficialStore().finally(() => setPageReady(true));
  }, [ensureRestartContext, refreshOfficialStore]);

  useEffect(() => {
    setActiveTab("all");
    setSearchQuery("");
    setStoreActionHint("");
    setStoreActionNeedsRestart(false);
    closeDetail();
    void refreshStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const ok = window.confirm(
      restart
        ? `确定卸载 ${row.package} 并重启 Bot？`
        : `确定卸载 ${row.package}？卸载后需重启 Bot，且不会删除 local/plugins 副本。`,
    );
    if (!ok) return;
    setStoreErr("");
    setStoreActionHint("");
    setStoreActionNeedsRestart(false);
    setStoreBusyPackage(row.package);
    setStoreBusyOfficialAction("uninstall");
    setStoreActionHint(`正在卸载 ${row.package}…`);
    try {
      const out = await uninstallOfficialExtension(row.package, { restart });
      setOfficialActionState((prev) => ({ ...prev, [row.package]: out as OfficialExtensionInstallResult }));
      await noteStoreActionResult(out.message || (restart ? "已卸载。" : "已卸载，请重启 Bot。"), out);
      await refreshOfficialStore();
    } catch (e) {
      setStoreErr(axiosErrorDetail(e));
    } finally {
      setStoreBusyPackage("");
      setStoreBusyOfficialAction("");
    }
  }

  async function uninstallCommunity(row: CommunityPluginRow, restart = false) {
    if (storeBusyPluginId) return;
    const ok = window.confirm(
      restart
        ? `确定删除 local/plugins/${row.plugin_id} 并重启 Bot？`
        : `确定删除 local/plugins/${row.plugin_id}？删除后需重启 Bot。`,
    );
    if (!ok) return;
    setStoreErr("");
    setStoreActionHint("");
    setStoreActionNeedsRestart(false);
    setStoreBusyPluginId(row.plugin_id);
    setStoreBusyCommunityAction("uninstall");
    setStoreActionHint(`正在删除 ${row.plugin_id}…`);
    try {
      const out = await uninstallCommunityPlugin(row.plugin_id, { restart });
      setCommunityActionState((prev) => ({ ...prev, [row.plugin_id]: out as CommunityPluginActionResult }));
      await noteStoreActionResult(out.message || "已卸载。", out);
      await refreshCommunityStore();
    } catch (e) {
      setStoreErr(axiosErrorDetail(e));
    } finally {
      setStoreBusyPluginId("");
      setStoreBusyCommunityAction("");
    }
  }

  async function installCommunityFromGit(restart = false) {
    if (gitInstallBusy || !gitInstallValid) return;
    setStoreErr("");
    setStoreActionHint("正在排队安装…");
    setStoreActionNeedsRestart(false);
    setGitInstallBusy(true);
    const pluginId = gitPluginId.trim();
    setStoreBusyPluginId(pluginId);
    try {
      const job = await installCommunityPluginAsync(pluginId, {
        restart,
        repositoryUrl: gitRepositoryUrl.trim(),
        ref: gitRef.trim() || "main",
      });
      const payload = await waitForInstallJob(job.job_id, openPluginInstallJobEventSource, setStoreActionHint);
      const out = (payload.result ?? {}) as CommunityPluginActionResult;
      setCommunityActionState((prev) => ({ ...prev, [pluginId]: out }));
      await noteStoreActionResult(out.message || payload.message || "安装完成。", out);
      setGitInstallOpen(false);
      await refreshCommunityStore();
    } catch (e) {
      setStoreErr(axiosErrorDetail(e));
    } finally {
      setGitInstallBusy(false);
      setStoreBusyPluginId("");
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
              {sectionOptions.map((sec) => (
                <SelectItem key={sec.value} value={sec.value}>
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
                </SelectItem>
              ))}
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
                {tabOptions.find((t) => t.value === activeTab)?.label ?? "筛选"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className="min-w-[8.5rem]">
              {tabOptions.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  <ChromeOptionLabel icon={Filter}>{tab.label}</ChromeOptionLabel>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ChromeField>
      </ChromeTools>

      <p className="muted text-sm">共 {resultCount} 项</p>

      {storeSection === "community" && communityIndexSourceDisplay ? (
        <p className="muted plugin-store-page__hint" role="status">
          索引来源：
          {communityIndexSourceDisplay.href ? (
            <a href={communityIndexSourceDisplay.href} target="_blank" rel="noopener noreferrer">
              {communityIndexSourceDisplay.label}
            </a>
          ) : (
            <span>{communityIndexSourceDisplay.label}</span>
          )}
        </p>
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
        <div className="plugin-store-page__action-hint" role="status">
          <p className="muted plugin-store-page__hint plugin-store-page__hint--ok">
            {restartInProgress ? restartProgressLabel || storeActionHint : storeActionHint}
          </p>
          {storeActionInProgress && !restartInProgress ? (
            <div className="plugin-store-page__action-progress" aria-hidden="true" />
          ) : null}
          {storeActionNeedsRestart ? (
            <button
              type="button"
              className="btn"
              disabled={restartBusy || restartInProgress}
              onClick={() => void restartBotNow()}
            >
              {restartInProgress ? "重启中…" : "立即重启 Bot"}
            </button>
          ) : null}
        </div>
      ) : null}
      {storeCopyHint ? (
        <p className="muted plugin-store-page__hint plugin-store-page__hint--ok" role="status">
          {storeCopyHint}
        </p>
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
            <SegTabs
              className="plugin-store-page__detail-tabs"
              ariaLabel="详情分栏"
              value={detailTab}
              onValueChange={(v) => {
                const next = v === "changelog" ? "changelog" : "readme";
                setDetailTab(next);
                if (next === "changelog" && detailTarget) void loadDetailChangelog(detailTarget);
              }}
              options={[
                { value: "readme", label: "README" },
                { value: "changelog", label: "更新日志" },
              ]}
            />
            {detailTab === "readme" ? (
              detailReadmeLoading ? (
                <div className="plugin-store-page__detail-skeleton">
                  <div className="plugin-store-page__detail-skel-line" />
                  <div className="plugin-store-page__detail-skel-line plugin-store-page__detail-skel-line--short" />
                </div>
              ) : detailReadmeErr ? (
                <p className="muted plugin-store-page__detail-fallback">{detailReadmeErr}</p>
              ) : detailReadmeHtml ? (
                <div className="readme-markdown" dangerouslySetInnerHTML={{ __html: detailReadmeHtml }} />
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
                <div className="readme-markdown" dangerouslySetInnerHTML={{ __html: detailChangelogHtml }} />
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
    </div>
  );
}
