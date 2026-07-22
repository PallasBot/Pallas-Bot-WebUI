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
/* 先挂 Vue 现网视觉，再挂 Tailwind（工具类 + shadcn 组件） */
import "@pallas-vue/styles/app.css";
import "@pallas-vue/styles/console-hub.css";
import "@pallas-vue/styles/ai-hub.css";
import "@pallas-vue/styles/ai-history.css";
/* Ui* 原子：不用 Vue ui.css，避免覆写 Tailwind --background HSL 分量 */
import "./styles/ui-atoms.css";
import "./styles/update-page.css";
import "./styles/git-mirror-dialog.css";
import "./styles/bot-restart-dialog.css";
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
