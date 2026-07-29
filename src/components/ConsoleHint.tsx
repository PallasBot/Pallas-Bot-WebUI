import type { DetailsHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ConsoleHintBase = {
  children: ReactNode;
  className?: string;
};

type ConsoleHintStatic = ConsoleHintBase &
  Omit<HTMLAttributes<HTMLDivElement>, "children" | "className"> & {
    collapsible?: false;
  };

type ConsoleHintFold = ConsoleHintBase &
  Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "children" | "className"> & {
    /** 收成一行「注」，展开再看说明（唱歌 / TTS / 画画等长提示）。 */
    collapsible: true;
    noteLabel?: string;
  };

/**
 * 控制台通用软提醒：虚线框 + muted 文案（与 AI 记忆页作用域提示同款）。
 * 用于引导/说明/暂不可用，勿替代 alert--err / alert--warn 等强告警。
 * `collapsible` 时默认折叠，只露出「注」。
 */
export default function ConsoleHint(props: ConsoleHintStatic | ConsoleHintFold) {
  const { children, className } = props;

  if (props.collapsible) {
    const { noteLabel = "注", collapsible: _c, ...rest } = props;
    return (
      <details className={cn("console-hint console-hint--fold", className)} {...rest}>
        <summary className="console-hint__summary">{noteLabel}</summary>
        <div className="console-hint__body">{children}</div>
      </details>
    );
  }

  const { collapsible: _c, ...rest } = props;
  return (
    <div className={cn("console-hint", className)} role="status" {...rest}>
      {children}
    </div>
  );
}
