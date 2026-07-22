import { useEffect, useMemo, useState } from "react";
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
import type { BotRow, FriendListData, GroupListData } from "@pallas-vue/api/pallasTypes";
import { accountHasNonebotBot } from "@pallas-vue/utils/botConnection";
import { botPickerRowsFromInstances } from "@pallas-vue/utils/botDisplay";
import { requestOverviewToFriendOverview } from "@pallas-vue/utils/consoleSocialCache";
import { slicePage } from "@pallas-vue/utils/paginate";
import ConsolePagerBar from "@/components/ConsolePagerBar";
import ConsoleTableEdit from "@/components/ConsoleTableEdit";
import PageHeader from "@/components/PageHeader";
import PanelHdCollapseCaret from "@/components/PanelHdCollapseCaret";
import GroupSocialConfigModal from "@/components/social/GroupSocialConfigModal";
import UserSocialConfigModal from "@/components/social/UserSocialConfigModal";
import { useConsolePrefs } from "@/hooks/useConsolePrefs";

const FG_LIST_SKEL_ROWS = 8;

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
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [selfIdStr, setSelfIdStr] = useState("");
  const [friendListQ, setFriendListQ] = useState("");
  const [groupListQ, setGroupListQ] = useState("");
  const [pageFriendReq, setPageFriendReq] = useState(1);
  const [pageGroupReq, setPageGroupReq] = useState(1);
  const [pageFriends, setPageFriends] = useState(1);
  const [pageGroups, setPageGroups] = useState(1);
  const [pickedFriendKeys, setPickedFriendKeys] = useState<Set<string>>(() => new Set());
  const [pickedGroupKeys, setPickedGroupKeys] = useState<Set<string>>(() => new Set());
  const [groupModal, setGroupModal] = useState<{ id: number; name: string } | null>(null);
  const [userModal, setUserModal] = useState<{ id: number; nickname: string } | null>(null);

  const instQ = useQuery({ queryKey: ["instances"], queryFn: () => fetchInstances() });
  const instances = instQ.data ?? null;
  const botsVisible = useMemo(() => botPickerRowsFromInstances(instances), [instances]);

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
  const fgListsSkeleton = Boolean(selfIdStr.trim()) && listsBusy;

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

  function botOptionLabel(b: BotRow): string {
    const nick = profileNick(b.self_id);
    if (nick) return `${nick}（${b.self_id}）`;
    return b.self_id;
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

  const offlineFriendMsg =
    selfIdNum != null && !accountHasNonebotBot(instances?.nonebot_bots, selfIdNum)
      ? "当前账号未在消息框架上线，无法拉取好友列表。请在「数据库实例」确认协议端已接入后再试。"
      : null;
  const offlineGroupMsg =
    selfIdNum != null && !accountHasNonebotBot(instances?.nonebot_bots, selfIdNum)
      ? "当前账号未在消息框架上线，无法拉取群列表。请在「数据库实例」确认协议端已接入后再试。"
      : null;

  return (
    <div className="friends-groups-page console-hub-page">
      {err ? <div className="alert alert--err">{err}</div> : null}
      {ok ? <div className="alert alert--ok">{ok}</div> : null}

      <PageHeader
        title="好友与群聊"
        description="选择账号查看好友、群聊与入群/好友申请。"
        actions={
          <RefreshIconButton embedded className="hub-refresh-wide-only" busy={pageRefreshBusy} label="刷新" onClick={() => void refreshPage()} />
        }
      />

      <section id="fg-account" className="panel friends-groups-page__panel friends-groups-account-panel">
        <div className="panel__hd panel__hd--flush friends-groups-account-panel__hd">
          <h2 className="panel__title">
            当前账号
            <RefreshIconButton embedded className="hub-refresh-narrow-only" showLabel={false} busy={pageRefreshBusy} label="刷新本页数据" onClick={() => void refreshPage()} />
          </h2>
          <div className="friends-groups-account-hd-tail">
            <span className="friends-groups-hd-pin-wrap friends-groups-account-hd-pin-wrap" />
            <select
              className="sel friends-groups-account-sel"
              value={selfIdStr}
              onChange={(e) => {
                setSelfIdStr(e.target.value);
                setFriendListQ("");
                setGroupListQ("");
              }}
            >
              <option value="">请选择 Bot…</option>
              {botsVisible.map((b) => (
                <option key={b.self_id} value={b.self_id}>
                  {botOptionLabel(b)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section id="fg-friends" className="panel friends-groups-page__panel">
        <div className="panel__hd panel__hd--split">
          <h2 className="panel__title">
            好友列表
            <PanelHdCollapseCaret
              expanded={prefs.friendsPageFriendsListOpen}
              label="好友列表"
              onToggle={() => prefs.setFriendsPageFriendsListOpen(!prefs.friendsPageFriendsListOpen)}
            />
          </h2>
          <div className="row-actions friends-groups-list-hd-actions">
            <span className="friends-groups-hd-pin-wrap" />
            <input
              className="inp friends-groups-list-search"
              type="search"
              placeholder="搜索 QQ / 昵称 / 备注"
              title="按 QQ、昵称、备注筛选当前列表"
              value={friendListQ}
              disabled={!selfIdStr.trim() || fgListsSkeleton}
              onChange={(e) => setFriendListQ(e.target.value)}
            />
            <div className="friends-groups-list-hd-actions__tail">
              {selfIdStr && listsBusy ? (
                <span className="muted" style={{ fontSize: 12 }}>
                  列表加载中…
                </span>
              ) : friends?.truncated ? (
                <span className="badge badge--warn">已截断</span>
              ) : null}
            </div>
          </div>
        </div>
        {prefs.friendsPageFriendsListOpen ? (
          <div className="panel__bd">
            {!selfIdStr.trim() ? (
              <p className="muted" style={{ margin: 0 }}>
                请选择 Bot 后加载好友列表。
              </p>
            ) : fgListsSkeleton ? (
              <div className="fg-table-skel" aria-busy="true" aria-label="好友列表加载中">
                <div className="table-wrap">
                  <table className="data console-data-table">
                    <thead>
                      <tr>
                        <th>QQ</th>
                        <th>昵称</th>
                        <th>备注</th>
                        <th style={{ minWidth: 88, width: "1%" }}>
                          操作
                        </th>
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
                      <th style={{ minWidth: 88, width: "1%" }}>
                        操作
                      </th>
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
          </div>
        ) : null}
      </section>

      <section id="fg-groups" className="panel friends-groups-page__panel">
        <div className="panel__hd panel__hd--split">
          <h2 className="panel__title">
            群聊列表
            <PanelHdCollapseCaret
              expanded={prefs.friendsPageGroupsListOpen}
              label="群聊列表"
              onToggle={() => prefs.setFriendsPageGroupsListOpen(!prefs.friendsPageGroupsListOpen)}
            />
          </h2>
          <div className="row-actions friends-groups-list-hd-actions">
            <span className="friends-groups-hd-pin-wrap" />
            <input
              className="inp friends-groups-list-search"
              type="search"
              placeholder="搜索群号 / 群名"
              title="按群号、群名、成员数筛选当前列表"
              value={groupListQ}
              disabled={!selfIdStr.trim() || fgListsSkeleton}
              onChange={(e) => setGroupListQ(e.target.value)}
            />
            <div className="friends-groups-list-hd-actions__tail">
              {selfIdStr && listsBusy ? (
                <span className="muted" style={{ fontSize: 12 }}>
                  列表加载中…
                </span>
              ) : groups?.truncated ? (
                <span className="badge badge--warn">
                  已截断 · limit {groups?.limit}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {prefs.friendsPageGroupsListOpen ? (
          <div className="panel__bd">
            {!selfIdStr.trim() ? (
              <p className="muted" style={{ margin: 0 }}>
                请选择 Bot 后加载群聊列表。
              </p>
            ) : fgListsSkeleton ? (
              <div className="fg-table-skel" aria-busy="true" aria-label="群聊列表加载中">
                <div className="table-wrap">
                  <table className="data console-data-table">
                    <thead>
                      <tr>
                        <th>群号</th>
                        <th>群名</th>
                        <th>成员</th>
                        <th style={{ minWidth: 88, width: "1%" }}>
                          操作
                        </th>
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
                      <th style={{ minWidth: 88, width: "1%" }}>
                        操作
                      </th>
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
          </div>
        ) : null}
      </section>

      <section id="friends-groups-friend-requests" className="panel friends-groups-page__panel">
        <div className="panel__hd panel__hd--split">
          <h2 className="panel__title">
            好友申请
            <RefreshIconButton embedded showLabel={false} busy={reqsBusy} label="刷新审批数据" onClick={() => void reqQ.refetch()} />
          </h2>
          <div className="row-actions friends-groups-req-hd-actions">
            <span className="friends-groups-hd-pin-wrap" />
            <div className="friends-groups-req-hd-meta">
              {reqsBusy ? (
                <span className="muted friends-groups-req-hd-meta__hint">审批数据加载中…</span>
              ) : null}
              {requestRows.length ? (
                <span className="badge badge--warn">{requestRows.length} 条</span>
              ) : null}
            </div>
            <div className="friends-groups-req-hd-bulk-btns">
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || pickedFriendKeys.size === 0}
                onClick={() =>
                  void actFriendBatch(
                    requestRows.filter((r) => pickedFriendKeys.has(friendReqKey(r))),
                    "approve",
                  )
                }
              >
                同意所选
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || pickedFriendKeys.size === 0}
                onClick={() =>
                  void actFriendBatch(
                    requestRows.filter((r) => pickedFriendKeys.has(friendReqKey(r))),
                    "reject",
                  )
                }
              >
                拒绝所选
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || !requestRows.length}
                onClick={() => void actFriendBatch([...requestRows], "approve")}
              >
                全部同意
              </button>
            </div>
          </div>
        </div>
        <div className="panel__bd">
          {reqsBusy ? (
            <p className="muted">
              {listsBusy
                ? "正在加载好友/群列表，随后拉取审批数据…"
                : "正在拉取好友申请、可疑请求与入群审批；也可点击标题旁刷新图标重试。"}
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
                    <th style={{ minWidth: 108, width: "1%" }}>
                      操作
                    </th>
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
                          <button
                            type="button"
                            className="btn btn--primary"
                            disabled={busy}
                            onClick={() => void actFriend(row.self_id, row.user_id, "approve", row.source)}
                          >
                            同意
                          </button>
                          <button
                            type="button"
                            className="btn btn--danger"
                            disabled={busy}
                            onClick={() => void actFriend(row.self_id, row.user_id, "reject", row.source)}
                          >
                            拒绝
                          </button>
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
        </div>
      </section>

      <section id="friends-groups-group-requests" className="panel friends-groups-page__panel">
        <div className="panel__hd panel__hd--split">
          <h2 className="panel__title">
            入群请求
            <RefreshIconButton embedded showLabel={false} busy={reqsBusy} label="刷新审批数据" onClick={() => void reqQ.refetch()} />
          </h2>
          <div className="row-actions friends-groups-req-hd-actions">
            <span className="friends-groups-hd-pin-wrap" />
            <div className="friends-groups-req-hd-meta">
              {reqsBusy ? (
                <span className="muted friends-groups-req-hd-meta__hint">审批数据加载中…</span>
              ) : null}
              {groupRequestRows.length ? (
                <span className="badge badge--warn">{groupRequestRows.length} 条</span>
              ) : null}
            </div>
            <div className="friends-groups-req-hd-bulk-btns">
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || pickedGroupKeys.size === 0}
                onClick={() =>
                  void actGroupBatch(
                    groupRequestRows.filter((r) => pickedGroupKeys.has(groupReqKey(r))),
                    "approve",
                  )
                }
              >
                同意所选
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || pickedGroupKeys.size === 0}
                onClick={() =>
                  void actGroupBatch(
                    groupRequestRows.filter((r) => pickedGroupKeys.has(groupReqKey(r))),
                    "reject",
                  )
                }
              >
                拒绝所选
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || !groupRequestRows.length}
                onClick={() => void actGroupBatch([...groupRequestRows], "approve")}
              >
                全部同意
              </button>
            </div>
          </div>
        </div>
        <div className="panel__bd">
          {reqsBusy ? (
            <p className="muted">正在拉取入群审批与概览，请稍候；也可点击标题旁刷新图标重试。</p>
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
                    <th style={{ minWidth: 108, width: "1%" }}>
                      操作
                    </th>
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
                          <button
                            type="button"
                            className="btn btn--primary"
                            disabled={busy}
                            onClick={() => void actGroup(row.self_id, row.user_id, row.group_id, "approve")}
                          >
                            同意
                          </button>
                          <button
                            type="button"
                            className="btn btn--danger"
                            disabled={busy}
                            onClick={() => void actGroup(row.self_id, row.user_id, row.group_id, "reject")}
                          >
                            拒绝
                          </button>
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
        </div>
      </section>

      <GroupSocialConfigModal
        open={groupModal != null}
        groupId={groupModal?.id ?? null}
        groupName={groupModal?.name}
        onOpenChange={(o) => {
          if (!o) setGroupModal(null);
        }}
        onSaved={() => setOk("群颗粒配置已保存。")}
      />
      <UserSocialConfigModal
        open={userModal != null}
        userId={userModal?.id ?? null}
        userNickname={userModal?.nickname}
        onOpenChange={(o) => {
          if (!o) setUserModal(null);
        }}
        onSaved={() => setOk("用户颗粒配置已保存。")}
      />
    </div>
  );
}
