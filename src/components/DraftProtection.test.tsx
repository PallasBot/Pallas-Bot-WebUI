// @vitest-environment jsdom
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryRouter,
  Link,
  Route,
  Routes,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { expect, it } from "vitest";
import { DraftProtectionProvider, useDraftProtection } from "@/components/DraftProtection";

function DraftSource({ id }: { id: string }) {
  const [value, setValue] = useState("");
  useDraftProtection(Boolean(value));
  return <input aria-label={`draft ${id}`} value={value} onChange={(event) => setValue(event.target.value)} />;
}

function LocationOutput() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}${location.hash}`}</output>;
}

function EditRoute() {
  const [sources, setSources] = useState(["one", "two"]);
  return (
    <>
      <LocationOutput />
      {sources.map((id) => <DraftSource key={id} id={id} />)}
      <button type="button" onClick={() => setSources((current) => current.filter((id) => id !== "one"))}>
        remove first editor
      </button>
      <Link to="?filter=recent#results">change filter</Link>
      <Link to="/next">leave</Link>
    </>
  );
}

function renderRoutes(initialEntry = "/edit?filter=all#top") {
  const router = createMemoryRouter(
    [{
      path: "*",
      element: (
        <DraftProtectionProvider>
          <Routes>
            <Route path="/edit" element={<EditRoute />} />
            <Route path="/next" element={<LocationOutput />} />
          </Routes>
        </DraftProtectionProvider>
      ),
    }],
    { initialEntries: [initialEntry] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

function HistoryRoot() {
  return (
    <DraftProtectionProvider>
      <DraftSource id="persistent" />
      <Routes>
        <Route path="/prior" element={<LocationOutput />} />
        <Route path="/edit" element={<LocationOutput />} />
      </Routes>
    </DraftProtectionProvider>
  );
}

function renderHistory() {
  const router = createMemoryRouter([{ path: "*", element: <HistoryRoot /> }], {
    initialEntries: ["/prior", "/edit"],
    initialIndex: 1,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

it("does not block in-place filters; cancel preserves draft and URL, confirm navigates once", async () => {
  const user = userEvent.setup();
  const router = renderRoutes();

  await user.click(screen.getByRole("link", { name: "change filter" }));
  expect(screen.getByText("/edit?filter=recent#results")).not.toBeNull();
  expect(screen.queryByRole("alertdialog")).toBeNull();

  await user.type(screen.getByLabelText("draft two"), "keep me");
  await user.click(screen.getByRole("link", { name: "leave" }));
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  expect(router.state.location.pathname).toBe("/edit");
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(router.state.location.pathname).toBe("/edit");
  expect((screen.getByLabelText("draft two") as HTMLInputElement).value).toBe("keep me");

  await user.click(screen.getByRole("link", { name: "leave" }));
  await user.click(await screen.findByRole("button", { name: "离开页面" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/next"));
});

it("keeps protection while another editor is dirty and releases it after all editors unmount", async () => {
  const user = userEvent.setup();
  const router = renderRoutes();
  await user.type(screen.getByLabelText("draft one"), "dirty");
  await user.type(screen.getByLabelText("draft two"), "dirty");
  await user.click(screen.getByRole("button", { name: "remove first editor" }));
  await user.click(screen.getByRole("link", { name: "leave" }));
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "取消" }));

  await user.clear(screen.getByLabelText("draft two"));
  await user.click(screen.getByRole("link", { name: "leave" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/next"));
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("registers beforeunload only while a draft is dirty", async () => {
  const user = userEvent.setup();
  renderRoutes();
  const cleanEvent = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(cleanEvent);
  expect(cleanEvent.defaultPrevented).toBe(false);

  await user.type(screen.getByLabelText("draft one"), "dirty");
  const dirtyEvent = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(dirtyEvent);
  expect(dirtyEvent.defaultPrevented).toBe(true);
});

it("blocks back and forward history transitions while a persistent draft is dirty", async () => {
  const user = userEvent.setup();
  const router = renderHistory();
  const draft = screen.getByLabelText("draft persistent");
  await user.type(draft, "keep");

  await router.navigate(-1);
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(router.state.location.pathname).toBe("/edit");

  await user.clear(draft);
  await router.navigate(-1);
  await waitFor(() => expect(router.state.location.pathname).toBe("/prior"));

  await user.type(screen.getByLabelText("draft persistent"), "forward");
  await router.navigate(1);
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "离开页面" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/edit"));
});
