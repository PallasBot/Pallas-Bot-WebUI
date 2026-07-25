import { Layers } from "lucide-react";
import type { ReactNode } from "react";
import {
  protocolSectionsForSelect,
  type ProtocolSectionId,
} from "@/config/protocolSections";
import { useProtocolChromeSlots } from "@/components/protocol/ProtocolChromeContext";
import ChromeField from "@/components/ChromeField";
import ChromeTools, {
  CHROME_SELECT_TRIGGER,
  CHROME_TOOLS_TRAILING,
} from "@/components/ChromeTools";
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
 * middle 直接进 chrome-row（Fragment 展平），勿再包 CLUSTER / flex-1。
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
  const busy = slots.refreshing ?? refreshing;
  const options = protocolSectionsForSelect(extensionInstalled);

  return (
    <ChromeTools className={className}>
      <ChromeField label="选择" icon={Layers} className="shrink-0">
        <Select
          value={section}
          onValueChange={(v) => onSectionChange(v as ProtocolSectionId)}
        >
          <SelectTrigger className={CHROME_SELECT_TRIGGER}>
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

      {middle}

      <div className={CHROME_TOOLS_TRAILING}>
        {slotTrailing}
        {trailing}
        {refresh ? (
          <RefreshIconButton
            busy={busy}
            label="刷新"
            showLabel
            onClick={() => refresh()}
          />
        ) : null}
      </div>
    </ChromeTools>
  );
}
