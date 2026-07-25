import { useMemo, useState } from "react";
import CommonConfigForm from "@/components/CommonConfigForm";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import SegTabs from "@/components/SegTabs";
import { Card, CardContent } from "@/components/ui/card";

type Mode = "form" | "raw";

const MODE_OPTIONS = [
  { value: "form", label: "表单" },
  { value: "raw", label: "原始 TOML" },
];

export default function AiConfigStrategySection() {
  const [mode, setMode] = useState<Mode>("form");

  const chromeMiddle = useMemo(
    () => (
      <SegTabs
        size="toolbar"
        ariaLabel="对话配置视图"
        value={mode}
        onValueChange={(v) => setMode(v as Mode)}
        options={MODE_OPTIONS}
      />
    ),
    [mode],
  );

  useRegisterAiConfigChrome({ middle: chromeMiddle });

  return (
    <Card>
      <CardContent className="pt-5">
        {mode === "form" ? (
          <CommonConfigForm sectionId="llm" savedMessage="对话配置已保存" />
        ) : (
          <CommonConfigForm sectionId="llm" mode="raw" savedMessage="对话 TOML 已保存" />
        )}
      </CardContent>
    </Card>
  );
}
