/// <reference types="vite/client" />
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react-swc";
import type { Plugin } from "vite";
import { defineConfig, loadEnv } from "vite";

const reactSrc = fileURLToPath(new URL("./src", import.meta.url));
const vueSrc = fileURLToPath(new URL("../src", import.meta.url));

/** 从 Vue 仓源码 import 时，把 `@/` 指到 Vue `src/`；catalogSync 用 React shim（去 vue.ref）。 */
function vueSrcAtAlias(): Plugin {
  const vueSrcNorm = vueSrc.replace(/\\/g, "/");
  const reactSrcNorm = reactSrc.replace(/\\/g, "/");
  const catalogSyncShim = path.join(reactSrc, "shims/catalogSync.ts");
  return {
    name: "pallas-vue-src-at-alias",
    enforce: "pre",
    resolveId(id, importer) {
      const idNorm = id.replace(/\\/g, "/");
      if (id === "@/utils/catalogSync" || idNorm.endsWith("/utils/catalogSync") || idNorm.endsWith("/utils/catalogSync.ts")) {
        return catalogSyncShim;
      }
      if (!id.startsWith("@/") || !importer) return null;
      const impAbs = path.resolve(path.dirname(importer), ".").replace(/\\/g, "/");
      const imp = (importer.startsWith("/") ? importer : impAbs).replace(/\\/g, "/");
      const underVue =
        (imp.includes("/Pallas-Bot-WebUI/src/") || imp.startsWith(`${vueSrcNorm}/`)) &&
        !imp.includes("/Pallas-Bot-WebUI/react/") &&
        !imp.startsWith(`${reactSrcNorm}/`);
      if (!underVue) return null;
      return path.join(vueSrc, id.slice(2));
    },
  };
}

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
    plugins: [vueSrcAtAlias(), react()],
    resolve: {
      alias: [
        // 具体路径须在 `@` 之前，否则会被 `@` 前缀抢解析
        {
          find: "@/utils/catalogSync",
          replacement: path.join(reactSrc, "shims/catalogSync.ts"),
        },
        { find: /^@\/assets\//, replacement: `${vueSrc.replace(/\\/g, "/")}/assets/` },
        { find: "@/utils/protocolUi", replacement: path.join(vueSrc, "utils/protocolUi.ts") },
        { find: "@/config/aiConstants", replacement: path.join(vueSrc, "config/aiConstants.ts") },
        { find: "@/config/consoleNavIcons", replacement: path.join(vueSrc, "config/consoleNavIcons.ts") },
        { find: "@/utils/pluginReadme", replacement: path.join(vueSrc, "utils/pluginReadme.ts") },
        { find: "@pallas-vue", replacement: vueSrc },
        { find: "@", replacement: reactSrc },
      ],
    },
    server: {
      port: 5174,
      fs: {
        allow: [fileURLToPath(new URL("..", import.meta.url))],
      },
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
