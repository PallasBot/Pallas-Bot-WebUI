// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import FriendsGroupsPage from "@/pages/FriendsGroupsPage";

const api = vi.hoisted(() => ({
  fetchFriendList: vi.fn(),
  fetchGroupList: vi.fn(),
  fetchInstances: vi.fn(),
  fetchRequestOverview: vi.fn(),
  postRequestAction: vi.fn(),
  postRequestActionsBatch: vi.fn(),
}));

vi.mock("@/api/fullConsole", () => api);
vi.mock("@/hooks/useBotFavorites", () => ({ useBotFavorites: () => ({ favorites: new Set() }) }));
vi.mock("@/hooks/useConsolePrefs", () => ({
  useConsolePrefs: () => ({ tablePageSize: 1, setTablePageSize: vi.fn() }),
}));
vi.mock("@/utils/botConnection", () => ({ accountHasNonebotBot: () => true }));
vi.mock("@/utils/botDisplay", () => ({
  botPickerRowsFromInstances: () => [{ self_id: "10001" }],
  botSelectDropdownLabel: (_nickname: string, id: string) => id,
  botSelectTriggerLabel: (_nickname: string, id: string) => id,
  botAccountFavoriteRank: () => 0,
}));
vi.mock("@/utils/consoleSocialCache", () => ({ requestOverviewToFriendOverview: (value: unknown) => value }));
vi.mock("@/components/BotAccountCombobox", () => ({
  default: ({ value, onValueChange, bots }: {
    value: string;
    onValueChange: (value: string) => void;
    bots: Array<{ id: string; nickname?: string }>;
  }) => (
    <select aria-label="当前 Bot 账号" value={value} onChange={(event) => onValueChange(event.target.value)}>
      <option value="__none__">请选择 Bot…</option>
      {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.nickname || bot.id}</option>)}
    </select>
  ),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "*", element: <FriendsGroupsPage /> }], {
    initialEntries: ["/friends-groups"],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient, router };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("keeps cross-page request selection and explains it separately from list search", async () => {
  const user = userEvent.setup();
  api.fetchInstances.mockResolvedValue({ nonebot_bots: [], db_bot_configs: [{ account: 10001 }] });
  api.fetchFriendList.mockResolvedValue({ self_id: 10001, friends: [] });
  api.fetchGroupList.mockResolvedValue({ self_id: 10001, groups: [] });
  api.fetchRequestOverview.mockResolvedValue({
    bots: [{
      self_id: "10001",
      pending_friend_requests: [
        { user_id: 11, nickname: "申请者甲" },
        { user_id: 22, nickname: "申请者乙" },
      ],
      doubt_friend_requests: [],
      pending_group_requests: [],
    }],
  });
  api.postRequestActionsBatch.mockResolvedValue({ friends_ok: 0, friends_fail: 0, groups_ok: 0, groups_fail: 0 });
  renderPage();

  await user.selectOptions(screen.getByRole("combobox", { name: "当前 Bot 账号" }), "10001");
  await waitFor(() => expect(api.fetchRequestOverview).toHaveBeenCalled());
  const selectAll = await screen.findByRole("checkbox", { name: /全选当前 Bot 全部好友申请/ });
  await user.click(selectAll);

  expect(screen.getByText(/当前 Bot 的全部好友申请（共 2 条，含其他分页）/)).not.toBeNull();
  expect(screen.getByText(/已选 2 条/)).not.toBeNull();
  expect(screen.getByRole("searchbox", { name: "搜索好友…" })).not.toBeNull();

  await user.click(screen.getByRole("button", { name: "下一页" }));
  expect(screen.getByText("申请者乙")).not.toBeNull();
  expect((screen.getByRole("checkbox", { name: "选择待确认好友申请 22" }) as HTMLInputElement).checked).toBe(true);

  await user.type(screen.getByRole("searchbox", { name: "搜索好友…" }), "无匹配好友");
  expect(screen.getByText("申请者乙")).not.toBeNull();
  expect((screen.getByRole("checkbox", { name: "选择待确认好友申请 22" }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByText(/已选 2 条/)).not.toBeNull();
});
