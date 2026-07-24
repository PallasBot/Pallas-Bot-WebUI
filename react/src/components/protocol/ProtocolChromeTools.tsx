import { Layers } from "lucide-react";
import type { ReactNode } from "react";
import {
  protocolSectionsForSelect,
  type ProtocolSectionId,
} from "@/config/protocolSections";
import { useProtocolChromeSlots } from "@/components/protocol/ProtocolChromeContext";
import ChromeField from "@/components/ChromeField";
import ChromeTools from "@/components/ChromeTools";
import RefreshIconButton from "@/components/RefreshIconButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 协议连接工具条：分段 Select | 段内 middle | trailing | 刷新。
 * 整行共用 ChromeTools 横向滚动，勿再给 middle 单独 overflow。
 */
export default function ProtocolChromeTools({
  section,
  onSectionChange,
  onRefresh,
  refreshing = false,
  extensionInstalled = true,
  className,
  trailing,
}: {
  section: ProtocolSectionId;
  onSectionChange: (id: ProtocolSectionId) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  extensionInstalled?: boolean;
  className?: string;
  trailing?: ReactNode;
}) {
  const slots = useProtocolChromeSlots();
  const middle = slots.middle;
  const slotTrailing = slots.trailing;
  const refresh = slots.onRefresh ?? onRefresh;
  const options = protocolSectionsForSelect(extensionInstalled);

  return (
    <ChromeTools className={className}>
      <ChromeField label="选择" icon={Layers} className="shrink-0">
        <Select
          value={section}
          onValueChange={(v) => onSectionChange(v as ProtocolSectionId)}
        >
          <SelectTrigger className="h-8 w-auto min-w-[7.5rem] max-w-[11rem] shrink-0 gap-1.5">
            <SelectValue placeholder="选择" />
          </SelectTrigger>
          <SelectContent align="start">
            {options.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ChromeField>

      {/* middle 子项直接进 chrome-row（Fragment 展平），勿再包 flex-1，否则窄屏会溢出盖住右侧刷新 */}
      {middle}

      <div className="ml-auto flex shrink-0 items-center gap-1.5 self-center">
        {slotTrailing}
        {trailing}
        {refresh ? (
          <RefreshIconButton
            busy={refreshing}
            label="刷新"
            showLabel
            onClick={() => refresh()}
          />
        ) : null}
      </div>
    </ChromeTools>
  );
}
