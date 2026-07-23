import type { ReactNode } from "react";
import PageChrome from "@/components/layout/PageChrome";

/** @deprecated 请用 `PageChrome`；保留别名以免存量 import 断裂 */
export default function PageHeader(props: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  hideLeadOnNarrow?: boolean;
}) {
  return <PageChrome {...props} />;
}
