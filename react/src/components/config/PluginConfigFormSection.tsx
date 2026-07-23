import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import PanelHdCollapseCaret from "@/components/PanelHdCollapseCaret";
import { cn } from "@/lib/utils";

/** gsuid「插件参数配置」分区：图标标题 + 副文案 + 折叠 */
export default function PluginConfigFormSection({
  title = "插件参数配置",
  subtitle,
  defaultOpen = true,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("plugin-config-group-card", className)}>
      <header className="plugin-config-group-card__hero">
        <div className="plugin-config-group-card__hero-main">
          <span className="plugin-config-group-card__hero-icon" aria-hidden="true">
            <SlidersHorizontal className="plugin-config-group-card__hero-icon-svg" />
          </span>
          <div className="plugin-config-group-card__hero-text">
            <div className="plugin-config-group-card__title-row">
              <h4 className="plugin-config-group-card__title">{title}</h4>
            </div>
            {subtitle ? <p className="plugin-config-group-card__desc">{subtitle}</p> : null}
          </div>
        </div>
        <div className="plugin-config-group-card__hero-side">
          <PanelHdCollapseCaret
            className="plugin-config-group-card__collapse"
            expanded={open}
            label={title}
            onToggle={() => setOpen((v) => !v)}
          />
        </div>
      </header>
      {open ? <div className="plugin-config-form-grid">{children}</div> : null}
    </section>
  );
}
