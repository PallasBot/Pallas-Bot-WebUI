import type { PluginConfigField } from "@/api/pallasTypes";

/**
 * 按字段语义返回一个图标 emoji，用于配置项标题前的视觉提示。
 * 仿 gsuid_hub 的关键词图标映射，但用轻量 emoji 而非引入图标库。
 * 纯函数：按 name / env_key / label 的小写文本做关键词匹配，命中即返回。
 */

interface IconRule {
  icon: string;
  keywords: string[];
}

// 顺序敏感：更具体的规则放前面（如 api_key 先于 key 之外的泛化项）。
const ICON_RULES: IconRule[] = [
  { icon: "🔑", keywords: ["api_key", "apikey", "secret", "token", "password", "passwd", "appkey", "key"] },
  { icon: "🌐", keywords: ["url", "host", "endpoint", "base_url", "domain", "server", "addr", "proxy"] },
  { icon: "🔌", keywords: ["port"] },
  { icon: "⏰", keywords: ["time", "timeout", "schedule", "cron", "interval", "delay", "cooldown", "ttl", "expire"] },
  { icon: "🎚️", keywords: ["max", "min", "limit", "count", "num", "size", "len", "length", "threshold", "window", "budget", "top_k", "concurrency", "rpm", "rate"] },
  { icon: "💬", keywords: ["message", "msg", "reply", "chat", "prompt", "text", "content", "say"] },
  { icon: "🛡️", keywords: ["perm", "permission", "auth", "verify", "secure", "guard", "block", "ban"] },
  { icon: "📃", keywords: ["list", "group", "whitelist", "blacklist", "ids", "names", "styles"] },
  { icon: "🖼️", keywords: ["image", "img", "pic", "photo", "avatar", "paint", "draw"] },
  { icon: "🎨", keywords: ["style", "theme", "color", "font"] },
  { icon: "🔔", keywords: ["notify", "notification", "push", "alert"] },
  { icon: "💾", keywords: ["path", "dir", "file", "save", "store", "cache", "db", "database"] },
  { icon: "🔁", keywords: ["repeater", "repeat", "loop", "retry"] },
  { icon: "⚡", keywords: ["enabled", "enable", "switch", "toggle", "active"] },
];

const DEFAULT_ICON = "⚙️";

export function pluginConfigFieldIcon(field: PluginConfigField): string {
  const haystack = `${field.name} ${field.env_key} ${field.label ?? ""}`.toLowerCase();
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.icon;
    }
  }
  return DEFAULT_ICON;
}
