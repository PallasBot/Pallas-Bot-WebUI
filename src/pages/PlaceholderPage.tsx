import { Link } from "react-router-dom";
import PageMasthead from "@/components/PageMasthead";
import BtnIco from "@/components/BtnIco";
import { Button } from "@/components/ui/button";
import { Card } from "@heroui/react";
import { LayoutDashboard, Puzzle } from "lucide-react";
import { cn } from "@/lib/utils";

const LEGACY_CARD_ROOT = "pallas-card-frame block static gap-0 overflow-visible p-0";
const LEGACY_CARD_HEADER = "flex flex-col space-y-1.5 p-5";
const LEGACY_CARD_DESCRIPTION = "text-sm text-muted-foreground";
const LEGACY_CARD_CONTENT = "block gap-0 p-5 pt-0";

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
      <Card className={LEGACY_CARD_ROOT}>
        <Card.Header className={LEGACY_CARD_HEADER}>
          <Card.Title>壳层已接入</Card.Title>
          <Card.Description className={LEGACY_CARD_DESCRIPTION}>此路由已挂在 React + shadcn Shell 下，业务 UI 分期迁入。</Card.Description>
        </Card.Header>
        <Card.Content className={cn(LEGACY_CARD_CONTENT, "flex flex-wrap gap-2")}>
          <Button asChild variant="outline" className="group">
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
        </Card.Content>
      </Card>
    </div>
  );
}
