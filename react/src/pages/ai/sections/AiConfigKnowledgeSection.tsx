import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { fetchConversationKernelKnowledgeSources } from "@/api/console";
import CommonConfigForm from "@/components/CommonConfigForm";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AiConfigKnowledgeSection() {
  const sourcesQ = useQuery({
    queryKey: ["conversation-kernel-knowledge-sources"],
    queryFn: fetchConversationKernelKnowledgeSources,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>方舟知识库</CardTitle>
          <CardDescription>common-config / arknights_kb</CardDescription>
        </CardHeader>
        <CardContent>
          <CommonConfigForm sectionId="arknights_kb" savedMessage="方舟知识库配置已保存" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>会话内核 · 语料源</CardTitle>
            <CardDescription>/llm/conversation-kernel/knowledge-sources</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void sourcesQ.refetch()}>
            <RefreshCw className={sourcesQ.isFetching ? "animate-spin" : undefined} />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          <StateBlock loading={sourcesQ.isLoading} error={sourcesQ.error} empty={!sourcesQ.data?.sources?.length}>
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
              {JSON.stringify(sourcesQ.data?.sources || [], null, 2)}
            </pre>
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
