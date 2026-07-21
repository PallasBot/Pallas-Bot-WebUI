import { createApp } from "vue";
import faviconHref from "./assets/favicon.png?url";
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
import "./styles/app.css";
import "./styles/console-hub.css";
import "./styles/ai-hub.css";
import "./styles/ai-history.css";
import "./styles/ui.css";
import App from "./App.vue";
import router from "./router";
import { initConsolePrefs } from "./utils/consolePrefs";

function ensureConsoleFavicon(): void {
  let el = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "icon";
    el.type = "image/png";
    document.head.appendChild(el);
  }
  el.href = faviconHref;
}

ensureConsoleFavicon();
initConsolePrefs();

const app = createApp(App);
app.use(router);
app.mount("#app");
