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
/* P3：自有 console 样式（不再依赖 Vue styles） */
import "./styles/console/tokens.css";
import "./styles/console/app.css";
import "./styles/console/console-hub.css";
/* ai-hub.css / ai-history.css：Vue 遗留，React /ai/* 已 shadcn 原生，不再全局引入 */
/* Ui* 兼容层原子；勿引入 Vue ui.css（会打坏 Tailwind --background HSL） */
import "./styles/ui-atoms.css";
import "./styles/tags-input.css";
import "./styles/console-page-skel.css";
import "./styles/update-page.css";
import "./styles/form-section-divider.css";
import "./styles/git-mirror-dialog.css";
import "./styles/bot-restart-dialog.css";
import "react-day-picker/dist/style.css";
import "./styles/log-virtual-feed.css";
import "./styles/home-plugin-charts.css";
import "./styles/home-bucket-chart.css";
import "./styles/home-hourly-chart.css";
import "./styles/gs-trend-chart.css";
import "./styles/protocol-page-entry.css";
import "./styles/protocol-account-workspace.css";
import "./styles/home-page.css";
import "./styles/console-pager.css";
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
