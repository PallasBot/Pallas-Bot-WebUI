import { Outlet } from "react-router-dom";

/** AI 区薄壳：观测走 AiObservationLayout；配置自带工具条。 */
export default function AiLayout() {
  return (
    <div data-ui-zone="ai-native" className="w-full">
      <Outlet />
    </div>
  );
}
