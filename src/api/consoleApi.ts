import { http } from "./http";
import type {
  UpdateCheckData,
  UpdateApplyData,
  BotUpdateCheckData,
  BotUpdateApplyData,
  ApiOk,
  BotConfigPublic,
  BotRow,
  DbOverviewData,
  FriendListData,
  FriendOverviewData,
  RequestOverviewData,
  GroupConfigPublic,
  GroupListData,
  InstancesData,
  LogsData,
  PluginRow,
  SystemData,
  UserConfigPublic,
  AiExtensionConfig,
  AiExtensionTestData,
  AiExtensionLogsData,
  AiProxyResult,
  HelpMenuVisibilityData,
  PluginConfigData,
  MessageStatsData,
} from "./pallasTypes";

function unwrap<T>(body: ApiOk<T> | (ApiOk<T> & Record<string, unknown>), path: string): T {
  if (!body || typeof body !== "object" || !("ok" in body) || !body.ok) {
    throw new Error(`${path}: 响应异常`);
  }
  return body.data;
}

export async function fetchSystem(): Promise<SystemData> {
  const { data } = await http.get<ApiOk<SystemData>>("/system");
  return unwrap(data, "/system");
}

export async function fetchPlugins(): Promise<PluginRow[]> {
  const { data } = await http.get<ApiOk<PluginRow[]>>("/plugins");
  return unwrap(data, "/plugins");
}

export async function fetchPluginsHelpMenuVisibility(): Promise<HelpMenuVisibilityData> {
  const { data } = await http.get<ApiOk<HelpMenuVisibilityData>>("/plugins/help-menu-visibility");
  return unwrap(data, "/plugins/help-menu-visibility");
}

export async function putPluginsHelpMenuVisibility(hiddenPlugins: string[]): Promise<{ hidden_plugins: string[] }> {
  const { data } = await http.put<ApiOk<{ hidden_plugins: string[] }>>("/plugins/help-menu-visibility", {
    hidden_plugins: hiddenPlugins,
  });
  return unwrap(data, "/plugins/help-menu-visibility");
}

export async function fetchPluginConfig(pluginName: string): Promise<PluginConfigData> {
  const { data } = await http.get<ApiOk<PluginConfigData>>(`/plugins/${encodeURIComponent(pluginName)}/config`);
  return unwrap(data, `/plugins/${pluginName}/config`);
}

export async function putPluginConfig(
  pluginName: string,
  values: Record<string, unknown>,
): Promise<PluginConfigData> {
  const { data } = await http.put<ApiOk<PluginConfigData>>(`/plugins/${encodeURIComponent(pluginName)}/config`, {
    values,
  });
  return unwrap(data, `/plugins/${pluginName}/config`);
}

export async function fetchBots(): Promise<BotRow[]> {
  const { data } = await http.get<ApiOk<BotRow[]>>("/bots");
  return unwrap(data, "/bots");
}

export async function fetchLogs(n: number): Promise<LogsData> {
  const { data } = await http.get<ApiOk<LogsData>>("/logs", { params: { n } });
  return unwrap(data, "/logs");
}

export async function fetchMessageStats(selfId?: number): Promise<MessageStatsData> {
  const { data } = await http.get<ApiOk<MessageStatsData>>("/message-stats", {
    params: selfId ? { self_id: selfId } : {},
  });
  return unwrap(data, "/message-stats");
}

export async function fetchPluginConfigHint(): Promise<string> {
  const { data } = await http.get<ApiOk<{ message: string }>>("/plugin-config-hint");
  return unwrap(data, "/plugin-config-hint").message;
}

export async function fetchDbOverview(): Promise<DbOverviewData> {
  const { data } = await http.get<ApiOk<DbOverviewData>>("/db/overview");
  return unwrap(data, "/db/overview");
}

export async function postMongoAggregate(body: {
  collection: string;
  pipeline: unknown[];
}): Promise<{ rows: Record<string, unknown>[]; truncated_to: number }> {
  const { data } = await http.post<ApiOk<{ rows: Record<string, unknown>[]; truncated_to: number }>>(
    "/db/mongodb/aggregate",
    body,
  );
  return unwrap(data, "/db/mongodb/aggregate");
}

