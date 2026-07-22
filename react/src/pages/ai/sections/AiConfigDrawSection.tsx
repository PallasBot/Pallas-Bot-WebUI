import { Link } from "react-router-dom";
import CommonConfigForm from "@/components/CommonConfigForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AiConfigDrawSection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>画画网关</CardTitle>
          <CardDescription>
            与插件页同一套 draw 配置；完整权限等见{" "}
            <Link to="/plugins/draw" className="text-primary underline-offset-2 hover:underline">
              插件 · draw
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommonConfigForm sectionId="draw" savedMessage="画画配置已保存" />
        </CardContent>
      </Card>
    </div>
  );
}
