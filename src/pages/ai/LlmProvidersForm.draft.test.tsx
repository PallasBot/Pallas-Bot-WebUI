// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Link, Route, RouterProvider, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DraftProtectionProvider } from "@/components/DraftProtection";
import { AiConfigChromeProvider, useAiConfigChromeSlots } from "@/components/ai/AiConfigChromeContext";
import type { LlmProviderRow, LlmProvidersConfig } from "@/api/console";
import LlmProvidersForm from "@/pages/ai/LlmProvidersForm";

const api = vi.hoisted(() => ({
  fetchLlmLocalRoutingConfig: vi.fn(),
  fetchLlmProviderModels: vi.fn(),
  fetchLlmProvidersConfig: vi.fn(),
  postLlmProviderTest: vi.fn(),
  putLlmLocalRoutingConfig: vi.fn(),
  putLlmProvider: vi.fn(),
  putLlmProvidersConfig: vi.fn(),
  renameLlmProvider: vi.fn(),
}));

vi.mock("@/api/console", () => api);
vi.mock("@/pages/ai/sections/AiModelAdminPanel", () => ({ default: () => null }));

function initialConfig(): LlmProvidersConfig {
  return {
    providers: [
      {
        id: "openai",
        kind: "remote",
        enabled: true,
        base_url: "https://api.openai.com/v1",
        default_model: "gpt-4o",
        api_key: "",
        api_keys: [],
        api_key_set: true,
        api_keys_count: 1,
        api_key_hints: ["sk-…1234"],
        api_key_env: "",
        capabilities: ["text"],
        models: [],
        task_models: {},
        model_effort: "",
        model_pricing: {},
        request_method: "chat_completions",
      } as LlmProviderRow,
    ],
    routing: { chain_fallback: [], tasks: {}, cost_currency: "" },
    providers_file: "llm_providers.json",
    file_exists: true,
  };
}

let serverConfig: LlmProvidersConfig;
let resolveProviderSave: (() => void) | null;

function ChromeControls() {
  const slots = useAiConfigChromeSlots();
  return (
    <>
      <button type="button" onClick={() => slots.onRefresh?.()}>refresh config</button>
      {slots.middle}
      {slots.trailing}
    </>
  );
}

function EditPage() {
  return (
    <AiConfigChromeProvider search="" setSearch={() => undefined}>
      <ChromeControls />
      <Link to="/away">leave page</Link>
      <LlmProvidersForm />
    </AiConfigChromeProvider>
  );
}

function TestRoot() {
  return (
    <DraftProtectionProvider>
      <Routes>
        <Route path="/edit" element={<EditPage />} />
        <Route path="/away" element={<p>away</p>} />
      </Routes>
    </DraftProtectionProvider>
  );
}

function renderPage() {
  const router = createMemoryRouter([{ path: "*", element: <TestRoot /> }], {
    initialEntries: ["/edit"],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

async function selectTab(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
  const trigger = screen.getAllByRole("combobox")[0] as HTMLElement;
  trigger.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: label }));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  serverConfig = initialConfig();
  resolveProviderSave = null;
  api.fetchLlmProvidersConfig.mockImplementation(async () => structuredClone(serverConfig));
  api.fetchLlmLocalRoutingConfig.mockResolvedValue({ llm_model: "llama3" });
  api.fetchLlmProviderModels.mockResolvedValue({ ok: true, models: [] });
  api.postLlmProviderTest.mockResolvedValue({ reachable: true });
  api.putLlmLocalRoutingConfig.mockImplementation(async (value) => value);
  api.putLlmProvidersConfig.mockImplementation(async (value) => {
    serverConfig = structuredClone(value);
    return { providers_file: "llm_providers.json" };
  });
  api.renameLlmProvider.mockResolvedValue(undefined);
  api.putLlmProvider.mockImplementation((row: LlmProviderRow) => new Promise<void>((resolve) => {
    resolveProviderSave = () => {
      serverConfig.providers = serverConfig.providers.map((item) => item.id === row.id ? structuredClone(row) : item);
      resolve();
    };
  }));
});

afterEach(async () => {
  cleanup();
  // Drain preserveShellMainScroll's delayed restores before jsdom teardown.
  await new Promise((resolve) => setTimeout(resolve, 200));
});

it("confirms dirty refresh and route exit, preserving edits made while a provider save is pending", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("openai");
  await user.click(screen.getByText("openai"));
  await screen.findByLabelText("API 基础 URL");
  await user.clear(screen.getByLabelText("API 基础 URL"));
  await user.type(screen.getByLabelText("API 基础 URL"), "https://submitted.example/v1");
  const fetchesBeforeRefresh = api.fetchLlmProvidersConfig.mock.calls.length;

  await user.click(screen.getByRole("button", { name: "refresh config" }));
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  expect(screen.getByText("刷新并丢弃未保存草稿？")).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(api.fetchLlmProvidersConfig).toHaveBeenCalledTimes(fetchesBeforeRefresh);
  expect((screen.getByLabelText("API 基础 URL") as HTMLInputElement).value).toBe("https://submitted.example/v1");

  await user.click(screen.getByRole("button", { name: "保存提供方" }));
  await waitFor(() => expect(resolveProviderSave).toBeTypeOf("function"));
  await user.clear(screen.getByLabelText("API 基础 URL"));
  await user.type(screen.getByLabelText("API 基础 URL"), "https://edited-during-save.example/v1");
  resolveProviderSave?.();
  await waitFor(() => expect((screen.getByLabelText("API 基础 URL") as HTMLInputElement).value).toBe("https://edited-during-save.example/v1"));

  await user.click(screen.getByRole("link", { name: "leave page" }));
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  expect(screen.getByText("有未保存的配置草稿")).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect((screen.getByLabelText("API 基础 URL") as HTMLInputElement).value).toBe("https://edited-during-save.example/v1");
});

it("keeps provider and Ollama drafts independent when the local draft is saved", async () => {
  const user = userEvent.setup();
  renderPage();
  await screen.findByText("openai");
  await user.click(screen.getByText("openai"));
  const providerUrl = await screen.findByLabelText("API 基础 URL");
  await user.clear(providerUrl);
  await user.type(providerUrl, "https://provider-draft.example/v1");

  await selectTab(user, /Ollama 分档/);
  await user.click(screen.getByRole("checkbox", { name: "启用 Ollama 多模型" }));
  await user.click(screen.getByRole("button", { name: "保存 Ollama 分档" }));
  await waitFor(() => expect(api.putLlmLocalRoutingConfig).toHaveBeenCalledTimes(1));

  await selectTab(user, /提供方/);
  expect((await screen.findByLabelText("API 基础 URL") as HTMLInputElement).value).toBe("https://provider-draft.example/v1");
  await user.click(screen.getByRole("link", { name: "leave page" }));
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  expect(screen.getByText("有未保存的配置草稿")).not.toBeNull();
});

it("keeps the provider draft after a failed save", async () => {
  const user = userEvent.setup();
  api.putLlmProvider.mockRejectedValueOnce(new Error("offline"));
  renderPage();
  await screen.findByText("openai");
  await user.click(screen.getByText("openai"));
  const providerUrl = await screen.findByLabelText("API 基础 URL");
  await user.clear(providerUrl);
  await user.type(providerUrl, "https://failed-save.example/v1");

  await user.click(screen.getByRole("button", { name: "保存提供方" }));

  expect(await screen.findByText("offline")).not.toBeNull();
  expect((screen.getByLabelText("API 基础 URL") as HTMLInputElement).value).toBe("https://failed-save.example/v1");
});
