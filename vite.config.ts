/// <reference types="vite/client" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 与 Pallas-Bot 插件 pallas_webui 的 pallas_webui_http_base 一致
const BASE = "/pallas/";
// 与机器人 NoneBot 监听一致（.env 中 PORT，默认 8088）
const DEFAULT_TARGET = "http://127.0.0.1:8088";

export default defineConfig({
  base: BASE,
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // 开发时 /pallas/api 转发到机器人，避免跨域
    proxy: {
      "/pallas/api": {
        target: process.env.VITE_PROXY_TARGET || DEFAULT_TARGET,
        changeOrigin: true,
      },
    },
  },
});
