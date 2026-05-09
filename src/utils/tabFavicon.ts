export function setTabFavicon(href: string, mime: string): void {
  if (typeof document === "undefined") return;
  let links = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]'),
  );
  if (!links.length) {
    const link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
    links = [link];
  }
  for (const link of links) {
    link.type = mime;
    link.href = href;
  }
}
