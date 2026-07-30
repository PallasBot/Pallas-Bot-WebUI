import { Navigate } from "react-router-dom";

/** 工具清单与覆盖已在 AI 配置 · 接话 · 工具；观测入口仅作兼容跳转。 */
export default function AiToolsPage() {
  return <Navigate to="/ai/config/dialogue?panel=tools" replace />;
}
