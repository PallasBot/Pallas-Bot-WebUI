import { Link } from "react-router-dom";
import PageMasthead from "@/components/PageMasthead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <PageMasthead title={title} description={description} />
      <Card>
        <CardHeader>
          <CardTitle>壳层已接入</CardTitle>
          <CardDescription>此路由已挂在 React + shadcn Shell 下，业务 UI 分期迁入。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/">回仪表盘</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/plugins">插件列表</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
