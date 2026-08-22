// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiGovernanceScope, useAiGovernanceScope } from "./AiGovernanceScope";
import AiGovernanceScopeFields from "./AiGovernanceScopeFields";

const apiMocks = vi.hoisted(() => ({ fetchInstances: vi.fn(), fetchGroupList: vi.fn() }));

vi.mock("@/api/fullConsole", () => apiMocks);
vi.mock("@/hooks/useBotFavorites", () => ({ useBotFavorites: () => ({ favorites: new Set() }) }));

function ScopeLocation() {
  return <output>{useLocation().search}</output>;
}

function ScopeActions() {
  const { setBotId } = useAiGovernanceScope();
  return <button onClick={() => setBotId("10002")}>切换 Bot</button>;
}

function renderScope(path: string, actions = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AiGovernanceScope>
          <AiGovernanceScopeFields />
          {actions ? <ScopeActions /> : null}
          <ScopeLocation />
        </AiGovernanceScope>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  apiMocks.fetchInstances.mockReset();
  apiMocks.fetchGroupList.mockReset();
});

describe("AiGovernanceScopeFields", () => {
  it("displays an existing URL scope in fallback inputs", async () => {
    apiMocks.fetchInstances.mockResolvedValue({ nonebot_bots: [], db_bot_configs: [], bot_profiles: {} });
    apiMocks.fetchGroupList.mockResolvedValue({ groups: [] });

    renderScope("/ai/governance?bot=10001&group=20002&scene=group_chat");

    expect((await screen.findByRole("textbox", { name: "Bot QQ" }) as HTMLInputElement).value).toBe(
      "10001",
    );
    expect(screen.getByRole("combobox", { name: "治理范围群号" }).textContent).toContain("20002");
  });

  it("clears group and replaces the URL when the bot changes", async () => {
    apiMocks.fetchInstances.mockResolvedValue({ nonebot_bots: [], db_bot_configs: [], bot_profiles: {} });
    apiMocks.fetchGroupList.mockResolvedValue({ groups: [] });
    const user = userEvent.setup();

    renderScope("/ai/governance?bot=10001&group=20002&scene=group_chat", true);
    await user.click(screen.getByRole("button", { name: "切换 Bot" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("?bot=10002&scene=group_chat");
    });
  });

  it("does not fetch groups for an invalid bot", async () => {
    apiMocks.fetchInstances.mockResolvedValue({ nonebot_bots: [], db_bot_configs: [], bot_profiles: {} });

    renderScope("/ai/governance?bot=invalid&group=20002&scene=group_chat");

    await screen.findByRole("textbox", { name: "Bot QQ" });
    expect(apiMocks.fetchGroupList).not.toHaveBeenCalled();
  });

  it("gives fallback scope inputs accessible names", async () => {
    apiMocks.fetchInstances.mockResolvedValue({ nonebot_bots: [], db_bot_configs: [], bot_profiles: {} });

    renderScope("/ai/governance?scene=group_chat");

    expect(await screen.findByRole("textbox", { name: "Bot QQ" })).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "群号" })).not.toBeNull();
  });

  it("keeps the scope toolbar on one horizontally scrollable row", async () => {
    apiMocks.fetchInstances.mockResolvedValue({ nonebot_bots: [], db_bot_configs: [], bot_profiles: {} });

    const { container } = renderScope("/ai/governance?scene=group_chat");

    await screen.findByRole("textbox", { name: "Bot QQ" });
    expect(container.firstElementChild?.className).toContain("chrome-tools__cluster");
    expect(container.firstElementChild?.className).toContain("flex-nowrap");
    expect(container.firstElementChild?.className).not.toContain("flex-wrap");
  });
});
