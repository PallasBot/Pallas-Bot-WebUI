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

/** 与 Vue 根仓、pb_webui 的 pallas_webui_http_base 一致 */
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
      __WEBUI_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": reactSrc,
      },
    },
    server: {
      port: 5174,
      proxy: {
        "/pallas/api": { target: devProxyTarget, changeOrigin: true },
        "/pallas/store-assets": { target: devProxyTarget, changeOrigin: true },
        "/pallas/plugin-assets": { target: devProxyTarget, changeOrigin: true },
        "/pallas/assets": { target: devProxyTarget, changeOrigin: true },
        "/pallas/login": { target: devProxyTarget, changeOrigin: true },
        "/pallas/logout": { target: devProxyTarget, changeOrigin: true },
        "/protocol": { target: devProxyTarget, changeOrigin: true },
      },
    },
  };
});
