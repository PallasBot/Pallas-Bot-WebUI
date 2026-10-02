// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Link, Route, RouterProvider, Routes, useLocation, useSearchParams } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DraftProtectionProvider } from "@/components/DraftProtection";
import AiLlmFieldPanel from "@/pages/ai/sections/AiLlmFieldPanel";

const api = vi.hoisted(() => ({ fetchCommonConfig: vi.fn(), putCommonConfig: vi.fn() }));
vi.mock("@/api/console", () => api);

function LocationOutput() {
  const location = useLocation();
  return <output aria-label="location">{`${location.pathname}${location.search}`}</output>;
}

function DialogueRoute() {
  const [params] = useSearchParams();
  const isSession = params.get("panel") === "session";
  return (
    <>
      <LocationOutput />
      <Link to="?panel=session&focus=field">keep this panel</Link>
      <Link to="?panel=memory">leave session panel</Link>
      {isSession ? (
        <AiLlmFieldPanel
          icon={MessagesSquare}
          title="会话"
          lead="session settings"
          masterKey="llm_session_enabled"
          masterLabel="启用会话"
          detailKeys={[]}
          savedMessage="saved"
          navigationPanel="session"
        />
      ) : <p>other panel</p>}
    </>
  );
}

function TestRoot() {
  return (
    <DraftProtectionProvider>
      <Routes>
        <Route path="/ai/config/dialogue" element={<DialogueRoute />} />
      </Routes>
    </DraftProtectionProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchCommonConfig.mockResolvedValue({
    fields: [{ name: "llm_session_enabled", kind: "bool", current: "true" }],
  });
  api.putCommonConfig.mockResolvedValue(undefined);
});

afterEach(cleanup);

it("allows same-panel query changes but confirms leaving a dirty query subpanel", async () => {
  const user = userEvent.setup();
  const router = createMemoryRouter([{ path: "*", element: <TestRoot /> }], {
    initialEntries: ["/ai/config/dialogue?panel=session"],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("checkbox", { name: "启用会话" });
  await user.click(screen.getByRole("link", { name: "keep this panel" }));
  expect(screen.getByLabelText("location").textContent).toBe("/ai/config/dialogue?panel=session&focus=field");

  await user.click(screen.getByRole("checkbox", { name: "启用会话" }));
  await user.click(screen.getByRole("link", { name: "leave session panel" }));
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(router.state.location.search).toBe("?panel=session&focus=field");

  // Return to baseline, make a new draft, and accept leaving it.
  await user.click(screen.getByRole("checkbox", { name: "启用会话" }));
  await user.click(screen.getByRole("checkbox", { name: "启用会话" }));
  await user.click(screen.getByRole("link", { name: "leave session panel" }));
  await user.click(await screen.findByRole("button", { name: "离开页面" }));
  await waitFor(() => expect(router.state.location.search).toBe("?panel=memory"));
});
