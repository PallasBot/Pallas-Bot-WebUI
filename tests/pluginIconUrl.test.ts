import { describe, expect, it } from "vitest";
import {
  buildPluginIconMap,
  PALLAS_MASCOT_ICON_URL,
  resolveOfficialExtensionIconUrl,
  resolvePluginIconForRow,
  shouldShowPluginAvatar,
} from "../src/utils/pluginIconUrl";

describe("pluginIconUrl", () => {
  it("reuses official cover as official plugin icon when provided", () => {
    expect(
      resolveOfficialExtensionIconUrl({
        package: "pallas-plugin-duel",
        icon: "/pallas/official-extensions/pallas-plugin-duel.svg",
        avatar: null,
        cover: "https://raw.githubusercontent.com/acme/duel/main/assets/brand-avatar.png",
      }),
    ).toBe("https://raw.githubusercontent.com/acme/duel/main/assets/brand-avatar.png");
  });

  it("builds official icon map from official cover when available", () => {
    const map = buildPluginIconMap(
      [
        {
          package: "pallas-plugin-duel",
          plugin_ids: ["duel"],
          avatar: null,
          cover: "https://raw.githubusercontent.com/acme/duel/main/assets/brand-avatar.png",
          icon: "/pallas/official-extensions/pallas-plugin-duel.svg",
        },
      ] as never,
      [],
    );
    expect(map.duel).toBe("https://raw.githubusercontent.com/acme/duel/main/assets/brand-avatar.png");
  });

  it("hides avatar bubble when icon and avatar are the same image", () => {
    expect(
      shouldShowPluginAvatar(
        "https://raw.githubusercontent.com/acme/demo/main/assets/icon.png?pb_icon_v=1",
        "https://raw.githubusercontent.com/acme/demo/main/assets/icon.png?pb_icon_v=2",
      ),
    ).toBe(false);
  });

  it("falls back to official mapped icon when row has no package visual", () => {
    expect(
      resolvePluginIconForRow(
        {
          name: "duel",
          icon: "",
          cover: "",
          plugin_source: "extra",
          extra_package: "pallas-plugin-duel",
        } as never,
        {
          duel: "https://raw.githubusercontent.com/acme/duel/main/assets/brand-avatar.png",
        },
      ),
    ).toBe("https://raw.githubusercontent.com/acme/duel/main/assets/brand-avatar.png");
  });

  it("prefers row package asset over official mapped icon", () => {
    const packageCover = "/pallas/plugin-assets/duel/assets/cover.png";
    expect(
      resolvePluginIconForRow(
        {
          name: "duel",
          icon: packageCover,
          cover: packageCover,
          plugin_source: "extra",
          extra_package: "pallas-plugin-duel",
        } as never,
        {
          duel: "https://raw.githubusercontent.com/acme/duel/main/assets/brand-avatar.png",
        },
      ),
    ).toBe(packageCover);
  });

  it("uses the shell brand avatar as the mascot fallback", () => {
    expect(PALLAS_MASCOT_ICON_URL).toContain("brand-avatar.png");
    expect(PALLAS_MASCOT_ICON_URL).not.toContain("brand-avatar-hd");
  });

  it("uses the shell brand avatar for core plugins when no backend icon is available", () => {
    expect(
      resolvePluginIconForRow(
        {
          name: "help",
          icon: "",
          cover: "",
          plugin_source: "core",
          extra_package: "",
        } as never,
        {},
      ),
    ).toBe(PALLAS_MASCOT_ICON_URL);
  });

  it("prefers package asset cover over core mascot fallback", () => {
    const packageCover = "/pallas/plugin-assets/roulette/assets/cover.png";
    expect(
      resolvePluginIconForRow(
        {
          name: "roulette",
          icon: packageCover,
          cover: packageCover,
          plugin_source: "core",
          extra_package: "",
        } as never,
        {},
      ),
    ).toBe(packageCover);
  });
});
