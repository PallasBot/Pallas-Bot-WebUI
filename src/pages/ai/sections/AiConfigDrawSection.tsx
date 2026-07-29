import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import ConfigFieldHelp from "@/components/config/ConfigFieldHelp";
import PluginConfigWorkspace, {
  type PluginConfigWorkspaceHandle,
} from "@/components/PluginConfigWorkspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AI_ENTRY_PLUGIN_CONFIG_CHECK } from "@/config/aiEntrySemantics";
import { aiConfigSectionPath } from "@/config/aiConfigSections";

/** 旧独立画画段；现行入口为媒体 · 画画。 */
export default function AiConfigDrawSection() {
  const workspaceRef = useRef<PluginConfigWorkspaceHandle>(null);
  const [status, setStatus] = useState<
    Omit<PluginConfigWorkspaceHandle, "save" | "runConfigCheck">
  >({
    saving: false,
    checking: false,
    loading: true,
    hasData: false,
    supportsConfigCheck: false,
  });

  const onStatusChange = useCallback(
    (next: Omit<PluginConfigWorkspaceHandle, "save" | "runConfigCheck">) => {
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
    },
    [],
  );

  useRegisterAiConfigChrome({});

  const canSave = status.hasData && !status.loading && !status.saving && !status.checking;

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-semibold leading-tight">画画</h3>
          <ConfigFieldHelp
            title="画画"
            description={(
              <span>
                画画配置已并入
                {" "}
                <Link to={aiConfigSectionPath("media", "draw")}>
                  AI 配置 · 媒体 · 画画
                </Link>
                ；此处与插件配置共享。未安装时请先到
                {" "}
                <Link to="/plugin-store">插件商店</Link>
                {" "}
                安装。
              </span>
            )}
          />
        </div>
        <PluginConfigWorkspace
          ref={workspaceRef}
          pluginName="draw"
          presentation="dialog"
          onStatusChange={onStatusChange}
        />
        <div className="flex flex-wrap gap-2">
          {status.supportsConfigCheck ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canSave}
              onClick={() => void workspaceRef.current?.runConfigCheck()}
            >
              {status.checking ? "检测中…" : AI_ENTRY_PLUGIN_CONFIG_CHECK.label}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={!canSave}
            onClick={() => void workspaceRef.current?.save()}
          >
            {status.saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
