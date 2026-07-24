import { useState, type ReactNode } from "react";
import PanelHdCollapseCaret from "@/components/PanelHdCollapseCaret";

/** 插件治理面板分组：标题 + 说明 + 与配置页一致的展开收起。 */
export default function PluginGovernanceGroup({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="plugin-governance-panel__group">
      <header className="plugin-governance-panel__group-head">
        <div className="plugin-governance-panel__group-title-row">
          <h4 className="plugin-governance-panel__group-title">{title}</h4>
          <PanelHdCollapseCaret
            className="plugin-governance-panel__group-collapse"
            expanded={open}
            label={title}
            onToggle={() => setOpen((v) => !v)}
          />
        </div>
        {description ? <p className="muted plugin-governance-panel__group-desc">{description}</p> : null}
      </header>
      {open ? <div className="plugin-governance-panel__group-body">{children}</div> : null}
    </section>
  );
}
