import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import RefreshIconButton from "@/components/RefreshIconButton";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchFriendList,
  fetchGroupList,
  fetchInstances,
  fetchRequestOverview,
  postRequestAction,
  postRequestActionsBatch,
} from "@/api/fullConsole";
import type { BotRow, FriendListData, GroupListData } from "@/api/pallasTypes";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { botPickerRowsFromInstances, botSelectDropdownLabel } from "@/utils/botDisplay";
import { requestOverviewToFriendOverview } from "@/utils/consoleSocialCache";
import { slicePage } from "@/utils/paginate";
import { preserveShellMainScroll } from "@/utils/preserveShellScroll";
import ConsolePagerBar from "@/components/ConsolePagerBar";
import ConsoleTableEdit from "@/components/ConsoleTableEdit";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, {
  CHROME_SEARCH_INPUT,
  CHROME_SELECT_TRIGGER,
  CHROME_TOOLS_TRAILING,
} from "@/components/ChromeTools";
import PageMasthead from "@/components/PageMasthead";
import BotAccountCombobox from "@/components/BotAccountCombobox";
import { useBotFavorites } from "@/hooks/useBotFavorites";
import GroupSocialConfigModal from "@/components/social/GroupSocialConfigModal";
import UserSocialConfigModal from "@/components/social/UserSocialConfigModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Check, ClipboardCheck, Layers, Search, UserPlus, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConsolePrefs } from "@/hooks/useConsolePrefs";

const FG_PANEL = "friends-groups-page__panel flex flex-col overflow-hidden shadow-none";
const FG_PANEL_HD =
  "panel__hd panel__hd--split flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const FG_PANEL_BD = "panel__bd px-4 pb-4 pt-3";
const FG_SECTION_SEL = "chrome-section-compact-sel h-9 w-auto shrink-0";

const FG_LIST_SKEL_ROWS = 8;

type FgSectionId = "friends" | "groups";
type FgApproveAction = "approve-selected" | "reject-selected" | "approve-all";

const FG_SECTIONS: Array<{ id: FgSectionId; label: string; icon: LucideIcon }> = [
  { id: "friends", label: "好友", icon: Users },
  { id: "groups", label: "群聊", icon: Users },
];

