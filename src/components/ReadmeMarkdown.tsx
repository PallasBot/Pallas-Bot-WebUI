import { useEffect, useRef } from "react";
import { setupReadmeCodeCopyButtons } from "@/utils/readmeCodeCopy";

type Props = {
  html: string;
  /** 默认含 readme-markdown；更新页等自带排版时可整段覆盖。 */
  className?: string;
};

/** Markdown HTML 容器：挂载后为代码块补幽灵 Copy。 */
export default function ReadmeMarkdown({
  html,
  className = "readme-markdown markdown-body",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !html.trim()) return;
    return setupReadmeCodeCopyButtons(el);
  }, [html]);

  return (
    <div
      ref={rootRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
