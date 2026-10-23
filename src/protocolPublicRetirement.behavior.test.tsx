// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { MAIN_NAV_ITEMS } from "@/config/mainNav";
import { commonConfigLegacyRedirectPath } from "@/utils/commonConfigRedirects";
import { fetchConsoleSetupStatus } from "@/api/fullConsole";

vi.mock("@/api/fullConsole", () => ({
  changeConsoleLogin: vi.fn(),
  fetchConsoleSetupStatus: vi.fn().mockResolvedValue({ requires_setup: false, default_password_active: false }),
}));

import SetupWizardPage from "@/pages/SetupWizardPage";

afterEach(cleanup);

it("keeps protocol connection in the public navigation without management tabs", () => {
  const entry = MAIN_NAV_ITEMS.find((item) => item.to === "/protocol");
  expect(entry?.label).toBe("协议连接");
  expect(MAIN_NAV_ITEMS.some((item) => item.to.startsWith("/protocol/"))).toBe(false);
  expect(commonConfigLegacyRedirectPath("pb_protocol")).toBe("/protocol");
  expect(commonConfigLegacyRedirectPath("pallas_protocol")).toBe("/protocol");
  const storeSource = readFileSync(resolve(process.cwd(), "src/pages/PluginStorePage.tsx"), "utf8");
  expect(storeSource.match(/row\.package !== "pallas-plugin-protocol"/g)).toHaveLength(2);
});

it("shows self-managed OneBot guidance and the existing instances destination", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><SetupWizardPage /></MemoryRouter>
    </QueryClientProvider>,
  );

  expect(await screen.findByText(/请自行准备并配置 OneBot 协议端/)).not.toBeNull();
  expect((await screen.findByRole("link", { name: "查看实例与连接" })).getAttribute("href")).toBe("/instances");
  expect(screen.queryByRole("link", { name: /协议端管理|扫码|创建|导入/ })).toBeNull();
});

it("keeps the instances destination disabled while initial setup is required", async () => {
  vi.mocked(fetchConsoleSetupStatus).mockResolvedValueOnce({
    requires_setup: true,
    default_password_active: true,
  } as Awaited<ReturnType<typeof fetchConsoleSetupStatus>>);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><SetupWizardPage /></MemoryRouter>
    </QueryClientProvider>,
  );

  expect((await screen.findByRole("button", { name: "完成改密后可查看实例" })).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("link", { name: "查看实例与连接" })).toBeNull();
});

it("keeps the home protocol label as plain status text, not a managed-page link", () => {
  const source = readFileSync(resolve(process.cwd(), "src/pages/HomePage.tsx"), "utf8");
  expect(source).toContain('<span className="home-acct-meta__tag">');
  expect(source).toContain("已连接");
  expect(source).toContain("未连接");
  expect(source).not.toMatch(/<Link[^>]*to="\/protocol"/);
});
