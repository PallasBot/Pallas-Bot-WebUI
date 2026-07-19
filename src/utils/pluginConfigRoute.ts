import type { RouteLocationRaw } from "vue-router";

/** 通用配置 field_groups 的 plugin_config_path → 插件配置页路由（兼容旧 /common-config/{id}） */
export function pluginConfigRouteFromPath(rawPath: string, sectionPlugin?: string): RouteLocationRaw {
  const section = (sectionPlugin || "").trim();
  if (section) {
    return { name: "plugins", params: { name: section } };
  }
  const trimmed = (rawPath || "").trim();
  const fromPlugins = trimmed.match(/^\/plugins\/([a-z0-9_]+)$/i)?.[1];
  if (fromPlugins) {
    return { name: "plugins", params: { name: fromPlugins } };
  }
  const fromLegacyCommon = trimmed.match(/^\/common-config\/([a-z0-9_]+)$/i)?.[1];
  if (fromLegacyCommon) {
    return { name: "plugins", params: { name: fromLegacyCommon } };
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return { name: "plugins" };
}
