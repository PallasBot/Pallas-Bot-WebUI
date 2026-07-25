import { useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { SlidersHorizontal } from "lucide-react";
import PanelHdCollapseCaret from "@/components/PanelHdCollapseCaret";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

/** 插件参数配置分区：图标标题 + 副文案 + 折叠 */
export default function PluginConfigFormSection({
  title = "插件参数配置",
  subtitle,
  defaultOpen = true,
  children,
  className,
  bodyClassName,
  icon: Icon = SlidersHorizontal,
}: {
  title?: string;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  /** 默认插件字段三列网格；媒体等自由布局可覆盖 */
  bodyClassName?: string;
  icon?: IconComponent;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("plugin-config-group-card", className)}>
      <header className="plugin-config-group-card__hero">
        <div className="plugin-config-group-card__hero-main">
          <span className="plugin-config-group-card__hero-icon" aria-hidden="true">
            <Icon className="plugin-config-group-card__hero-icon-svg" />
          </span>
          <div className="plugin-config-group-card__hero-text">
            <div className="plugin-config-group-card__title-row">
              <h4 className="plugin-config-group-card__title">{title}</h4>
            </div>
            {subtitle ? <div className="plugin-config-group-card__desc">{subtitle}</div> : null}
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
      {open ? <div className={cn("plugin-config-form-grid", bodyClassName)}>{children}</div> : null}
    </section>
  );
}
