import CommonConfigForm from "@/components/CommonConfigForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AiConfigStrategySection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Bot 对话策略</CardTitle>
          <CardDescription>common-config · llm：触发与回复策略等。</CardDescription>
        </CardHeader>
        <CardContent>
          <CommonConfigForm sectionId="llm" savedMessage="Bot 对话配置已保存" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>原始 TOML</CardTitle>
          <CardDescription>直接编辑 llm 分区原始配置；保存后覆盖表单字段。</CardDescription>
        </CardHeader>
        <CardContent>
          <CommonConfigForm sectionId="llm" mode="raw" savedMessage="Bot 对话 TOML 已保存" />
        </CardContent>
      </Card>
    </div>
  );
}
