import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/600.css";
import "@fontsource/noto-sans-sc/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
/* 全局壳层样式；页面/组件级 CSS 随路由懒加载导入 */
import "./styles/console/tokens.css";
import "./styles/console/app.css";
import "./styles/console/console-hub.css";
import "./styles/ui-atoms.css";
import "./styles/react-parity-pass.css";
import "./index.css";
import App from "./App";
import { applyShellTheme } from "./theme/applyShellTheme";

applyShellTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/pallas"}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
