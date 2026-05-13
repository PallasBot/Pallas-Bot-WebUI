import { createApp } from "vue";
import "./styles/app.css";
import App from "./App.vue";
import router from "./router";
import { initConsolePrefs } from "./utils/consolePrefs";

initConsolePrefs();

const app = createApp(App);
app.use(router);
app.mount("#app");
