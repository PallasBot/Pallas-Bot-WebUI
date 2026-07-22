import CommonConfigForm from "@/components/CommonConfigForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AiConfigStrategySection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bot 对话策略</CardTitle>
        <CardDescription>common-config / llm</CardDescription>
      </CardHeader>
      <CardContent>
        <CommonConfigForm sectionId="llm" savedMessage="Bot 对话配置已保存" />
      </CardContent>
    </Card>
  );
}
