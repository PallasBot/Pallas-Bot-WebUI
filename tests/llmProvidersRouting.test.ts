import { describe, expect, it } from "vitest";
import { pruneRoutingForProvider } from "../src/composables/useLlmProviders";

describe("pruneRoutingForProvider", () => {
  it("removes tasks pointing at the deleted provider", () => {
    const out = pruneRoutingForProvider(
      { chain_fallback: [], tasks: { chat: "local", tts: "remote", sing: "local" } },
      "local",
    );
    expect(out.tasks).toEqual({ tts: "remote" });
  });

  it("removes the provider from chain_fallback", () => {
    const out = pruneRoutingForProvider(
      { chain_fallback: ["local", "remote", "backup"], tasks: {} },
      "remote",
    );
    expect(out.chain_fallback).toEqual(["local", "backup"]);
  });

  it("leaves routing untouched when the provider is unreferenced", () => {
    const routing = { chain_fallback: ["a"], tasks: { chat: "a" } };
    const out = pruneRoutingForProvider(routing, "ghost");
    expect(out).toEqual(routing);
  });

  it("does not mutate the input routing object", () => {
    const routing = { chain_fallback: ["x"], tasks: { chat: "x" } };
    pruneRoutingForProvider(routing, "x");
    expect(routing.chain_fallback).toEqual(["x"]);
    expect(routing.tasks).toEqual({ chat: "x" });
  });
});
