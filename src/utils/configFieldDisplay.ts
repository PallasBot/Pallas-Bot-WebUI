/** WebUI 配置字段展示：中文标题与枚举选项 */

import type { PluginConfigField } from "@/api/pallasTypes";

export function fieldDisplayTitle(f: PluginConfigField): string {
  return (f.label || "").trim() || f.name;
}

const ENUM_LABELS: Record<string, string> = {
  auto: "自动",
  true: "开启",
  false: "关闭",
  prefetch: "后台预取（推荐）",
  sync: "当场联网查询",
  "local,community": "先本机，再共享池",
  local: "只用本机",
  local_first: "本地优先",
  merge_counts: "合并使用次数",
  session: "本 worker 连接",
  fleet: "协议实例名册",
  connected: "全集群曾连 WS",
  "60": "1 分钟",
  "120": "2 分钟",
  "300": "5 分钟",
  "600": "10 分钟",
  "900": "15 分钟",
  "1800": "30 分钟",
  "3600": "1 小时",
};

export function enumChoiceLabel(opt: string): string {
  return ENUM_LABELS[opt] ?? opt;
}

export function boolChoiceLabel(value: string): string {
  return value === "true" ? "开启" : "关闭";
}
