import { Link } from "react-router-dom";
import PageMasthead from "@/components/PageMasthead";
import BtnIco from "@/components/BtnIco";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Puzzle } from "lucide-react";

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
          <Button asChild variant="ghost" className="group">
            <Link to="/">
              <BtnIco icon={LayoutDashboard} motion="back" />
              回仪表盘
            </Link>
          </Button>
          <Button asChild variant="secondary" className="group">
            <Link to="/plugins">
              <BtnIco icon={Puzzle} />
              插件列表
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
