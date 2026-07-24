import { useMemo, type CSSProperties } from "react";
import { readPrefs } from "@/theme/applyShellTheme";

export default function PrefsGlassPreview({
  label = "毛玻璃预览",
  blur,
  opacity,
}: {
  label?: string;
  blur?: number;
  opacity?: number;
}) {
  const previewStyle = useMemo(() => {
    const prefs = readPrefs();
    const blurPx = blur ?? prefs.glassBlur;
    const op = opacity ?? prefs.cardGlassOpacity;
    const saturate = 1.05 + ((blurPx - 8) / 32) * 0.75;
    return {
      "--surface-blur": `${blurPx}px`,
      "--card-glass-opacity": String(op),
      "--glass-saturate": saturate.toFixed(2),
    } as CSSProperties;
  }, [blur, opacity]);

  return (
    <div className="prefs-glass-preview" style={previewStyle} aria-hidden="true">
      <div className="prefs-glass-preview__backdrop" />
      <div className="prefs-glass-preview__pane">{label}</div>
    </div>
  );
}
