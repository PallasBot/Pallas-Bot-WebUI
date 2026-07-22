/**
 * 整包复用 Vue 控制台 API（OpenAPI 客户端 + 业务封装）。
 * 页面可直接 `import { fetchX } from "@/api/fullConsole"`。
 */
export * from "@pallas-vue/api/consoleApi";
export type {
  GroupFleetWhitelistEntry,
  PluginGovernanceBody,
  PluginGovernanceData,
} from "@pallas-vue/api/pallasTypes";
