import { useEffect, useState } from "react";

function PluginDefaultIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="plugin-default-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </svg>
  );
}

export default function PluginIcon({
  pluginId = "",
  label = "",
  iconUrl,
  size = "md",
}: {
  pluginId?: string;
  label?: string;
  iconUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const resolvedUrl = (iconUrl || "").trim() || null;

  useEffect(() => {
    setImgFailed(false);
  }, [pluginId, iconUrl]);

  const defaultSize = size === "xl" ? 26 : size === "lg" ? 22 : size === "sm" ? 11 : 14;

  return (
    <span className={`plugin-icon plugin-icon--${size}`} aria-hidden>
      {resolvedUrl && !imgFailed ? (
        <img className="plugin-icon__img" src={resolvedUrl} alt={label || pluginId} onError={() => setImgFailed(true)} />
      ) : (
        <span className="plugin-icon__fallback">
          <PluginDefaultIcon size={defaultSize} />
        </span>
      )}
    </span>
  );
}
