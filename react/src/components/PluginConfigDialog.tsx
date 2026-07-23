import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ConsoleModal from "@/components/ConsoleModal";
import PluginConfigWorkspace, {
  type PluginConfigWorkspaceHandle,
} from "@/components/PluginConfigWorkspace";
import type {
  CommunityPluginRow,
  OfficialExtensionRow,
  PluginRow,
} from "@/api/pallasTypes";
import { AI_ENTRY_PLUGIN_CONFIG_CHECK } from "@/config/aiEntrySemantics";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { resolvePluginReadmeTarget } from "@/utils/pluginReadmeTarget";

type Props = {
  open: boolean;
  pluginName: string;
  pluginRow: PluginRow | null;
  officialExtensions: OfficialExtensionRow[];
  communityPlugins: CommunityPluginRow[];
  onClose: () => void;
};

export default function PluginConfigDialog({
  open,
  pluginName,
  pluginRow,
  officialExtensions,
  communityPlugins,
  onClose,
}: Props) {
  const workspaceRef = useRef<PluginConfigWorkspaceHandle>(null);
  const [status, setStatus] = useState<Omit<PluginConfigWorkspaceHandle, "save" | "runConfigCheck">>({
    saving: false,
    checking: false,
    loading: true,
    hasData: false,
    supportsConfigCheck: false,
  });

  const displayTitle = pluginRow?.metadata?.name || pluginName;
  const pluginResolvedId = (pluginRow?.resolved_plugin_id || pluginName).trim();
  const showDrawAiConfigHint = pluginResolvedId === "draw";

  const readmeTarget = useMemo(() => {
    if (!pluginRow) return null;
    return resolvePluginReadmeTarget(
      pluginRow as Parameters<typeof resolvePluginReadmeTarget>[0],
      officialExtensions as Parameters<typeof resolvePluginReadmeTarget>[1],
      communityPlugins as Parameters<typeof resolvePluginReadmeTarget>[2],
    );
  }, [pluginRow, officialExtensions, communityPlugins]);

  const canSave =
    status.hasData && !status.loading && !status.saving && !status.checking;

  return (
    <ConsoleModal
      open={open && Boolean(pluginName)}
      titleId="plugin-config-dialog-title"
      panelClass="plugin-config-dialog"
      bodyClass="plugin-config-dialog__bd"
      busy={status.saving}
      onClose={onClose}
      header={
        <>
          <div className="console-modal__head-text plugin-config-dialog__head">
            <div className="plugin-config-dialog__head-text">
              <h2 id="plugin-config-dialog-title" className="console-modal__title">
                {displayTitle}
              </h2>
              <p className="console-modal__subtitle">
                <code>{pluginResolvedId}</code>
              </p>
            </div>
          </div>
          <button type="button" className="console-modal__close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </>
      }
      footer={
        <div className="plugin-config-dialog__foot row-actions">
          {status.supportsConfigCheck ? (
            <button
              type="button"
              className="btn btn--outline"
              disabled={!canSave}
              onClick={() => void workspaceRef.current?.runConfigCheck()}
            >
              {status.checking ? "检测中…" : AI_ENTRY_PLUGIN_CONFIG_CHECK.label}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSave}
            title="Ctrl+S"
            onClick={() => void workspaceRef.current?.save()}
          >
            {status.saving ? "保存中…" : "保存"}
          </button>
        </div>
      }
    >
      {showDrawAiConfigHint ? (
        <p className="muted plugin-config-dialog__ai-hint">
          推荐在 <Link to={aiConfigSectionPath("draw")}>AI 配置 · 画画</Link>
          管理网关；本页为兼容入口，配置键相同。
        </p>
      ) : null}
      {pluginName ? (
        <PluginConfigWorkspace
          key={pluginName}
          ref={workspaceRef}
          presentation="dialog"
          pluginName={pluginName}
          initialPluginRow={pluginRow}
          readmeTarget={readmeTarget}
          onStatusChange={setStatus}
        />
      ) : null}
    </ConsoleModal>
  );
}
