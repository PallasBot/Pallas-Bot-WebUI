/// <reference types="vite/client" />

declare const __WEBUI_VERSION__: string;

declare module "*.css" {}
declare module "*.png?url" {
  const src: string;
  export default src;
}
