import CommunityGallerySection from "@/pages/CommunityGallerySection";
import PageMasthead from "@/components/PageMasthead";
import BtnIco from "@/components/BtnIco";
import { PALLAS_COMMUNITY_HUB } from "@/utils/pallasExternalLinks";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export default function CommunityGalleryPage() {
  return (
    <div className="community-gallery-page console-hub-page">
      <PageMasthead
        title="社区投稿"
        description="向社区中心投稿发言卡或截图；本部署已提交的内容可在此撤下。"
        actions={
          <Button type="button" variant="outline" size="sm" asChild className="group">
            <a href={PALLAS_COMMUNITY_HUB} target="_blank" rel="noopener noreferrer">
              <BtnIco icon={ExternalLink} motion="external" />
              社区主站
            </a>
          </Button>
        }
      />
      <CommunityGallerySection />
    </div>
  );
}
