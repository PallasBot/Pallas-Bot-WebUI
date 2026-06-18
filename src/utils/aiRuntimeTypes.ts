import type { AiExtensionTestData, PluginConfigCheckResult } from "@/api/pallasTypes";
import type {
  AiRuntimeActionDef,
  AiRuntimeCapabilityId,
  AiRuntimeGroupId,
  AiRuntimeSourceKind,
  AiRuntimeState,
} from "@/config/aiRuntimeRegistry";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";
import type { AiConfigSectionId } from "@/config/aiConfigSections";

export type AiRuntimeRawGatewayRow = PluginConfigCheckResult["results"][number];

export interface AiRuntimeNormalizedSource {
  kind: AiRuntimeSourceKind;
  key: string;
  category?: string;
  site: string;
  latencyMs: number | null;
  statusCode: number | null;
  ok: boolean;
  raw: AiRuntimeRawGatewayRow | AiExtensionTestData;
}

export interface AiRuntimeSnapshotItem {
  capabilityId: AiRuntimeCapabilityId;
  title: string;
  description: string;
  groupId: AiRuntimeGroupId;
  groupTitle: string;
  groupDescription: string;
  groupIcon: ConsoleNavIconId;
  icon: ConsoleNavIconId;
  section: AiConfigSectionId;
  state: AiRuntimeState;
  statusLabel: string;
  statusTitle: string;
  detail: string;
  fallback: boolean;
  actions: AiRuntimeActionDef[];
  sourceKinds: AiRuntimeSourceKind[];
  sources: AiRuntimeNormalizedSource[];
}

export interface AiRuntimeSnapshotGroup {
  id: AiRuntimeGroupId;
  title: string;
  description: string;
  icon: ConsoleNavIconId;
  section: AiConfigSectionId;
  state: AiRuntimeState;
  lead: string;
  total: number;
  degradedCount: number;
  disabledCount: number;
  healthyCount: number;
  fallbackCount: number;
  items: AiRuntimeSnapshotItem[];
}

export interface AiRuntimeOverview {
  state: AiRuntimeState;
  title: string;
  lead: string;
  degradedCount: number;
  disabledCount: number;
  healthyCount: number;
  fallbackCount: number;
  total: number;
}

export interface AiRuntimeQuickAction {
  id: string;
  title: string;
  description: string;
  state: AiRuntimeState;
  capabilityId: AiRuntimeCapabilityId;
  capabilityTitle: string;
  action: AiRuntimeActionDef;
}

export interface AiRuntimePageAction {
  id: string;
  label: string;
  kind: "refresh" | "navigate";
  busy?: boolean;
  to?: string;
}
