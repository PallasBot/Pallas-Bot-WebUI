import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import "./assets/styles/pallas-theme.scss";

import App from "./App.vue";
import router from "./router";
import { initThemeFromStorage } from "./utils/theme";

initThemeFromStorage();
const app = createApp(App);
app.use(router);
app.use(ElementPlus);
app.mount("#app");
