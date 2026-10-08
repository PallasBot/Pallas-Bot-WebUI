// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CommunityPluginRow } from "@/api/pallasTypes";
import PluginStoreCard from "@/components/PluginStoreCard";
import { communityVersionDisplay } from "@/utils/pluginStorePageHelpers";

afterEach(cleanup);

describe("community plugin version display", () => {
  it("renders local and index versions with distinct labels", () => {
    const versions = communityVersionDisplay({ index_version: "2.0.0", installed_version: "1.0.0", local_installed: true } as CommunityPluginRow);
    const view = render(<PluginStoreCard title="fixture" pluginId="fixture" installedVersionLabel={versions.installed} indexVersionLabel={versions.index} versionLabels />);
    expect(view.getByText("已安装：v1.0.0")).toBeTruthy();
    expect(view.getByText("索引：v2.0.0")).toBeTruthy();
  });

  it("uses commit fallback only for installed commit and not remote commit", () => {
    const commit = communityVersionDisplay({ local_installed: true, installed_ref: "abc123", latest_ref: "def456" } as CommunityPluginRow);
    const commitCard = render(<PluginStoreCard title="commit" pluginId="commit" installedVersionLabel={commit.installed} indexVersionLabel={commit.index} versionLabels />);
    expect(commitCard.getByText("已安装：提交 abc123")).toBeTruthy();
    expect(commitCard.queryByText("索引：提交 def456")).toBeNull();

    const unknown = communityVersionDisplay({ local_installed: true } as CommunityPluginRow);
    const unknownCard = render(<PluginStoreCard title="unknown" pluginId="unknown" installedVersionLabel={unknown.installed} versionLabels />);
    expect(unknownCard.getByText("已安装：未知")).toBeTruthy();
  });

  it("hides stale local version for uninstalled plugin", () => {
    expect(communityVersionDisplay({ installed_version: "1.0.0", installed_ref: "abc123", index_version: "2.0.0" } as CommunityPluginRow))
      .toEqual({ index: "2.0.0", installed: "" });
  });

  it("supports old responses without semantic version fields", () => {
    expect(communityVersionDisplay({ local_installed: true, installed_ref: "abc123" } as CommunityPluginRow))
      .toEqual({ index: "", installed: "提交 abc123" });
  });
});
