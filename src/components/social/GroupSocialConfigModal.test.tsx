// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GroupSocialConfigModal from "@/components/social/GroupSocialConfigModal";

const api = vi.hoisted(() => ({ fetch: vi.fn(), plugins: vi.fn(), put: vi.fn(), remove: vi.fn() }));

vi.mock("@/api/fullConsole", () => ({
  fetchGroupConfigById: api.fetch,
  fetchPlugins: api.plugins,
  putGroupConfig: api.put,
  deleteGroupConfig: api.remove,
}));

const group = (extra: Record<string, unknown> = {}) => ({
  group_id: 733000001,
  roulette_mode: 0,
  banned: false,
  disabled_plugins: [],
  blocked_user_ids: [],
  ...extra,
});

function renderModal(onOpenChange = vi.fn()) {
  const view = render(<GroupSocialConfigModal open groupId={733000001} onOpenChange={onOpenChange} />);
  return { ...view, onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetch.mockResolvedValue(group());
  api.plugins.mockResolvedValue([]);
  api.put.mockResolvedValue(group());
});

afterEach(cleanup);

it("loads legacy configs without the field and saves added words with other group settings", async () => {
  const user = userEvent.setup();
  renderModal();
  const input = await screen.findByRole("textbox", { name: "添加本群屏蔽词" });
  await user.type(input, " Spoiler ");
  await user.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(api.put).toHaveBeenCalledWith(733000001, expect.objectContaining({
    message_scrub_extra: ["Spoiler"],
    roulette_mode: 0,
  })));
});

it("saves an empty list after removing the last word", async () => {
  const user = userEvent.setup();
  api.fetch.mockResolvedValue(group({ message_scrub_extra: ["spoiler"] }));
  renderModal();
  await screen.findByRole("button", { name: "移除屏蔽词 spoiler" });
  await user.click(screen.getByRole("button", { name: "移除屏蔽词 spoiler" }));
  await user.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(api.put).toHaveBeenCalledWith(733000001, expect.objectContaining({ message_scrub_extra: [] })));
});

it("cancels without persisting edits", async () => {
  const user = userEvent.setup();
  const { onOpenChange } = renderModal();
  await user.type(await screen.findByRole("textbox", { name: "添加本群屏蔽词" }), "local draft");
  await user.click(screen.getByRole("button", { name: "取消" }));

  expect(api.put).not.toHaveBeenCalled();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("validates the 200-term limit without sending a save", async () => {
  const user = userEvent.setup();
  api.fetch.mockResolvedValue(group({ message_scrub_extra: Array.from({ length: 200 }, (_, i) => `term-${i}`) }));
  renderModal();
  await screen.findByRole("textbox", { name: "添加本群屏蔽词" });
  await user.type(screen.getByRole("textbox", { name: "添加本群屏蔽词" }), "extra");
  await user.click(screen.getByRole("button", { name: "保存" }));

  expect((await screen.findByRole("alert")).textContent).toContain("最多添加 200 个");
  expect(api.put).not.toHaveBeenCalled();
});

it("validates the 64-character limit for each term", async () => {
  const user = userEvent.setup();
  renderModal();
  await user.type(await screen.findByRole("textbox", { name: "添加本群屏蔽词" }), "x".repeat(65));
  await user.click(screen.getByRole("button", { name: "保存" }));

  expect((await screen.findByRole("alert")).textContent).toContain("最多 64 个字符");
  expect(api.put).not.toHaveBeenCalled();
});

it("does not add a term when Enter confirms IME composition", async () => {
  renderModal();
  const input = await screen.findByRole("textbox", { name: "添加本群屏蔽词" });
  fireEvent.change(input, { target: { value: "中文" } });
  fireEvent.keyDown(input, { key: "Enter", keyCode: 13, isComposing: true });
  fireEvent.keyDown(input, { key: "Enter", keyCode: 229, isComposing: false });

  expect((input as HTMLInputElement).value).toBe("中文");
  expect(screen.queryByRole("button", { name: "移除屏蔽词 中文" })).toBeNull();
});

it("clears an unconfirmed term when switching groups", async () => {
  const user = userEvent.setup();
  api.fetch.mockImplementation((id: number) => Promise.resolve(group({
    group_id: id,
    message_scrub_extra: id === 733000001 ? [] : ["beta"],
  })));
  const view = render(<GroupSocialConfigModal open groupId={733000001} onOpenChange={vi.fn()} />);
  await waitFor(() => expect(api.fetch).toHaveBeenCalledWith(733000001));
  await user.type(await screen.findByRole("textbox", { name: "添加本群屏蔽词" }), "alpha");
  view.rerender(<GroupSocialConfigModal open groupId={733000002} onOpenChange={vi.fn()} />);
  await screen.findByRole("button", { name: "移除屏蔽词 beta" });
  await user.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(api.put).toHaveBeenCalledWith(733000002, expect.objectContaining({
    message_scrub_extra: ["beta"],
  })));
});

it("deduplicates case-insensitively and keeps the first spelling", async () => {
  const user = userEvent.setup();
  api.fetch.mockResolvedValue(group({ message_scrub_extra: [" Foo "] }));
  renderModal();
  await user.type(await screen.findByRole("textbox", { name: "添加本群屏蔽词" }), "foo");
  await user.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(api.put).toHaveBeenCalledWith(733000001, expect.objectContaining({
    message_scrub_extra: ["Foo"],
  })));
});

it("keeps the scrub draft after save failure and allows retry", async () => {
  const user = userEvent.setup();
  api.put.mockRejectedValueOnce(new Error("save failed"));
  renderModal();
  await user.type(await screen.findByRole("textbox", { name: "添加本群屏蔽词" }), "draft term");
  await user.click(screen.getByRole("button", { name: "保存" }));
  await screen.findByText("save failed");

  expect(screen.getByRole("button", { name: "移除屏蔽词 draft term" })).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
  expect(api.put).toHaveBeenLastCalledWith(733000001, expect.objectContaining({
    message_scrub_extra: ["draft term"],
  }));
});
