import { useQuery } from "@tanstack/react-query";
import { fetchConversationKernelKnowledgeSources } from "@/api/console";
import CommonConfigForm from "@/components/CommonConfigForm";
import StateBlock from "@/components/StateBlock";
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
          <CardDescription>common-config · arknights_kb</CardDescription>
        </CardHeader>
        <CardContent>
          <CommonConfigForm sectionId="arknights_kb" savedMessage="方舟知识库配置已保存" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>会话内核 · 语料源</CardTitle>
          <CardDescription>只读列表，供排查知识检索来源；用顶部工具条刷新。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={sourcesQ.isLoading} error={sourcesQ.error} empty={!sourcesQ.data?.sources?.length}>
            <pre className="max-h-80 overflow-auto rounded-[var(--radius-control,8px)] border bg-muted/30 p-3 text-xs">
              {JSON.stringify(sourcesQ.data?.sources || [], null, 2)}
            </pre>
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
