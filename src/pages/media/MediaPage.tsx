import { useState } from "react";
import { AiConfigChromeProvider } from "@/components/ai/AiConfigChromeContext";
import AiConfigChromeTools from "@/components/ai/AiConfigChromeTools";
import PageMasthead from "@/components/PageMasthead";
import AiConfigMediaSection from "@/pages/ai/sections/AiConfigMediaSection";

export default function MediaPage() {
  const [search, setSearch] = useState("");

  return (
    <AiConfigChromeProvider search={search} setSearch={setSearch}>
      <div className="console-hub-page">
        <PageMasthead
          title="媒体"
          description="管理媒体服务、模型资产与唱歌、语音、画画、点歌能力。"
        />
        <AiConfigChromeTools
          section="media"
          onSectionChange={() => undefined}
          hideSectionSelect
        />
        <AiConfigMediaSection />
      </div>
    </AiConfigChromeProvider>
  );
}
