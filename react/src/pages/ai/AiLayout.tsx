import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/ai/home", label: "观测" },
  { to: "/ai/statistics", label: "统计" },
  { to: "/ai/history", label: "历史" },
  { to: "/ai/config", label: "配置" },
  { to: "/ai/wizard", label: "体检" },
];

export default function AiLayout() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
