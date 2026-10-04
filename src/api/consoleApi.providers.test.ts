import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmProviderRow, LlmProvidersConfig } from "./console";
import * as legacyApi from "./console";
import * as consoleApi from "./consoleApi";

const transport = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock("./http", () => ({
  DB_BACKUP_TIMEOUT_MS: 10,
  DB_HEAVY_READ_TIMEOUT_MS: 20,
  axiosErrorDetail: (error: unknown) => error instanceof Error ? error.message : String(error),
  http: {
    delete: vi.fn(),
    get: transport.get,
    patch: vi.fn(),
    post: vi.fn(),
    put: transport.put,
  },
}));

const provider = {
  id: "openai",
  kind: "remote",
  base_url: "https://api.example/v1",
  api_key_env: "OPENAI_API_KEY",
  default_model: "gpt-4o",
  enabled: true,
  task_models: { chat: "gpt-4o" },
  models: [{
    model_id: "gpt-4o",
    name: "GPT-4o",
    capabilities: ["text"],
    pricing_rules: [{
      id: "tier-1",
      kind: "token",
      priority: 1,
      daily_start: "00:00",
      daily_end: "23:59",
      daily_ranges: [["00:00", "12:00"], ["12:00", "23:59"]],
      input_tokens_min: 1000,
      input_tokens_max: 2000,
      price_in: 1.2,
      price_out: 2.4,
      cache_price_in: 0.6,
      cache_price_out: 1.2,
    }, {
      id: "per-request",
      kind: "per_request",
      priority: 2,
      price_per_request: 0.05,
    }],
  }],
  model_pricing: { "gpt-4o": { price_in: 1.2, price_out: 2.4, cache_price_in: 0.6, cache_price_out: 1.2 } },
  api_key_hints: ["sk-…1234"],
  api_key_set: true,
  api_keys_count: 1,
} satisfies LlmProviderRow;

const providerWithFutureModelMetadata = {
  ...provider,
  models: provider.models?.map((model) => ({
    ...model,
    provider_metadata: { context_window: 128_000, origin: "catalog" },
  })),
};

function ok(data: unknown) {
  return { data: { ok: true, data } };
}

function config(providers: unknown = [provider], routing: unknown = {}) {
  return { providers, routing, providers_file: "llm_providers.json", file_exists: true };
}

beforeEach(() => {
  vi.clearAllMocks();
  transport.get.mockResolvedValue(ok(config()));
  transport.put.mockResolvedValue(ok({ providers_file: "llm_providers.json" }));
});

