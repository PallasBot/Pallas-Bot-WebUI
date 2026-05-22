/// <reference types="vite/client" />
import { readFileSync } from "node:fs";
import os from "node:os";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// 与 Pallas-Bot 插件 pallas_webui 的 pallas_webui_http_base 一致
const BASE = "/pallas/";

/** 开发代理目标：与 Bot 监听 PORT 一致（默认 8088，见 config/pallas.toml） */
function resolveDevProxyTarget(): string {
  const explicit = (process.env.VITE_PROXY_TARGET ?? "").trim();
  if (explicit) return explicit;
  const port = (process.env.VITE_PROXY_PORT ?? "8088").trim() || "8088";
  // Cursor 等 IDE 常在 127.0.0.1:PORT 做转发，loopback 会 Empty reply → Vite proxy socket hang up；
  // Bot 监听 0.0.0.0 时改走本机局域网 IPv4 可连到真实进程。
  for (const infos of Object.values(os.networkInterfaces())) {
    if (!infos) continue;
    for (const ni of infos) {
      if (ni.family !== "IPv4" || ni.internal) continue;
      const addr = ni.address?.trim();
      if (!addr || addr.startsWith("169.254.")) continue;
      return `http://${addr}:${port}`;
    }
  }
  return `http://127.0.0.1:${port}`;
}

const DEV_PROXY_TARGET = resolveDevProxyTarget();

export default defineConfig({
  base: BASE,
  define: {
    __WEBUI_VERSION__: JSON.stringify(pkg.version),
  },
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
        target: DEV_PROXY_TARGET,
        changeOrigin: true,
      },
      "/pallas/login": {
        target: DEV_PROXY_TARGET,
        changeOrigin: true,
      },
      "/pallas/logout": {
        target: DEV_PROXY_TARGET,
        changeOrigin: true,
      },
      "/protocol": {
        target: DEV_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
