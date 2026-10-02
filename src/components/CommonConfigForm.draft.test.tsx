// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  createMemoryRouter,
  Link,
  Route,
  Routes,
  RouterProvider,
} from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CommonConfigForm from "@/components/CommonConfigForm";
import { DraftProtectionProvider } from "@/components/DraftProtection";

const api = vi.hoisted(() => ({
  fetchCommonConfig: vi.fn(),
  fetchCommonConfigRaw: vi.fn(),
  putCommonConfig: vi.fn(),
  putCommonConfigRaw: vi.fn(),
}));

vi.mock("@/api/console", () => api);
vi.mock("@/components/config/DynamicConfigPanel", () => ({
  default: ({
    fields,
    fieldValues,
    onFieldChange,
  }: {
    fields: Array<{ name: string }>;
    fieldValues: Record<string, string>;
    onFieldChange: (name: string, value: string) => void;
  }) => (
    <>
      {fields.map((field) => (
        <label key={field.name}>
          {field.name}
          <input
            aria-label={field.name}
            value={fieldValues[field.name] ?? ""}
            onChange={(event) => onFieldChange(field.name, event.target.value)}
          />
        </label>
      ))}
    </>
  ),
}));

let serverValue = "server value";
let serverRaw = "original = true\n";

function EditorPage() {
  const [mode, setMode] = useState<"form" | "raw">("form");
  const queryClient = useQueryClient();
  return (
    <>
      <button type="button" onClick={() => setMode((current) => current === "form" ? "raw" : "form")}>
        toggle mode
      </button>
      <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["common-config", "llm"] })}>
        refresh config
      </button>
      <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["common-config-raw", "llm"] })}>
        refresh raw
      </button>
      <Link to="/away">leave editor</Link>
      <CommonConfigForm sectionId="llm" mode={mode} />
    </>
  );
}

function TestRoot() {
  return (
    <DraftProtectionProvider>
      <Routes>
        <Route path="/edit" element={<EditorPage />} />
        <Route path="/away" element={<p>away page</p>} />
      </Routes>
    </DraftProtectionProvider>
  );
}

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "*", element: <TestRoot /> }], {
    initialEntries: ["/edit"],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();
  serverValue = "server value";
  serverRaw = "original = true\n";
  api.fetchCommonConfig.mockImplementation(async () => ({
    fields: [{ name: "test_value", kind: "string", current: serverValue }],
  }));
  api.fetchCommonConfigRaw.mockImplementation(async () => serverRaw);
  api.putCommonConfig.mockImplementation(async (_section: string, values: Record<string, string>) => {
    serverValue = values.test_value;
  });
  api.putCommonConfigRaw.mockImplementation(async (_section: string, value: string) => {
    serverRaw = value;
  });
});

afterEach(cleanup);

it("preserves form/raw drafts across mode switches and refetches; failed saves stay dirty", async () => {
  const user = userEvent.setup();
  const router = renderEditor();
  const field = await screen.findByLabelText("test_value") as HTMLInputElement;
  await waitFor(() => expect(field.value).toBe("server value"));
  await user.clear(field);
  await user.type(field, "form draft");

  await user.click(screen.getByRole("button", { name: "toggle mode" }));
  const raw = await screen.findByRole("textbox") as HTMLTextAreaElement;
  await user.clear(raw);
  await user.type(raw, "raw draft = true");
  await user.click(screen.getByRole("button", { name: "toggle mode" }));
  expect((screen.getByLabelText("test_value") as HTMLInputElement).value).toBe("form draft");

  serverValue = "server refresh";
  await user.click(screen.getByRole("button", { name: "refresh config" }));
  await waitFor(() => expect(api.fetchCommonConfig).toHaveBeenCalledTimes(2));
  expect((screen.getByLabelText("test_value") as HTMLInputElement).value).toBe("form draft");

  api.putCommonConfig.mockRejectedValueOnce(new Error("offline"));
  await user.click(screen.getByRole("button", { name: "保存" }));
  expect((screen.getByLabelText("test_value") as HTMLInputElement).value).toBe("form draft");

  await user.click(screen.getByRole("link", { name: "leave editor" }));
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(router.state.location.pathname).toBe("/edit");

  await user.click(screen.getByRole("button", { name: "toggle mode" }));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("raw draft = true");
});

it("does not let an older save response clear edits made while saving", async () => {
  const user = userEvent.setup();
  renderEditor();
  const field = await screen.findByLabelText("test_value") as HTMLInputElement;
  await user.clear(field);
  await user.type(field, "submitted");

  let resolveSave!: () => void;
  api.putCommonConfig.mockImplementationOnce(() => new Promise<void>((resolve) => {
    resolveSave = () => {
      serverValue = "submitted";
      resolve();
    };
  }));
  await user.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(api.putCommonConfig).toHaveBeenCalledTimes(1));
  await user.clear(field);
  await user.type(field, "newer draft");
  resolveSave();

  await waitFor(() => expect((screen.getByLabelText("test_value") as HTMLInputElement).value).toBe("newer draft"));
  await screen.findByRole("button", { name: "保存" });
  expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(false);
});
