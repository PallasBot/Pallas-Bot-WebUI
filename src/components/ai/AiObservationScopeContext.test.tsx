// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { AiObservationScopeProvider, useAiObservationScope } from "./AiObservationScopeContext";

function ScopeProbe() {
  const { botId, groupId } = useAiObservationScope();
  return <div>{`${botId}/${groupId}`}</div>;
}

it("hydrates observation scope from governance detail query", () => {
  render(
    <MemoryRouter
      initialEntries={["/ai/session?bot=10001&group=20002&scene=group_chat"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AiObservationScopeProvider>
        <ScopeProbe />
      </AiObservationScopeProvider>
    </MemoryRouter>,
  );

  expect(screen.getByText("10001/20002")).not.toBeNull();
});
