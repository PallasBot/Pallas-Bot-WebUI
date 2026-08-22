// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { useAiObservationScope } from "@/components/ai/AiObservationScopeContext";
import AiObservationLayout from "./AiObservationLayout";

vi.mock("@/components/ai/AiObservationChromeTools", () => ({
  default: ({ onSectionChange }: { onSectionChange: (section: "tasks") => void }) => (
    <button onClick={() => onSectionChange("tasks")}>切换到任务</button>
  ),
}));

function ScopeLocationProbe() {
  const location = useLocation();
  const { botId, groupId } = useAiObservationScope();
  return <div>{`${location.pathname}${location.search}|${botId}/${groupId}`}</div>;
}

it("preserves governance scope query while switching observation sections", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={["/ai/session?bot=10001&group=20002&scene=group_chat"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/ai" element={<AiObservationLayout />}>
            <Route path="session" element={<ScopeLocationProbe />} />
            <Route path="tasks" element={<ScopeLocationProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(await screen.findByText("/ai/session?bot=10001&group=20002&scene=group_chat|10001/20002")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "切换到任务" }));
  expect(await screen.findByText("/ai/tasks?bot=10001&group=20002&scene=group_chat|10001/20002")).not.toBeNull();
});
