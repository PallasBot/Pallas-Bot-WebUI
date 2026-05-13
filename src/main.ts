import { createApp } from "vue";
import faviconHref from "./assets/pallas-priest.png?url";
import "./styles/app.css";
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