describe("LLM provider config API", () => {
  it("re-exports the canonical provider functions from the legacy API", () => {
    expect(legacyApi.fetchLlmProvidersConfig).toBe(consoleApi.fetchLlmProvidersConfig);
    expect(legacyApi.putLlmProvidersConfig).toBe(consoleApi.putLlmProvidersConfig);
    expect(legacyApi.putLlmProvider).toBe(consoleApi.putLlmProvider);
  });

  it("reads through the typed client, normalizes routing, and preserves provider metadata", async () => {
    transport.get.mockResolvedValueOnce(ok({
      ...config([providerWithFutureModelMetadata], {
        chain_fallback: ["openai"],
        tasks: { chat: "openai" },
        tier_backups: { high: " openai ", low: " " },
        tier_backup_models: { high: " gpt-4o ", low: "" },
        task_backups: { " chat ": " openai ", empty: " " },
        task_backup_models: { " chat ": " gpt-4o ", empty: " " },
        route_source: " tasks ",
        cost_currency: " cny ",
        future_route: true,
      }),
      future_config_metadata: { revision: 2 },
    }));

    const result = await consoleApi.fetchLlmProvidersConfig();

    expect(transport.get).toHaveBeenCalledWith("/common-config/llm/providers", undefined);
    expect(result.providers).toEqual([providerWithFutureModelMetadata]);
    expect(result.routing).toEqual({
      chain_fallback: ["openai"],
      tasks: { chat: "openai" },
      tier_backups: { high: "openai" },
      tier_backup_models: { high: "gpt-4o" },
      task_backups: { chat: "openai" },
      task_backup_models: { chat: "gpt-4o" },
      route_source: "tasks",
      cost_currency: "CNY",
      future_route: true,
    });
    expect(result.providers_file).toBe("llm_providers.json");
    expect(result).toMatchObject({ future_config_metadata: { revision: 2 } });
  });

  it("defaults omitted provider and routing fields", async () => {
    transport.get.mockResolvedValueOnce(ok({ providers_file: "providers.json" }));
    await expect(consoleApi.fetchLlmProvidersConfig()).resolves.toMatchObject({
      providers: [],
      routing: { chain_fallback: [], tasks: {} },
      providers_file: "providers.json",
    });
  });

  it("fills omitted optional provider fields with their schema defaults", async () => {
    transport.get.mockResolvedValueOnce(ok(config([{ id: "p", kind: "remote" }])));

    await expect(consoleApi.fetchLlmProvidersConfig()).resolves.toMatchObject({
      providers: [{
        id: "p",
        kind: "remote",
        base_url: "",
        api_key_env: "",
        default_model: "",
        enabled: false,
        task_models: {},
      }],
    });
  });

  it("rejects missing, non-object, and malformed provider config data", async () => {
    const malformed = [
      undefined,
      null,
      [],
      { providers: [], routing: [] },
      config("not-an-array"),
      config([{ ...provider, id: undefined }]),
      config([{ ...provider, kind: undefined }]),
      config([{ ...provider, api_keys: "not-an-array" }]),
      config([{ ...provider, models: "not-an-array" }]),
      config([{ ...provider, models: [null] }]),
      config([{ ...provider, model_pricing: { "gpt-4o": null } }]),
      config([{ ...provider, task_models: [] }]),
      config([provider], { tasks: [] }),
      config([provider], { chain_fallback: "openai" }),
      config([provider], { tier_backups: [] }),
      config([provider], { task_backups: { chat: 42 } }),
    ];

    for (const data of malformed) {
      transport.get.mockResolvedValueOnce(ok(data));
      await expect(consoleApi.fetchLlmProvidersConfig()).rejects.toThrow();
    }
  });

  it("rejects failed envelopes and malformed save result data", async () => {
    transport.get.mockResolvedValueOnce({ data: { ok: false, data: config() } });
    await expect(consoleApi.fetchLlmProvidersConfig()).rejects.toThrow();

    transport.put.mockResolvedValueOnce(ok(null));
    await expect(consoleApi.putLlmProvidersConfig({ providers: [], routing: { chain_fallback: [], tasks: {} } })).rejects.toThrow();

    transport.put.mockResolvedValueOnce({ data: { ok: false, data: {} } });
    await expect(consoleApi.putLlmProvidersConfig({ providers: [], routing: { chain_fallback: [], tasks: {} } })).rejects.toThrow();
    transport.put.mockRejectedValueOnce(new Error("offline"));
    await expect(consoleApi.putLlmProvidersConfig({ providers: [], routing: { chain_fallback: [], tasks: {} } })).rejects.toThrow("offline");

    await expect(consoleApi.putLlmProvider({ ...provider, models: "bad" } as unknown as LlmProviderRow)).rejects.toThrow();
    await expect(consoleApi.putLlmProvider({ ...provider, model_pricing: [] } as unknown as LlmProviderRow)).rejects.toThrow();
  });

  it("preserves complete providers on table save and omits blank/read-only key fields", async () => {
    const fullProvider = {
      ...provider,
      api_key: "  preferred-key  ",
      api_keys: ["", " alternate-key ", "  "],
      api_key_env: " OPENAI_KEY ",
    } satisfies LlmProviderRow;
    const routing = { chain_fallback: ["openai"], tasks: { chat: "openai" } } satisfies LlmProvidersConfig["routing"];
    const result = await consoleApi.putLlmProvidersConfig({ providers: [fullProvider], routing });

    expect(transport.put).toHaveBeenCalledWith("/common-config/llm/providers", {
      providers: [{
        id: fullProvider.id,
        kind: fullProvider.kind,
        base_url: fullProvider.base_url,
        api_key: "preferred-key",
        api_keys: ["alternate-key"],
        api_key_env: "OPENAI_KEY",
        default_model: fullProvider.default_model,
        models: fullProvider.models,
        enabled: fullProvider.enabled,
        task_models: fullProvider.task_models,
        capabilities: [],
        model_effort: "",
        request_method: "chat_completions",
        model_pricing: fullProvider.model_pricing,
      }],
      routing,
    }, { timeout: 60_000 });
    expect(result).toEqual({ providers_file: "llm_providers.json" });
    expect(transport.put.mock.calls[0][1].providers[0]).not.toHaveProperty("api_key_hints");
    expect(transport.put.mock.calls[0][1].providers[0]).not.toHaveProperty("api_key_set");
    expect(transport.put.mock.calls[0][1].providers[0]).not.toHaveProperty("api_keys_count");

    await consoleApi.putLlmProvidersConfig({ providers: [], routing });
    expect(transport.put.mock.calls[1][1].providers).toEqual([]);

    await consoleApi.putLlmProvidersConfig({
      providers: [{ ...fullProvider, api_key: " ", api_keys: [] }],
      routing,
    });
    expect(transport.put.mock.calls[2][1].providers[0]).not.toHaveProperty("api_key");
    expect(transport.put.mock.calls[2][1].providers[0]).not.toHaveProperty("api_keys");
  });

  it("upserts one trimmed, encoded provider without rewriting routing or other rows", async () => {
    const row = {
      ...provider,
      id: "  custom/provider  ",
      api_key: "  ",
      api_keys: [" first-key ", ""],
      api_key_env: " ENV_KEY ",
    } satisfies LlmProviderRow;

    await consoleApi.putLlmProvider(row);

    expect(transport.put).toHaveBeenCalledWith("/common-config/llm/providers/custom%2Fprovider", {
      id: "custom/provider",
      kind: row.kind,
      base_url: row.base_url,
      api_key: "first-key",
      api_keys: ["first-key"],
      api_key_env: "ENV_KEY",
      default_model: row.default_model,
      models: row.models,
      enabled: row.enabled,
      task_models: row.task_models,
      capabilities: [],
      model_effort: "",
      request_method: "chat_completions",
      model_pricing: row.model_pricing,
    }, { timeout: 60_000 });

    await expect(consoleApi.putLlmProvider({ ...row, id: "  " })).rejects.toThrow(/id is required/);
  });
});