export async function fetchDbTableRow(params: {
  table: "config" | "bot_config" | "group_config" | "user_config";
  row_id: number;
}): Promise<Record<string, unknown>> {
  const { data } = await http.get<ApiOk<Record<string, unknown>>>("/db/table-row", { params });
  return unwrap(data, "/db/table-row");
}

export async function putDbTableRow(body: {
  table: "config" | "bot_config" | "group_config" | "user_config";
  row_id: number;
  data: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const { data } = await http.put<ApiOk<Record<string, unknown>>>("/db/table-row", body);
  return unwrap(data, "/db/table-row");
}

export async function deleteDbTableRow(params: {
  table: "config" | "bot_config" | "group_config" | "user_config";
  row_id: number;
}): Promise<{ deleted: boolean }> {
  const { data } = await http.delete<ApiOk<{ deleted: boolean }>>("/db/table-row", { params });
  return unwrap(data, "/db/table-row");
}

export async function fetchInstances(): Promise<InstancesData> {
  const { data } = await http.get<ApiOk<InstancesData>>("/instances");
  return unwrap(data, "/instances");
}

/** 获取好友申请列表 */
export async function fetchFriendRequests(params?: {
  self_id?: number;
  doubt?: boolean;
}): Promise<FriendOverviewData> {
  const { data } = await http.get<ApiOk<FriendOverviewData>>("/friend-requests", { params });
  return unwrap(data, "/friend-requests");
}

/** 获取群列表（按账号实时拉取） */
export async function fetchGroupList(selfId: number, limit = 1000): Promise<GroupListData> {
  const { data } = await http.get<ApiOk<GroupListData>>("/group-list", {
    params: { self_id: selfId, limit },
  });
  return unwrap(data, "/group-list");
}

/** 获取好友列表 */
export async function fetchFriendList(selfId: number, limit = 800): Promise<FriendListData> {
  const { data } = await http.get<ApiOk<FriendListData>>("/friend-list", {
    params: { self_id: selfId, limit },
  });
  return unwrap(data, "/friend-list");
}

export async function fetchRequestOverview(): Promise<RequestOverviewData> {
  const { data } = await http.get<ApiOk<RequestOverviewData>>("/request-overview");
  return unwrap(data, "/request-overview");
}

export async function postRequestAction(body: {
  self_id: number;
  kind: "friend" | "group";
  action?: "approve" | "reject";
  source?: "pending" | "doubt";
  user_id?: number;
  group_id?: number;
}): Promise<{ handled: boolean }> {
  const { data } = await http.post<ApiOk<{ handled: boolean }>>("/request-actions", body);
  return unwrap(data, "/request-actions");
}

export async function fetchBotConfigs(): Promise<BotConfigPublic[]> {
  const { data } = await http.get<ApiOk<BotConfigPublic[]>>("/bot-configs");
  return unwrap(data, "/bot-configs");
}

export async function putBotConfig(
  account: number,
  body: Partial<{
    admins: number[];
    disabled_plugins: string[];
    auto_accept_friend: boolean;
    auto_accept_group: boolean;
    security: boolean;
  }>,
): Promise<BotConfigPublic> {
  const { data } = await http.put<ApiOk<BotConfigPublic>>(`/bot-configs/${account}`, body);
  return unwrap(data, `/bot-configs/${account}`);
}

export async function deleteBotConfig(account: number): Promise<{ deleted: boolean }> {
  return deleteDbTableRow({ table: "bot_config", row_id: account });
}

export async function fetchGroupConfigs(limit: number): Promise<GroupConfigPublic[]> {
  const { data } = await http.get<ApiOk<GroupConfigPublic[]>>("/group-configs", { params: { limit } });
  return unwrap(data, "/group-configs");
}

export async function fetchGroupConfigById(groupId: number): Promise<GroupConfigPublic> {
  const { data } = await http.get<ApiOk<GroupConfigPublic>>(`/group-configs/${groupId}`);
  return unwrap(data, `/group-configs/${groupId}`);
}

export async function fetchBotConfigById(account: number): Promise<BotConfigPublic> {
  const { data } = await http.get<ApiOk<BotConfigPublic>>(`/bot-configs/${account}`);
  return unwrap(data, `/bot-configs/${account}`);
}

export async function putGroupConfig(
  groupId: number,
  body: Partial<{
    disabled_plugins: string[];
    roulette_mode: number;
    banned: boolean;
  }>,
): Promise<GroupConfigPublic> {
  const { data } = await http.put<ApiOk<GroupConfigPublic>>(`/group-configs/${groupId}`, body);
  return unwrap(data, `/group-configs/${groupId}`);
}

export async function fetchUserConfigById(userId: number): Promise<UserConfigPublic> {
  const { data } = await http.get<ApiOk<UserConfigPublic>>(`/user-configs/${userId}`);
  return unwrap(data, `/user-configs/${userId}`);
}

export async function putUserConfig(
  userId: number,
  body: Partial<{
    banned: boolean;
  }>,
): Promise<UserConfigPublic> {
  const { data } = await http.put<ApiOk<UserConfigPublic>>(`/user-configs/${userId}`, body);
  return unwrap(data, `/user-configs/${userId}`);
}

export async function fetchAiExtensionConfig(): Promise<AiExtensionConfig> {
  const { data } = await http.get<ApiOk<AiExtensionConfig>>("/ai-extension/config");
  return unwrap(data, "/ai-extension/config");
}

export async function putAiExtensionConfig(body: AiExtensionConfig): Promise<AiExtensionConfig> {
  const { data } = await http.put<ApiOk<AiExtensionConfig>>("/ai-extension/config", body);
  return unwrap(data, "/ai-extension/config");
}

export async function postAiExtensionTest(): Promise<AiExtensionTestData> {
  const { data } = await http.post<ApiOk<AiExtensionTestData>>("/ai-extension/test");
  return unwrap(data, "/ai-extension/test");
}

export async function fetchAiExtensionLogs(
  kind: "uvicorn" | "celery",
  n = 200,
): Promise<AiExtensionLogsData> {
  const { data } = await http.get<ApiOk<AiExtensionLogsData>>("/ai-extension/logs", {
    params: { kind, n },
  });
  return unwrap(data, "/ai-extension/logs");
}

export async function fetchAiNcmStatus(): Promise<AiProxyResult> {
  const { data } = await http.get<ApiOk<AiProxyResult>>("/ai-extension/ncm/status");
  return unwrap(data, "/ai-extension/ncm/status");
}

export async function postAiNcmSendSms(body: { phone: string; ctcode: number }): Promise<AiProxyResult> {
  const { data } = await http.post<ApiOk<AiProxyResult>>("/ai-extension/ncm/send-sms", body);
  return unwrap(data, "/ai-extension/ncm/send-sms");
}

export async function postAiNcmVerifySms(body: {
  phone: string;
  captcha: string;
  ctcode: number;
}): Promise<AiProxyResult> {
  const { data } = await http.post<ApiOk<AiProxyResult>>("/ai-extension/ncm/verify-sms", body);
  return unwrap(data, "/ai-extension/ncm/verify-sms");
}

export async function postAiNcmLogout(): Promise<AiProxyResult> {
  const { data } = await http.post<ApiOk<AiProxyResult>>("/ai-extension/ncm/logout");
  return unwrap(data, "/ai-extension/ncm/logout");
}

export async function fetchUpdateCheck(): Promise<UpdateCheckData> {
  const { data } = await http.get<ApiOk<UpdateCheckData>>("/update/check");
  return unwrap(data, "/update/check");
}

export async function postUpdateApply(): Promise<UpdateApplyData> {
  const { data } = await http.post<ApiOk<UpdateApplyData>>("/update/apply");
  return unwrap(data, "/update/apply");
}

export async function fetchBotUpdateCheck(): Promise<BotUpdateCheckData> {
  const { data } = await http.get<ApiOk<BotUpdateCheckData>>("/update/bot/check");
  return unwrap(data, "/update/bot/check");
}

export async function postBotUpdateApply(): Promise<BotUpdateApplyData> {
  const { data } = await http.post<ApiOk<BotUpdateApplyData>>("/update/bot/apply");
  return unwrap(data, "/update/bot/apply");
}
