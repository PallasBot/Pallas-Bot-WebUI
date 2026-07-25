import type { ReactNode } from "react";

/** 顶栏作用域未就绪时的提示（虚线框，与记忆页群号提示一致）。 */
export default function AiScopeHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