function sectionFromHash(hash: string): FgSectionId | null {
  const id = hash.replace(/^#/, "").trim();
  if (id === "fg-friends" || id === "friends-groups-friend-requests") return "friends";
  if (id === "fg-groups" || id === "friends-groups-group-requests") return "groups";
  return null;
}

function listNeedle(raw: string): string {
  return raw.trim().toLowerCase();
}

function rowMatchesNeedle(
  needle: string,
  parts: Array<string | number | null | undefined>,
): boolean {
  if (!needle) return true;
  return parts.some((p) => String(p ?? "").toLowerCase().includes(needle));
}

function friendSourceLabel(source: string): string {
  if (source === "pending") return "待确认";
  if (source === "doubt") return "被过滤";
  return source;
}

function groupRequestSubTypeLabel(subType: string): string {
  const raw = subType.trim();
  const k = raw.toLowerCase();
  const map: Record<string, string> = {
    invite: "邀请入群",
    add: "主动申请",
  };
  if (map[k]) return map[k];
  if (!raw) return "—";
  return `其他（${raw}）`;
}

function friendReqKey(row: { self_id: string; source: string; user_id: number }): string {
  return `${row.self_id}\t${row.source}\t${row.user_id}`;
}

function groupReqKey(row: { self_id: string; group_id: number; user_id: number }): string {
  return `${row.self_id}\t${row.group_id}\t${row.user_id}`;
}

export default function FriendsGroupsPage() {
  const prefs = useConsolePrefs();
  const location = useLocation();
  const navigate = useNavigate();
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<FgSectionId>(
    () => sectionFromHash(typeof window !== "undefined" ? window.location.hash : "") ?? "friends",
  );
  const [selfIdStr, setSelfIdStr] = useState("");
  const [friendListQ, setFriendListQ] = useState("");
  const [groupListQ, setGroupListQ] = useState("");
  const [pageFriendReq, setPageFriendReq] = useState(1);
  const [pageGroupReq, setPageGroupReq] = useState(1);
  const [pageFriends, setPageFriends] = useState(1);
  const [pageGroups, setPageGroups] = useState(1);
  const [pickedFriendKeys, setPickedFriendKeys] = useState<Set<string>>(() => new Set());
  const [pickedGroupKeys, setPickedGroupKeys] = useState<Set<string>>(() => new Set());
  const [approveSelectKey, setApproveSelectKey] = useState(0);
  const [groupModal, setGroupModal] = useState<{ id: number; name: string } | null>(null);
  const [userModal, setUserModal] = useState<{ id: number; nickname: string } | null>(null);

  const { favorites } = useBotFavorites();
  const instQ = useQuery({ queryKey: ["instances"], queryFn: () => fetchInstances() });
  const instances = instQ.data ?? null;
  const botsVisible = useMemo(
    () => botPickerRowsFromInstances(instances, favorites),
    [instances, favorites],
  );


  const selfIdNum = useMemo(() => {
    const n = parseInt(selfIdStr, 10);
    return Number.isFinite(n) ? n : null;
  }, [selfIdStr]);

  const friendsQ = useQuery({
    queryKey: ["friend-list", selfIdStr],
    queryFn: () => fetchFriendList(selfIdNum!),
    enabled: selfIdNum != null,
  });
  const groupsQ = useQuery({
    queryKey: ["group-list", selfIdStr],
    queryFn: () => fetchGroupList(selfIdNum!),
    enabled: selfIdNum != null,
  });
  const reqQ = useQuery({
    queryKey: ["request-overview", selfIdStr],
    queryFn: () => fetchRequestOverview({ selfId: selfIdNum! }),
    enabled: selfIdNum != null,
  });

  const listsBusy = friendsQ.isFetching || groupsQ.isFetching;
  const reqsBusy = reqQ.isFetching;
  const pageRefreshBusy = busy || listsBusy || reqsBusy;
  const fgListsSkeleton =
    Boolean(selfIdStr.trim()) &&
    (listsBusy || !friendsQ.isFetched || !groupsQ.isFetched) &&
    !(friendsQ.data && groupsQ.data);

  const friends = friendsQ.data as FriendListData | undefined;
  const groups = groupsQ.data as GroupListData | undefined;
  const requests = useMemo(
    () => (reqQ.data ? requestOverviewToFriendOverview(reqQ.data) : null),
    [reqQ.data],
  );
  const overview = reqQ.data ?? null;

  function profileNick(selfId: string): string {
    return instances?.bot_profiles?.[selfId]?.nickname?.trim() || "";
  }

  function botOptionTitle(b: BotRow): string {
    return botSelectDropdownLabel(profileNick(b.self_id), b.self_id);
  }

  const filteredFriends = useMemo(() => {
    const needle = listNeedle(friendListQ);
    const rows = friends?.friends ?? [];
    if (!needle) return rows;
    return rows.filter((f) => rowMatchesNeedle(needle, [f.user_id, f.nickname, f.remark]));
  }, [friends, friendListQ]);

  const filteredGroups = useMemo(() => {
    const needle = listNeedle(groupListQ);
    const rows = groups?.groups ?? [];
    if (!needle) return rows;
    return rows.filter((g) =>
      rowMatchesNeedle(needle, [g.group_id, g.group_name, g.member_count, g.max_member_count]),
    );
  }, [groups, groupListQ]);

  const requestRows = useMemo(() => {
    const out: Array<{
      self_id: string;
      source: "pending" | "doubt";
      user_id: number;
      nickname?: string | null;
    }> = [];
    for (const b of requests?.bots ?? []) {
      for (const p of b.pending_friend_requests ?? []) {
        out.push({ self_id: b.self_id, source: "pending", user_id: p.user_id, nickname: p.nickname });
      }
      for (const d of b.doubt_friend_requests ?? []) {
        out.push({ self_id: b.self_id, source: "doubt", user_id: d.user_id, nickname: d.nickname });
      }
    }
    return out.filter((r) => Boolean(selfIdStr.trim()) && r.self_id === selfIdStr);
  }, [requests, selfIdStr]);

  const groupRequestRows = useMemo(() => {
    const out: Array<{
      self_id: string;
      group_id: number;
      user_id: number;
      comment: string;
      sub_type: string;
    }> = [];
    for (const b of overview?.bots ?? []) {
      for (const g of b.pending_group_requests ?? []) {
        out.push({
          self_id: b.self_id,
          group_id: g.group_id,
          user_id: g.user_id,
          comment: g.comment,
          sub_type: g.sub_type,
        });
      }
    }
    return out.filter((r) => Boolean(selfIdStr.trim()) && r.self_id === selfIdStr);
  }, [overview, selfIdStr]);

  const allFriendKeys = useMemo(() => requestRows.map(friendReqKey), [requestRows]);
  const allGroupKeys = useMemo(() => groupRequestRows.map(groupReqKey), [groupRequestRows]);
  const allFriendsPicked =
    allFriendKeys.length > 0 && allFriendKeys.every((k) => pickedFriendKeys.has(k));
  const someFriendsPicked = pickedFriendKeys.size > 0 && !allFriendsPicked;
  const allGroupsPicked =
    allGroupKeys.length > 0 && allGroupKeys.every((k) => pickedGroupKeys.has(k));
  const someGroupsPicked = pickedGroupKeys.size > 0 && !allGroupsPicked;

  const pagedRequestRows = useMemo(
    () => slicePage(requestRows, pageFriendReq, prefs.tablePageSize),
    [requestRows, pageFriendReq, prefs.tablePageSize],
  );
  const pagedGroupRequestRows = useMemo(
    () => slicePage(groupRequestRows, pageGroupReq, prefs.tablePageSize),
    [groupRequestRows, pageGroupReq, prefs.tablePageSize],
  );
  const pagedFriends = useMemo(
    () => slicePage(filteredFriends, pageFriends, prefs.tablePageSize),
    [filteredFriends, pageFriends, prefs.tablePageSize],
  );
  const pagedGroups = useMemo(
    () => slicePage(filteredGroups, pageGroups, prefs.tablePageSize),
    [filteredGroups, pageGroups, prefs.tablePageSize],
  );

  useEffect(() => {
    setPageFriendReq(1);
    setPageGroupReq(1);
    setPageFriends(1);
    setPageGroups(1);
    setPickedFriendKeys(new Set());
    setPickedGroupKeys(new Set());
  }, [selfIdStr, friendListQ, groupListQ, prefs.tablePageSize]);

  useEffect(() => {
    const allowed = new Set(requestRows.map(friendReqKey));
    setPickedFriendKeys((prev) => new Set([...prev].filter((k) => allowed.has(k))));
  }, [requestRows]);

  useEffect(() => {
    const allowed = new Set(groupRequestRows.map(groupReqKey));
    setPickedGroupKeys((prev) => new Set([...prev].filter((k) => allowed.has(k))));
  }, [groupRequestRows]);

  useEffect(() => {
    const fromHash = sectionFromHash(location.hash);
    if (fromHash && fromHash !== section) setSection(fromHash);
  }, [location.hash]);

  function selectSection(id: FgSectionId) {
    preserveShellMainScroll(() => {
      setSection(id);
      const nextHash = id === "friends" ? "#fg-friends" : "#fg-groups";
      if (location.hash !== nextHash) {
        navigate({ pathname: location.pathname, search: location.search, hash: nextHash }, { replace: true });
      }
    });
  }

  function displayFriendReqNickname(row: { user_id: number; nickname?: string | null }): string {
    const fromApi = row.nickname?.trim();
    if (fromApi) return fromApi;
    if (friends && friends.self_id === selfIdStr) {
      const hit = friends.friends?.find((f) => f.user_id === row.user_id);
      const n = hit?.nickname?.trim();
      if (n) return n;
    }
    return `QQ ${row.user_id}`;
  }

  async function refreshPage() {
    setErr("");
    await instQ.refetch();
    if (selfIdStr.trim()) {
      await Promise.all([friendsQ.refetch(), groupsQ.refetch(), reqQ.refetch()]);
    }
  }

  async function actFriend(
    targetSelf: string,
    userId: number,
    action: "approve" | "reject",
    source: "pending" | "doubt",
  ) {
    const sid = parseInt(targetSelf, 10);
    if (!Number.isFinite(sid)) return;
    setBusy(true);
    setErr("");
    try {
      await postRequestAction({ self_id: sid, kind: "friend", action, source, user_id: userId });
      const k = friendReqKey({ self_id: targetSelf, source, user_id: userId });
      setPickedFriendKeys((prev) => {
        const ns = new Set(prev);
        ns.delete(k);
        return ns;
      });
      await reqQ.refetch();
    } catch (e) {
      setErr(axiosErrorDetail(e));
    } finally {
      setBusy(false);
    }
  }

  async function actGroup(
    targetSelf: string,
    userId: number,
    groupId: number,
    action: "approve" | "reject",
  ) {
    const sid = parseInt(targetSelf, 10);
    if (!Number.isFinite(sid)) return;
    setBusy(true);
    setErr("");
    try {
      await postRequestAction({
        self_id: sid,
        kind: "group",
        action,
        source: "pending",
        user_id: userId,
        group_id: groupId,
      });
      const k = groupReqKey({ self_id: targetSelf, group_id: groupId, user_id: userId });
      setPickedGroupKeys((prev) => {
        const ns = new Set(prev);
        ns.delete(k);
        return ns;
      });
      await reqQ.refetch();
    } catch (e) {
      setErr(axiosErrorDetail(e));
    } finally {
      setBusy(false);
    }
  }

  async function actFriendBatch(
    rows: typeof requestRows,
    action: "approve" | "reject",
  ) {
    if (!rows.length) return;
    setBusy(true);
    setErr("");
    try {
      const payload = rows
        .map((row) => {
          const sid = parseInt(row.self_id, 10);
          if (!Number.isFinite(sid)) return null;
          return { self_id: sid, user_id: row.user_id, source: row.source };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);
      if (!payload.length) return;
      const r = await postRequestActionsBatch({ action, friends: payload, groups: [] });
      setPickedFriendKeys(new Set());
      await reqQ.refetch();
      if (r.friends_fail > 0) {
        setErr(`好友申请 部分失败（成功 ${r.friends_ok} / 失败 ${r.friends_fail}）`);
      }
    } catch (e) {
      setErr(axiosErrorDetail(e));
    } finally {
      setBusy(false);
    }
  }

  async function actGroupBatch(
    rows: typeof groupRequestRows,
    action: "approve" | "reject",
  ) {
    if (!rows.length) return;
    setBusy(true);
    setErr("");
    try {
      const payload = rows
        .map((row) => {
          const sid = parseInt(row.self_id, 10);
          if (!Number.isFinite(sid)) return null;
          return { self_id: sid, user_id: row.user_id, group_id: row.group_id };
        })
        .filter((x): x is NonNullable<typeof x> => x != null);
      if (!payload.length) return;
      const r = await postRequestActionsBatch({ action, friends: [], groups: payload });
      setPickedGroupKeys(new Set());
      await reqQ.refetch();
      if (r.groups_fail > 0) {
        setErr(`入群请求 部分失败（成功 ${r.groups_ok} / 失败 ${r.groups_fail}）`);
      }
    } catch (e) {
      setErr(axiosErrorDetail(e));
    } finally {
      setBusy(false);
    }
  }

  function runApproveAction(action: FgApproveAction) {
    if (section === "friends") {
      if (action === "approve-selected") {
        void actFriendBatch(
          requestRows.filter((r) => pickedFriendKeys.has(friendReqKey(r))),
          "approve",
        );
      } else if (action === "reject-selected") {
        void actFriendBatch(
          requestRows.filter((r) => pickedFriendKeys.has(friendReqKey(r))),
          "reject",
        );
      } else {
        void actFriendBatch([...requestRows], "approve");
      }
      return;
    }
    if (action === "approve-selected") {
      void actGroupBatch(
        groupRequestRows.filter((r) => pickedGroupKeys.has(groupReqKey(r))),
        "approve",
      );
    } else if (action === "reject-selected") {
      void actGroupBatch(
        groupRequestRows.filter((r) => pickedGroupKeys.has(groupReqKey(r))),
        "reject",
      );
    } else {
      void actGroupBatch([...groupRequestRows], "approve");
    }
  }

  const offlineFriendMsg =
    selfIdNum != null && !accountHasNonebotBot(instances?.nonebot_bots, selfIdNum)
      ? "当前账号未在消息框架上线，无法拉取好友列表。请在「数据库实例」确认协议端已接入后再试。"
      : null;
  const offlineGroupMsg =
    selfIdNum != null && !accountHasNonebotBot(instances?.nonebot_bots, selfIdNum)
      ? "当前账号未在消息框架上线，无法拉取群列表。请在「数据库实例」确认协议端已接入后再试。"
      : null;

  const sectionMeta = FG_SECTIONS.find((s) => s.id === section) ?? FG_SECTIONS[0];
  const pickedApproveCount =
    section === "friends" ? pickedFriendKeys.size : pickedGroupKeys.size;
  const approveRowCount = section === "friends" ? requestRows.length : groupRequestRows.length;
  const listSearch =
    section === "friends"
      ? {
          value: friendListQ,
          onChange: (v: string) => {
            setFriendListQ(v);
            setPageFriends(1);
          },
          placeholder: "搜索好友…",
          title: "按 QQ、昵称、备注筛选当前列表",
        }
      : {
          value: groupListQ,
          onChange: (v: string) => {
            setGroupListQ(v);
            setPageGroups(1);
          },
          placeholder: "搜索群聊…",
          title: "按群号、群名、成员数筛选当前列表",
        };

  return (
    <div className="friends-groups-page console-hub-page flex min-w-0 flex-col">
      {err ? <div className="alert alert--err">{err}</div> : null}
      {ok ? <div className="alert alert--ok">{ok}</div> : null}

      <PageMasthead
        title="好友与群聊"
        description="好友、群聊与申请审批。"
        actions={
          <ChromeField label="账号" icon={Bot} className="shrink-0">
            <BotAccountCombobox
              value={selfIdStr || "__none__"}
              onValueChange={(v) => {
                setSelfIdStr(v === "__none__" ? "" : v);
                setFriendListQ("");
                setGroupListQ("");
              }}
              bots={botsVisible.map((b) => ({
                id: b.self_id,
                nickname: profileNick(b.self_id),
              }))}
              favorites={favorites}
              leadingOption={{ value: "__none__", label: "请选择 Bot…", keywords: "请选择 Bot" }}
              placeholder="请选择 Bot…"
              title={
                selfIdStr
                  ? (() => {
                      const cur = botsVisible.find((b) => b.self_id === selfIdStr);
                      return cur ? botOptionTitle(cur) : selfIdStr;
                    })()
                  : undefined
              }
            />
          </ChromeField>
        }
      />

      <ChromeTools sticky>
        <ChromeField label="选择" icon={Layers} className="shrink-0">
          <Select value={section} onValueChange={(v) => selectSection(v as FgSectionId)}>
            <SelectTrigger className={FG_SECTION_SEL} aria-label="好友或群聊">
              <SelectValue placeholder="选择">
                <ChromeOptionLabel icon={sectionMeta.icon}>{sectionMeta.label}</ChromeOptionLabel>
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              {FG_SECTIONS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <ChromeOptionLabel icon={s.icon}>{s.label}</ChromeOptionLabel>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ChromeField>

        <div className="relative min-w-[8rem] flex-1 basis-[8rem]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <Input
            type="search"
            className={CHROME_SEARCH_INPUT}
            placeholder={listSearch.placeholder}
            title={listSearch.title}
            aria-label={listSearch.placeholder}
            autoComplete="off"
            value={listSearch.value}
            disabled={Boolean(selfIdStr.trim()) && fgListsSkeleton}
            onChange={(e) => listSearch.onChange(e.target.value)}
          />
        </div>

        <div className={CHROME_TOOLS_TRAILING}>
          <ChromeField label="审批" icon={ClipboardCheck} className="shrink-0">
            <Select
              key={approveSelectKey}
              onValueChange={(v) => {
                runApproveAction(v as FgApproveAction);
                setApproveSelectKey((k) => k + 1);
              }}
            >
              <SelectTrigger
                className={CHROME_SELECT_TRIGGER}
                aria-label="审批操作"
                disabled={busy || !selfIdStr.trim()}
              >
                <SelectValue
                  placeholder={
                    pickedApproveCount > 0 ? `审批（${pickedApproveCount}）` : "审批操作"
                  }
                />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="approve-selected" disabled={pickedApproveCount === 0 || busy}>
                  同意所选
                </SelectItem>
                <SelectItem value="reject-selected" disabled={pickedApproveCount === 0 || busy}>
                  拒绝所选
                </SelectItem>
                <SelectItem value="approve-all" disabled={approveRowCount === 0 || busy}>
                  全部同意
                </SelectItem>
              </SelectContent>
            </Select>
          </ChromeField>
          <RefreshIconButton
            busy={pageRefreshBusy}
            label="刷新"
            showLabel
            onClick={() => void refreshPage()}
          />
        </div>
      </ChromeTools>

      {section === "friends" ? (
        <>
          <Card id="fg-friends" className={FG_PANEL}>
            <CardHeader className={FG_PANEL_HD}>
              <CardTitle className="panel__title flex items-center gap-1.5">
                <PanelTitleIcon icon={Users} />
                好友列表
                {selfIdStr && listsBusy ? (
                  <span className="muted text-xs font-normal">列表加载中…</span>
                ) : friends?.truncated ? (
                  <Badge variant="secondary">已截断</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className={FG_PANEL_BD}>
              {!selfIdStr.trim() ? (
                <p className="muted m-0">请选择 Bot 后加载好友列表。</p>
              ) : fgListsSkeleton ? (
                <div className="fg-table-skel" aria-busy="true" aria-label="好友列表加载中">
                  <div className="table-wrap">
                    <table className="data console-data-table">
                      <thead>
                        <tr>
                          <th>QQ</th>
                          <th>昵称</th>
                          <th>备注</th>
                          <th style={{ minWidth: 88, width: "1%" }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: FG_LIST_SKEL_ROWS }, (_, i) => (
                          <tr key={`fs-${i}`}>
                            <td>
                              <div className="fg-table-skel__bar skel-pulse" />
                            </td>
                            <td>
                              <div className="fg-table-skel__bar fg-table-skel__bar--mid skel-pulse" />
                            </td>
                            <td>
                              <div className="fg-table-skel__bar fg-table-skel__bar--short skel-pulse" />
                            </td>
                            <td>
                              <div className="fg-table-skel__bar fg-table-skel__bar--tiny skel-pulse" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : friends?.error || offlineFriendMsg ? (
                <p className="alert alert--err">{friends?.error || offlineFriendMsg}</p>
              ) : !filteredFriends.length ? (
                <p className="muted">
                  {friendListQ.trim() && (friends?.friends?.length ?? 0) > 0 ? "无匹配结果。" : "暂无数据。"}
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data console-data-table">
                    <thead>
                      <tr>
                        <th>QQ</th>
                        <th>昵称</th>
                        <th>备注</th>
                        <th style={{ minWidth: 88, width: "1%" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedFriends.map((f) => (
                        <tr key={f.user_id}>
                          <td>{f.user_id}</td>
                          <td>{f.nickname}</td>
                          <td className="muted">{f.remark}</td>
                          <td>
                            <ConsoleTableEdit
                              onClick={() => {
                                setOk("");
                                setUserModal({
                                  id: f.user_id,
                                  nickname: f.nickname || f.remark || "",
                                });
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!fgListsSkeleton && filteredFriends.length > 0 ? (
                <ConsolePagerBar
                  page={pageFriends}
                  pageSize={prefs.tablePageSize}
                  total={filteredFriends.length}
                  onPageChange={setPageFriends}
                  onPageSizeChange={prefs.setTablePageSize}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card id="friends-groups-friend-requests" className={FG_PANEL}>
            <CardHeader className={FG_PANEL_HD}>
              <CardTitle className="panel__title flex items-center gap-1.5">
                <PanelTitleIcon icon={UserPlus} />
                好友申请
                {reqsBusy ? (
                  <span className="muted text-xs font-normal">审批数据加载中…</span>
                ) : requestRows.length ? (
                  <Badge variant="secondary">{requestRows.length} 条</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className={FG_PANEL_BD}>
              {reqsBusy || (Boolean(selfIdStr.trim()) && !reqQ.isFetched) ? (
                <p className="muted">
                  {listsBusy
                    ? "正在加载好友/群列表，随后拉取审批数据…"
                    : "正在拉取好友申请、可疑请求与入群审批；也可点击工具条刷新重试。"}
                </p>
              ) : !selfIdStr.trim() ? (
                <p className="muted">请选择 Bot 后查看与处理本账号的好友申请。</p>
              ) : !requestRows.length ? (
                <p className="muted">暂无待处理申请。</p>
              ) : (
                <div className="table-wrap">
                  <table className="data console-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 44 }}>
                          <input
                            type="checkbox"
                            title="全选当前筛选下的全部好友申请"
                            checked={allFriendsPicked}
                            ref={(el) => {
                              if (el) el.indeterminate = someFriendsPicked;
                            }}
                            disabled={!requestRows.length || busy}
                            onChange={(e) =>
                              setPickedFriendKeys(
                                e.target.checked ? new Set(allFriendKeys) : new Set(),
                              )
                            }
                          />
                        </th>
                        <th>用户 QQ</th>
                        <th>用户昵称</th>
                        <th>来源</th>
                        <th style={{ minWidth: 108, width: "1%" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRequestRows.map((row) => (
                        <tr key={friendReqKey(row)}>
                          <td>
                            <input
                              type="checkbox"
                              checked={pickedFriendKeys.has(friendReqKey(row))}
                              disabled={busy}
                              onChange={(e) => {
                                const k = friendReqKey(row);
                                setPickedFriendKeys((prev) => {
                                  const ns = new Set(prev);
                                  if (e.target.checked) ns.add(k);
                                  else ns.delete(k);
                                  return ns;
                                });
                              }}
                            />
                          </td>
                          <td>{row.user_id}</td>
                          <td>{displayFriendReqNickname(row)}</td>
                          <td>{friendSourceLabel(row.source)}</td>
                          <td>
                            <div className="friends-req-actions">
                              <Button
                                type="button"
                                size="sm"
                                icon={Check}
                                iconMotion="scale"
                                disabled={busy}
                                onClick={() => void actFriend(row.self_id, row.user_id, "approve", row.source)}
                              >
                                同意
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                icon={X}
                                iconMotion="close"
                                disabled={busy}
                                onClick={() => void actFriend(row.self_id, row.user_id, "reject", row.source)}
                              >
                                拒绝
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {requestRows.length > 0 ? (
                <ConsolePagerBar
                  page={pageFriendReq}
                  pageSize={prefs.tablePageSize}
                  total={requestRows.length}
                  onPageChange={setPageFriendReq}
                  onPageSizeChange={prefs.setTablePageSize}
                />
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card id="fg-groups" className={FG_PANEL}>
            <CardHeader className={FG_PANEL_HD}>
              <CardTitle className="panel__title flex items-center gap-1.5">
                <PanelTitleIcon icon={Users} />
                群聊列表
                {selfIdStr && listsBusy ? (
                  <span className="muted text-xs font-normal">列表加载中…</span>
                ) : groups?.truncated ? (
                  <Badge variant="secondary">已截断 · limit {groups?.limit}</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className={FG_PANEL_BD}>
              {!selfIdStr.trim() ? (
                <p className="muted m-0">请选择 Bot 后加载群聊列表。</p>
              ) : fgListsSkeleton ? (
                <div className="fg-table-skel" aria-busy="true" aria-label="群聊列表加载中">
                  <div className="table-wrap">
                    <table className="data console-data-table">
                      <thead>
                        <tr>
                          <th>群号</th>
                          <th>群名</th>
                          <th>成员</th>
                          <th style={{ minWidth: 88, width: "1%" }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: FG_LIST_SKEL_ROWS }, (_, i) => (
                          <tr key={`gs-${i}`}>
                            <td>
                              <div className="fg-table-skel__bar fg-table-skel__bar--narrow skel-pulse" />
                            </td>
                            <td>
                              <div className="fg-table-skel__bar fg-table-skel__bar--mid skel-pulse" />
                            </td>
                            <td>
                              <div className="fg-table-skel__bar fg-table-skel__bar--tiny skel-pulse" />
                            </td>
                            <td>
                              <div className="fg-table-skel__bar fg-table-skel__bar--tiny skel-pulse" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : groups?.error || offlineGroupMsg ? (
                <p className="alert alert--err">{groups?.error || offlineGroupMsg}</p>
              ) : !filteredGroups.length ? (
                <p className="muted">
                  {groupListQ.trim() && (groups?.groups?.length ?? 0) > 0 ? "无匹配结果。" : "暂无数据。"}
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data console-data-table">
                    <thead>
                      <tr>
                        <th>群号</th>
                        <th>群名</th>
                        <th>成员</th>
                        <th style={{ minWidth: 88, width: "1%" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedGroups.map((g) => (
                        <tr key={g.group_id}>
                          <td>{g.group_id}</td>
                          <td>{g.group_name}</td>
                          <td>{g.member_count}</td>
                          <td>
                            <ConsoleTableEdit
                              onClick={() => {
                                setOk("");
                                setGroupModal({ id: g.group_id, name: g.group_name || "" });
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!fgListsSkeleton && filteredGroups.length > 0 ? (
                <ConsolePagerBar
                  page={pageGroups}
                  pageSize={prefs.tablePageSize}
                  total={filteredGroups.length}
                  onPageChange={setPageGroups}
                  onPageSizeChange={prefs.setTablePageSize}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card id="friends-groups-group-requests" className={FG_PANEL}>
            <CardHeader className={FG_PANEL_HD}>
              <CardTitle className="panel__title flex items-center gap-1.5">
                <PanelTitleIcon icon={UserPlus} />
                入群请求
                {reqsBusy ? (
                  <span className="muted text-xs font-normal">审批数据加载中…</span>
                ) : groupRequestRows.length ? (
                  <Badge variant="secondary">{groupRequestRows.length} 条</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className={FG_PANEL_BD}>
              {reqsBusy || (Boolean(selfIdStr.trim()) && !reqQ.isFetched) ? (
                <p className="muted">正在拉取入群审批与概览，请稍候；也可点击工具条刷新重试。</p>
              ) : !selfIdStr.trim() ? (
                <p className="muted">请选择 Bot 后查看与处理本账号的入群请求。</p>
              ) : !groupRequestRows.length ? (
                <p className="muted">暂无待处理入群请求。</p>
              ) : (
                <div className="table-wrap">
                  <table className="data console-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 44 }}>
                          <input
                            type="checkbox"
                            title="全选当前筛选下的全部入群请求"
                            checked={allGroupsPicked}
                            ref={(el) => {
                              if (el) el.indeterminate = someGroupsPicked;
                            }}
                            disabled={!groupRequestRows.length || busy}
                            onChange={(e) =>
                              setPickedGroupKeys(e.target.checked ? new Set(allGroupKeys) : new Set())
                            }
                          />
                        </th>
                        <th>群号</th>
                        <th>用户 QQ</th>
                        <th>类型</th>
                        <th>备注</th>
                        <th style={{ minWidth: 108, width: "1%" }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedGroupRequestRows.map((row) => (
                        <tr key={groupReqKey(row)}>
                          <td>
                            <input
                              type="checkbox"
                              checked={pickedGroupKeys.has(groupReqKey(row))}
                              disabled={busy}
                              onChange={(e) => {
                                const k = groupReqKey(row);
                                setPickedGroupKeys((prev) => {
                                  const ns = new Set(prev);
                                  if (e.target.checked) ns.add(k);
                                  else ns.delete(k);
                                  return ns;
                                });
                              }}
                            />
                          </td>
                          <td>{row.group_id}</td>
                          <td>{row.user_id}</td>
                          <td className="muted">{groupRequestSubTypeLabel(row.sub_type)}</td>
                          <td className="muted">{row.comment}</td>
                          <td>
                            <div className="friends-req-actions">
                              <Button
                                type="button"
                                size="sm"
                                icon={Check}
                                iconMotion="scale"
                                disabled={busy}
                                onClick={() => void actGroup(row.self_id, row.user_id, row.group_id, "approve")}
                              >
                                同意
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                icon={X}
                                iconMotion="close"
                                disabled={busy}
                                onClick={() => void actGroup(row.self_id, row.user_id, row.group_id, "reject")}
                              >
                                拒绝
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {groupRequestRows.length > 0 ? (
                <ConsolePagerBar
                  page={pageGroupReq}
                  pageSize={prefs.tablePageSize}
                  total={groupRequestRows.length}
                  onPageChange={setPageGroupReq}
                  onPageSizeChange={prefs.setTablePageSize}
                />
              ) : null}
            </CardContent>
          </Card>
        </>
      )}

      <GroupSocialConfigModal
        open={groupModal != null}
        groupId={groupModal?.id ?? null}
        groupName={groupModal?.name}
        onOpenChange={(o) => {
          if (!o) setGroupModal(null);
        }}
        onSaved={() => setOk("群颗粒配置已保存。")}
        onDeleted={() => {
          setOk(
            groupModal?.id != null ? `已删除群配置 ${groupModal.id}` : "已删除群配置",
          );
          setGroupModal(null);
        }}
      />
      <UserSocialConfigModal
        open={userModal != null}
        userId={userModal?.id ?? null}
        userNickname={userModal?.nickname}
        onOpenChange={(o) => {
          if (!o) setUserModal(null);
        }}
        onSaved={() => setOk("用户颗粒配置已保存。")}
        onDeleted={() => {
          setOk(
            userModal?.id != null ? `已删除好友配置 ${userModal.id}` : "已删除好友配置",
          );
          setUserModal(null);
        }}
      />
    </div>
  );
}
