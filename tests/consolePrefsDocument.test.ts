import { describe, expect, it } from "vitest";
import { ACCENT_PRESET_IDS } from "@/config/accentPresets";
import {
  applyConsoleDocumentDataset,
  buildConsoleDocumentDataset,
  resolveConsoleTheme,
} from "@/utils/consolePrefsDocument";
import type { DensityMode, RadiusMode, SurfaceStyle, ThemeMode, UiPreset } from "@/utils/consolePrefs";

const THEMES: ThemeMode[] = ["dark", "light", "system"];
const RADII: RadiusMode[] = ["tight", "default", "round"];
const SURFACES: SurfaceStyle[] = ["solid", "glass"];
const DENSITIES: DensityMode[] = ["comfortable", "compact"];
const UI_PRESETS: UiPreset[] = ["gs", "shadcn"];

describe("resolveConsoleTheme", () => {
  it("maps system to light/dark from OS hint", () => {
    expect(resolveConsoleTheme("system", true)).toBe("dark");
    expect(resolveConsoleTheme("system", false)).toBe("light");
  });

  it("passes through explicit theme", () => {
    expect(resolveConsoleTheme("dark", false)).toBe("dark");
    expect(resolveConsoleTheme("light", true)).toBe("light");
  });
});

describe("preference matrix smoke", () => {
  it("builds valid document dataset for all preference combinations", () => {
    let count = 0;
    for (const theme of THEMES) {
      for (const systemDark of [true, false]) {
        for (const radius of RADII) {
          for (const surfaceStyle of SURFACES) {
            for (const density of DENSITIES) {
              for (const accentPreset of ACCENT_PRESET_IDS) {
              for (const uiPreset of UI_PRESETS) {
                const dataset = buildConsoleDocumentDataset(
                  { theme, radius, surfaceStyle, density, accentPreset, uiPreset },
                  systemDark,
                );
                expect(dataset.theme === "dark" || dataset.theme === "light").toBe(true);
                expect(dataset.radius).toBe(radius);
                expect(dataset.surface).toBe(surfaceStyle);
                expect(dataset.density).toBe(density);
                expect(dataset.accent).toBe(accentPreset);
                expect(dataset.uiPreset).toBe(uiPreset);
                expect(dataset.layout).toBe("hub");
                count += 1;
              }
            }
            }
          }
        }
      }
    }
    expect(count).toBe(
      THEMES.length * 2 * RADII.length * SURFACES.length * DENSITIES.length * ACCENT_PRESET_IDS.length * UI_PRESETS.length,
    );
  });

  it("applies dataset to a DOM element without throw", () => {
    const el = document.createElement("html");
    const dataset = buildConsoleDocumentDataset(
      {
        theme: "system",
        radius: "round",
        surfaceStyle: "glass",
        density: "comfortable",
        accentPreset: "sky",
        uiPreset: "gs",
      },
      true,
    );
    applyConsoleDocumentDataset(el, dataset);
    expect(el.dataset.theme).toBe("dark");
    expect(el.dataset.radius).toBe("round");
    expect(el.dataset.surface).toBe("glass");
    expect(el.dataset.density).toBe("comfortable");
    expect(el.dataset.accent).toBe("sky");
    expect(el.dataset.uiPreset).toBe("gs");
    expect(el.dataset.layout).toBe("hub");
    expect(el.style.colorScheme).toBe("dark");
  });
});
