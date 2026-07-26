import type { ReactNode } from "react";
import ConsoleHint from "@/components/ConsoleHint";

/** AI 作用域提示；样式同全站 ConsoleHint。 */
export default function AiScopeHint({ children }: { children: ReactNode }) {
  return <ConsoleHint>{children}</ConsoleHint>;
}
