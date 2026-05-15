/**
 * 首页与其它页共享的社交类接口快照，减少重复全量拉取。
 * 命中时用缓存即时渲染，网络请求成功后仍写回缓存。
 */
import type { FriendListData, FriendOverviewData, GroupListData, RequestOverviewData } from "@/api/pallasTypes";

const TTL_MS = 120_000;

type ListsBundle = { friends: FriendListData; groups: GroupListData };

let overviewEntry: { data: RequestOverviewData; ts: number } | null = null;
const listsByBot = new Map<string, ListsBundle & { ts: number }>();

export function requestOverviewToFriendOverview(ov: RequestOverviewData): FriendOverviewData {
  return {
    bots: ov.bots.map((b) => ({
      self_id: b.self_id,
      connection_key: b.connection_key,
      adapter: b.adapter,
      online: b.online,
      pending_friend_requests: b.pending_friend_requests,
      doubt_friend_requests: b.doubt_friend_requests,
    })),
  };
}

export function cachePutRequestOverview(data: RequestOverviewData) {
  overviewEntry = { data, ts: Date.now() };
}

export function cachePutFriendGroupLists(selfId: number | string, friends: FriendListData, groups: GroupListData) {
  listsByBot.set(String(selfId), { friends, groups, ts: Date.now() });
}

export function cacheTryGetRequestOverview(): RequestOverviewData | null {
  if (!overviewEntry || Date.now() - overviewEntry.ts > TTL_MS) return null;
  return overviewEntry.data;
}

export function cacheTryGetFriendGroupLists(selfId: string): ListsBundle | null {
  const e = listsByBot.get(String(selfId));
  if (!e || Date.now() - e.ts > TTL_MS) return null;
  return { friends: e.friends, groups: e.groups };
}
