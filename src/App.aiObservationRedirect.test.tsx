// @vitest-environment jsdom
import { lazy, Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@/components/ConsoleSetupGuard", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/layout/AppShell", () => ({ default: () => <Outlet /> }));
vi.mock("@/pages/ai/AiObservationLayout", async () => {
  const { AiObservationScopeProvider } = await import("@/components/ai/AiObservationScopeContext");
  return { default: () => <AiObservationScopeProvider><Outlet /></AiObservationScopeProvider> };
});
vi.mock("@/pages/ai/AiHistoryPage", async () => {
  const { useAiObservationScope } = await import("@/components/ai/AiObservationScopeContext");
  return {
    default: () => {
      const location = useLocation();
      const { botId, groupId } = useAiObservationScope();
      return <div>{`${location.pathname}${location.search}|${botId}/${groupId}`}</div>;
    },
  };
});
vi.mock("@/pages/ai/governance/AiGovernancePage", () => ({
  default: () => <div className="gov-target">{`governance:${useLocation().pathname}${useLocation().search}`}</div>,
}));

const App = lazy(() => import("@/App"));

function renderApp(initialEntry: string) {
  const router = createMemoryRouter(
    [{ path: "*", element: <Suspense fallback={null}><App /></Suspense> }],
    {
      initialEntries: [initialEntry],
    },
  );
  render(<RouterProvider router={router} />);
  return router;
}

it("preserves governance scope through the history redirect", async () => {
  renderApp("/ai/history?bot=10001&group=20002&scene=group_chat");

  expect(
    await screen.findByText(
      "/ai/session?bot=10001&group=20002&scene=group_chat|10001/20002",
      {},
      { timeout: 10_000 },
    ),
  ).not.toBeNull();
});

it.each([
  ["/ai/memory", "memory"],
  ["/ai/people", "people"],
  ["/ai/persona", "style"],
] as const)("redirects retired observation section %s to governance tab %s", async (from, tab) => {
  renderApp(`${from}?bot=10001&group=20002&scene=group_chat`);

  expect(
    await screen.findByText(`governance:/ai/governance?bot=10001&group=20002&scene=group_chat&tab=${tab}`),
  ).not.toBeNull();
});
