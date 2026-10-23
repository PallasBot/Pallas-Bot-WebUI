// @vitest-environment jsdom
import { lazy, Suspense } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/components/ConsoleSetupGuard", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/layout/AppShell", () => ({ default: () => <Outlet /> }));
vi.mock("@/pages/ProtocolPage", async () => {
  const { Outlet: RouterOutlet } = await import("react-router-dom");
  return {
    default: () => (
      <div>
        协议连接页
        <RouterOutlet />
      </div>
    ),
  };
});
vi.mock("@/pages/protocol/ProtocolAccountsTab", () => ({ default: () => <div>账号列表</div> }));
vi.mock("@/pages/InstancesPage", () => ({ default: () => <div>实例管理</div> }));
vi.mock("@/pages/HomePage", () => ({ default: () => <div>首页</div> }));

const App = lazy(() => import("@/App"));
afterEach(cleanup);

function renderApp(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <Suspense fallback={null}>
            <App />
          </Suspense>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

it("serves the protocol connection page at /protocol", async () => {
  const router = renderApp("/protocol");

  expect(await screen.findByText("协议连接页", undefined, { timeout: 5000 })).not.toBeNull();
  expect(await screen.findByText("账号列表", undefined, { timeout: 5000 })).not.toBeNull();
  expect(router.state.location.pathname).toBe("/protocol");
  expect(screen.queryByText("实例管理")).toBeNull();
});

it.each([
  "/protocol/create",
  "/protocol/import",
  "/protocol/assets",
  "/protocol/runtime",
  "/protocol/123/edit",
])("folds the retired management sub-page %s back to /protocol", async (path) => {
  const router = renderApp(path);

  await waitFor(() => expect(router.state.location.pathname).toBe("/protocol"), { timeout: 5000 });
  expect(await screen.findByText("协议连接页", undefined, { timeout: 5000 })).not.toBeNull();
});

it("keeps the legacy plugin config link out of the protocol page", async () => {
  const router = renderApp("/plugins/pb_protocol");

  await waitFor(() => expect(router.state.location.pathname).toBe("/instances"), { timeout: 5000 });
});

it("routes the legacy common-config section to the protocol page", async () => {
  const router = renderApp("/common-config/pb_protocol");

  await waitFor(() => expect(router.state.location.pathname).toBe("/protocol"), { timeout: 5000 });
});
