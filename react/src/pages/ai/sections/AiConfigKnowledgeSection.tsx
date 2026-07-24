import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchConversationKernelKnowledgeSources } from "@/api/console";
import KnowledgeSourcesTable from "@/components/ai/KnowledgeSourcesTable";
import CommonConfigForm from "@/components/CommonConfigForm";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import SegTabs from "@/components/SegTabs";
import StateBlock from "@/components/StateBlock";
import { Card, CardContent } from "@/components/ui/card";

type Panel = "arknights" | "sources";

const PANEL_OPTIONS = [
  { value: "arknights", label: "方舟知识库" },
  { value: "sources", label: "语料源" },
];

export default function AiConfigKnowledgeSection() {
  const [panel, setPanel] = useState<Panel>("arknights");
  const sourcesQ = useQuery({
    queryKey: ["conversation-kernel-knowledge-sources"],
    queryFn: fetchConversationKernelKnowledgeSources,
    enabled: panel === "sources",
  });

  const chromeMiddle = useMemo(
    () => (
      <SegTabs
        size="toolbar"
        ariaLabel="知识库分区"
        value={panel}
        onValueChange={(v) => setPanel(v as Panel)}
        options={PANEL_OPTIONS}
      />
    ),
    [panel],
  );

  useRegisterAiConfigChrome({ middle: chromeMiddle });

  return (
    <Card>
      <CardContent className="pt-5">
        {panel === "arknights" ? (
          <CommonConfigForm sectionId="arknights_kb" savedMessage="方舟知识库配置已保存" />
        ) : (
          <StateBlock
            loading={sourcesQ.isLoading}
            error={sourcesQ.error}
            empty={!sourcesQ.data?.items?.length}
            emptyText="暂无已配置的语料源。"
          >
            <KnowledgeSourcesTable items={sourcesQ.data?.items || []} />
          </StateBlock>
        )}
      </CardContent>
    </Card>
  );
}
