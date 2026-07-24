/** 协议连接页分段（工具条 Select，对齐 AI 配置） */

export type ProtocolSectionId =
  | "accounts"
  | "create"
  | "import"
  | "assets"
  | "runtime";

export type ProtocolSectionMeta = {
  id: ProtocolSectionId;
  label: string;
  path: string;
  /** 需协议扩展已安装才展示 */
  requiresExtension?: boolean;
};

export const PROTOCOL_SECTIONS: readonly ProtocolSectionMeta[] = [
  { id: "accounts", label: "已连接账号", path: "/protocol" },
  { id: "create", label: "创建账号", path: "/protocol/create", requiresExtension: true },
  { id: "import", label: "导入账号", path: "/protocol/import", requiresExtension: true },
  { id: "assets", label: "协议资产", path: "/protocol/assets", requiresExtension: true },
  { id: "runtime", label: "SnowLuma Runtime", path: "/protocol/runtime", requiresExtension: true },
] as const;

export function protocolSectionPath(id: ProtocolSectionId): string {
  return PROTOCOL_SECTIONS.find((s) => s.id === id)?.path ?? "/protocol";
}

export function protocolSectionFromPath(pathname: string): ProtocolSectionId {
  const p = pathname.replace(/\/$/, "");
  if (p.endsWith("/protocol/create")) return "create";
  if (p.endsWith("/protocol/import")) return "import";
  if (p.endsWith("/protocol/assets")) return "assets";
  if (p.endsWith("/protocol/runtime")) return "runtime";
  return "accounts";
}

export function protocolSectionsForSelect(
  extensionInstalled: boolean,
): ProtocolSectionMeta[] {
  return PROTOCOL_SECTIONS.filter((s) => !s.requiresExtension || extensionInstalled);
}
