import { createApp } from "vue";
import TDesign from "tdesign-vue-next";
import { LoadingDirective } from "tdesign-vue-next";
import "tdesign-vue-next/es/style/index.css";
import "./assets/styles/pallas-theme.scss";

import App from "./App.vue";
import router from "./router";
import { applyPallasUiPrefsFromStorage } from "./utils/pallasUiPrefs";
import { initThemeFromStorage } from "./utils/theme";

initThemeFromStorage();
applyPallasUiPrefsFromStorage();
const app = createApp(App);
app.use(router);
app.use(TDesign);
app.directive("loading", LoadingDirective);
app.mount("#app");
