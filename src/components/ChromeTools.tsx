import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 全站工具条壳：Card + p-4 + 行内统一 gap / 32px 控件。
 * 行距 / 簇距见 console-hub.css `--chrome-tools-row-gap` / `--chrome-tools-cluster-gap`。
 * 与下方面板间距 = `--hub-page-gap`（via `--console-chrome-tools-gap`）；勿再叠 Tailwind mb-*。
 * 主行 nowrap + 横向滚动（同 `.console-hub-page__chrome-row`），宽度不够时不换行。
 *
 * middle 插槽：与协议页相同，直接进 chrome-row（Fragment 展平），勿再包一层 CLUSTER，
 * 否则多 ChromeField 会变成簇距而非行距。需要簇距时由插槽自己包 CHROME_TOOLS_CLUSTER。
 */
export const CHROME_TOOLS_SURFACE =
  "rounded-lg border bg-card text-card-foreground shadow-none";

/** 行内控件簇（并列按钮 / Bot+群 等）：用 CSS 簇距，勿再写 gap-1.5 / gap-2。 */
export const CHROME_TOOLS_CLUSTER =
  "chrome-tools__cluster flex shrink-0 flex-nowrap items-center";

/**
 * 右侧操作簇（保存 / 刷新…）：ml-auto + 统一簇距。
 * 在 chrome-row 内 sticky 右钉，左侧筛选横滑时仍保持可见。
 */
export const CHROME_TOOLS_TRAILING =
  "chrome-tools__trailing ml-auto flex shrink-0 flex-nowrap items-center self-center";

/** 工具条分段 / 筛选 Select；高度由 CSS `--chrome-field-h` 固定为 32px。 */
export const CHROME_SELECT_TRIGGER =
  "h-9 w-auto min-w-[7.5rem] max-w-[12rem] shrink-0";

/**
 * 工具条 Bot 账号 Combobox 触发器：按昵称收窄，最长 9rem；须带 `bot-acct-sel`。
 */
export const CHROME_BOT_ACCOUNT_SELECT =
  "bot-acct-sel h-9 w-auto min-w-[4.5rem] max-w-[9rem] shrink-0 overflow-hidden";

/** 工具条搜索 Input；高度由 CSS 强制为 32px。 */
export const CHROME_SEARCH_INPUT = "h-9 min-h-9 w-full pl-8";

export default function ChromeTools({
  children,
  advanced,
  sticky = false,
  className,
}: {
  children: ReactNode;
  advanced?: ReactNode;
  /** 竖向钉在滚动容器顶：标题可滚走，工具条（含保存/刷新）保持可见 */
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "chrome-tools console-hub-page__chrome-tools flex min-w-0 flex-col gap-3 p-4",
        CHROME_TOOLS_SURFACE,
        sticky && "chrome-tools--sticky",
        className,
      )}
    >
      <div className="console-hub-page__chrome-row">{children}</div>
      {advanced ? (
        <div className="console-hub-page__chrome-row console-hub-page__chrome-row--advanced border-t border-border pt-3">
          {advanced}
        </div>
      ) : null}
    </div>
  );
}
