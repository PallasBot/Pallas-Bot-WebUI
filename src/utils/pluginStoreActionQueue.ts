export type PluginStoreQueueAction = "install" | "update";

export type PluginStoreQueueKind = "official" | "community";

export interface PluginStoreQueueTask {
  kind: PluginStoreQueueKind;
  action: PluginStoreQueueAction;
  key: string;
}

export function pluginStoreQueueTaskKey(
  kind: PluginStoreQueueKind,
  key: string,
  action: PluginStoreQueueAction,
): string {
  return `${kind}:${action}:${key}`;
}

export function isPluginStoreTaskQueued(
  queue: PluginStoreQueueTask[],
  task: PluginStoreQueueTask,
): boolean {
  const target = pluginStoreQueueTaskKey(task.kind, task.key, task.action);
  return queue.some((item) => pluginStoreQueueTaskKey(item.kind, item.key, item.action) === target);
}

export function appendPluginStoreQueueTask(
  queue: PluginStoreQueueTask[],
  task: PluginStoreQueueTask,
): PluginStoreQueueTask[] {
  if (isPluginStoreTaskQueued(queue, task)) return queue;
  return [...queue, task];
}

export function withPluginStoreQueueSuffix(message: string, pendingCount: number): string {
  if (pendingCount <= 0) return message;
  return `${message}（队列中还有 ${pendingCount} 项）`;
}

export function formatPluginStoreEnqueuedHint(
  action: PluginStoreQueueAction,
  label: string,
  pendingCount: number,
): string {
  const verb = action === "install" ? "安装" : "更新";
  return `已加入队列：${verb} ${label}（待处理 ${pendingCount} 项）`;
}
