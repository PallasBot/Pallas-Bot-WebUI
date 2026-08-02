import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 按钮内 Lucide 图标的悬停动效预设（需父级带 `group`） */
export type BtnIcoMotion =
  | "scale"
  | "spin"
  | "up"
  | "down"
  | "external"
  | "undo"
  | "settings"
  | "close"
  | "forward"
  | "back";

const MOTION: Record<BtnIcoMotion, string> = {
  scale: "group-hover:scale-110",
  spin: "group-hover:rotate-180",
  up: "group-hover:-translate-y-0.5",
  down: "group-hover:translate-y-0.5",
  external: "group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
  undo: "group-hover:-rotate-12",
  settings: "group-hover:rotate-45",
  close: "group-hover:rotate-90",
  forward: "group-hover:translate-x-0.5",
  back: "group-hover:-translate-x-0.5",
};

type Props = {
  icon: LucideIcon;
  motion?: BtnIcoMotion;
  /** 忙碌时转圈，覆盖悬停动效 */
  busy?: boolean;
  className?: string;
};

/** 操作按钮左侧图标；与 `Button` 的 `icon` 属性或手动插入配合使用 */
export default function BtnIco({ icon: Icon, motion = "scale", busy = false, className }: Props) {
  return (
    <Icon
      className={cn(
        "size-3.5 shrink-0 transition-transform duration-200 ease-out",
        busy ? "animate-spin" : MOTION[motion],
        className,
      )}
      aria-hidden
    />
  );
}
