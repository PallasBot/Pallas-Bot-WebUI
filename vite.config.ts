/// <reference types="vite/client" />
import { readFileSync } from "node:fs";
import os from "node:os";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

const reactSrc = fileURLToPath(new URL("./src", import.meta.url));

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

/** 发版 CI 会注入 CONSOLE_VERSION（如 v0.7.0）；本地开发回退 package.json */
const webuiVersion = (process.env.CONSOLE_VERSION || "").trim() || pkg.version;

/** 与现有控件一致 */
const BASE = "/pallas/";

function resolveDevProxyTarget(env: Record<string, string>): string {
  const explicit = (env.VITE_PROXY_TARGET ?? process.env.VITE_PROXY_TARGET ?? "").trim();
  if (explicit) return explicit;
  const port = (env.VITE_PROXY_PORT ?? process.env.VITE_PROXY_PORT ?? "8088").trim() || "8088";
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devProxyTarget = resolveDevProxyTarget(env);

  return {
    base: BASE,
    define: {
      __WEBUI_VERSION__: JSON.stringify(webuiVersion),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": reactSrc,
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/pallas/api": { target: devProxyTarget, changeOrigin: true },
        "/pallas/store-assets": { target: devProxyTarget, changeOrigin: true },
        "/pallas/plugin-assets": { target: devProxyTarget, changeOrigin: true },
        "/pallas/assets": { target: devProxyTarget, changeOrigin: true },
        "/pallas/_pallas_ui": { target: devProxyTarget, changeOrigin: true },
        "/pallas/favicon.png": { target: devProxyTarget, changeOrigin: true },
        // /pallas/login 由 Vite SPA 承接；仅 logout / API 走 Bot
        "/pallas/logout": { target: devProxyTarget, changeOrigin: true },
        "/protocol": { target: devProxyTarget, changeOrigin: true },
      },
    },
  };
});
