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

/** 发版 tag 为 v*（CONSOLE_VERSION）；本地 package.json 无前缀时补 v 以对齐 tag */
function webuiVersionForDefine(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^v/i.test(s)) return `v${s.slice(1)}`;
  if (/^\d/.test(s)) return `v${s}`;
  return s;
}

const webuiVersion = webuiVersionForDefine(
  (process.env.CONSOLE_VERSION || "").trim() || pkg.version,
);

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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/react/") ||
              id.includes("node_modules/scheduler")
            ) {
              return "vendor-react";
            }
            if (id.includes("react-router")) return "vendor-router";
            if (id.includes("@tanstack")) return "vendor-query";
            if (id.includes("@radix-ui")) return "vendor-radix";
            if (id.includes("lucide-react")) return "vendor-lucide";
            if (id.includes("marked") || id.includes("dompurify")) return "vendor-markdown";
            if (id.includes("graphology")) return "vendor-graph";
            if (id.includes("@fontsource")) return "vendor-fonts";
            if (id.includes("date-fns") || id.includes("react-day-picker")) return "vendor-date";
            if (id.includes("axios")) return "vendor-http";
          },
        },
      },
    },
  };
});
