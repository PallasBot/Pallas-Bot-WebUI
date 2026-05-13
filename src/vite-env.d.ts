/// <reference types="vite/client" />

import "vue-router";

declare global {
  /** 构建时由 vite.config 写入，与 package.json version 一致 */
  const __WEBUI_VERSION__: string;
}

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
    description?: string;
  }
}

export {};
