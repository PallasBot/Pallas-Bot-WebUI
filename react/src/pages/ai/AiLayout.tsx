import { Outlet } from "react-router-dom";

/** AI 区壳：无顶栏；分区走侧栏，页内自带工具条。 */
export default function AiLayout() {
  return (
    <div data-ui-zone="ai-native" className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-8">
      <Outlet />
    </div>
  );
}
