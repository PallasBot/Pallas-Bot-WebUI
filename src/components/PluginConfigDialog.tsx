import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PluginConfigWorkspace, {
  type PluginConfigWorkspaceHandle,
  type PluginConfigWorkspaceStatus,
} from "@/components/PluginConfigWorkspace";
import type {
  CommunityPluginRow,
  OfficialExtensionRow,
  PluginRow,
} from "@/api/pallasTypes";
import { AI_ENTRY_PLUGIN_CONFIG_CHECK } from "@/config/aiEntrySemantics";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { PackageX, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolvePluginReadmeTarget } from "@/utils/pluginReadmeTarget";

type Props = {
  open: boolean;
  pluginName: string;
  pluginRow: PluginRow | null;
  officialExtensions: OfficialExtensionRow[];
  communityPlugins: CommunityPluginRow[];
  onClose: () => void;
  onUninstall?: () => void;
};

/** 插件配置弹窗：shadcn Dialog（居中实心底）。 */
export default function PluginConfigDialog({
  open,
  pluginName,
  pluginRow,
  officialExtensions,
  communityPlugins,
  onClose,
  onUninstall,
}: Props) {
  const workspaceRef = useRef<PluginConfigWorkspaceHandle>(null);
  const [status, setStatus] = useState<PluginConfigWorkspaceStatus>({
    saving: false,
    checking: false,
    loading: true,
    hasData: false,
    supportsConfigCheck: false,
  });

  const onStatusChange = (next: PluginConfigWorkspaceStatus) => {
    setStatus((prev) => {
      if (
        prev.saving === next.saving &&
        prev.checking === next.checking &&
        prev.loading === next.loading &&
        prev.hasData === next.hasData &&
        prev.supportsConfigCheck === next.supportsConfigCheck
      ) {
        return prev;
      }
      return next;
    });
  };

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

  const canSave = status.hasData && !status.loading && !status.saving && !status.checking;
  const busy = status.saving;

  function requestClose() {
    if (busy) return;
    onClose();
  }

  const footer = (
    <DialogFooter className="plugin-config-dialog__foot border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3">
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {pluginRow?.uninstallable && onUninstall ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              icon={PackageX}
              iconMotion="scale"
              onClick={onUninstall}
            >
              卸载插件
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status.supportsConfigCheck ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={ShieldCheck}
              disabled={!canSave}
              onClick={() => void workspaceRef.current?.runConfigCheck()}
            >
              {status.checking ? "检测中…" : AI_ENTRY_PLUGIN_CONFIG_CHECK.label}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            icon={Save}
            iconMotion="scale"
            disabled={!canSave}
            title="Ctrl+S"
            onClick={() => void workspaceRef.current?.save()}
          >
            {status.saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    </DialogFooter>
  );

  return (
    <Dialog
      open={open && Boolean(pluginName)}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <DialogContent
        className="plugin-config-dialog flex max-h-[min(960px,calc(100dvh-32px))] w-[min(960px,calc(100vw-32px))] max-w-[min(960px,calc(100vw-32px))] gap-0 overflow-hidden bg-card p-0"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader className="plugin-config-dialog__head border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left sm:text-left">
          <div className="plugin-config-dialog__head-text w-full space-y-1 pr-6 text-left">
            <DialogTitle id="plugin-config-dialog-title" className="text-left">{displayTitle}</DialogTitle>
            <DialogDescription asChild>
              <p className="font-mono text-xs text-muted-foreground">
                <code>{pluginResolvedId}</code>
              </p>
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="plugin-config-dialog__bd min-h-0 flex-1 overflow-auto">
          {showDrawAiConfigHint ? (
            <p className="px-4 pt-3 text-sm text-muted-foreground">
              推荐在 <Link to={aiConfigSectionPath("media", "draw")} className="text-primary underline-offset-2 hover:underline">AI 配置 · 画画</Link>
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
              onStatusChange={onStatusChange}
            />
          ) : null}
        </div>

        {footer}
      </DialogContent>
    </Dialog>
  );
}
