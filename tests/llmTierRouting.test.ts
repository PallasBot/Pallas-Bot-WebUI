import { describe, expect, it } from "vitest";
import {
  applyLocalTiers,
  applyTaskTiers,
  foldLocalTiers,
  foldTaskTiers,
} from "../react/src/utils/llmTierRouting";

describe("llmTierRouting task tiers", () => {
  it("expands high/low primary into task routes and chain", () => {
    const doc = {
      providers: [
        { id: "cloud", default_model: "gpt-4o", task_models: {} },
        { id: "local", default_model: "qwen", task_models: {} },
      ],
      routing: { chain_fallback: [], tasks: {} },
    };
    const next = applyTaskTiers(doc, {
      high: {
        primary: { providerId: "cloud", model: "gpt-4o" },
        backup: { providerId: "local", model: "qwen14" },
      },
      low: {
        primary: { providerId: "local", model: "qwen7" },
        backup: { providerId: "cloud", model: "gpt-mini" },
      },
    });
    expect(next.routing.tasks.llm_chat).toBe("cloud");
    expect(next.routing.tasks.repeater_select).toBe("local");
    expect(next.routing.chain_fallback).toEqual(["cloud", "local"]);
    expect(next.providers.find((p) => p.id === "cloud")?.task_models.llm_chat).toBe("gpt-4o");
    expect(next.providers.find((p) => p.id === "local")?.task_models.repeater_select).toBe("qwen7");
    expect(next.providers.find((p) => p.id === "local")?.task_models.llm_chat).toBe("qwen14");
    expect(next.providers.find((p) => p.id === "cloud")?.task_models.repeater_select).toBe(
      "gpt-mini",
    );
  });

  it("keeps distinct high-backup and low-primary models on shared provider", () => {
    const doc = {
      providers: [
        { id: "ds", default_model: "flash", task_models: {} },
        { id: "local", default_model: "qwen", task_models: {} },
      ],
      routing: { chain_fallback: [], tasks: {} },
    };
    const next = applyTaskTiers(doc, {
      high: {
        primary: { providerId: "ds", model: "flash" },
        backup: { providerId: "local", model: "qwen14" },
      },
      low: {
        primary: { providerId: "local", model: "qwen7" },
        backup: { providerId: "ds", model: "flash" },
      },
    });
    const local = next.providers.find((p) => p.id === "local");
    expect(local?.task_models.llm_chat).toBe("qwen14");
    expect(local?.task_models.repeater_select).toBe("qwen7");
    const folded = foldTaskTiers(next);
    expect(folded.high.backup).toEqual({ providerId: "local", model: "qwen14" });
    expect(folded.low.primary).toEqual({ providerId: "local", model: "qwen7" });
    expect(folded.low.backup).toEqual({ providerId: "ds", model: "flash" });
  });

  it("does not bounce backup model to default_model after clear", () => {
    const doc = {
      providers: [
        {
          id: "ds",
          default_model: "flash",
          task_models: { llm_chat: "flash", drunk: "flash", repeater_polish: "flash" },
        },
        {
          id: "local",
          default_model: "qwen",
          task_models: {
            llm_chat: "qwen14",
            drunk: "qwen14",
            repeater_polish: "qwen14",
            repeater_select: "qwen7",
            repeater_polish_lite: "qwen7",
            repeater_fallback: "qwen7",
          },
        },
      ],
      routing: {
        chain_fallback: ["ds", "local"],
        tasks: {
          llm_chat: "ds",
          drunk: "ds",
          repeater_polish: "ds",
          repeater_select: "local",
          repeater_polish_lite: "local",
          repeater_fallback: "local",
        },
      },
    };
    const next = applyTaskTiers(doc, {
      high: {
        primary: { providerId: "ds", model: "flash" },
        backup: { providerId: "local", model: "" },
      },
      low: {
        primary: { providerId: "local", model: "qwen7" },
        backup: { providerId: "ds", model: "" },
      },
    });
    expect(next.providers.find((p) => p.id === "local")?.task_models.llm_chat).toBeUndefined();
    expect(next.providers.find((p) => p.id === "local")?.task_models.repeater_select).toBe("qwen7");
    const folded = foldTaskTiers(next);
    expect(folded.high.backup.model).toBe("");
    expect(folded.low.backup.model).toBe("");
  });

  it("folds majority task routes back into tiers", () => {
    const folded = foldTaskTiers({
      providers: [
        {
          id: "cloud",
          default_model: "gpt-4o",
          task_models: { llm_chat: "gpt-4o", drunk: "gpt-4o", repeater_polish: "gpt-4o" },
        },
        {
          id: "local",
          default_model: "qwen",
          task_models: {
            repeater_select: "qwen7",
            repeater_polish_lite: "qwen7",
            repeater_fallback: "qwen7",
          },
        },
      ],
      routing: {
        chain_fallback: ["cloud", "local"],
        tasks: {
          llm_chat: "cloud",
          drunk: "cloud",
          repeater_polish: "cloud",
          repeater_select: "local",
          repeater_polish_lite: "local",
          repeater_fallback: "local",
        },
      },
    });
    expect(folded.high.primary.providerId).toBe("cloud");
    expect(folded.low.primary.providerId).toBe("local");
    expect(folded.high.backup.providerId).toBe("local");
  });

  it("keeps backup provider when crossed with the other tier primary", () => {
    const doc = {
      providers: [
        { id: "ds", default_model: "flash", task_models: {} },
        { id: "local", default_model: "qwen", task_models: {} },
      ],
      routing: { chain_fallback: [], tasks: {} },
    };
    const crossed = applyTaskTiers(doc, {
      high: {
        primary: { providerId: "ds", model: "flash" },
        backup: { providerId: "local", model: "qwen14" },
      },
      low: {
        primary: { providerId: "local", model: "qwen7" },
        backup: { providerId: "ds", model: "flash" },
      },
    });
    expect(crossed.routing.tier_backups).toEqual({ high: "local", low: "ds" });
    expect(crossed.routing.tier_backup_models).toEqual({ high: "qwen14", low: "flash" });

    // 交叉主备时把高级备用改成空，不应被 low.primary=local 顶回
    const cleared = applyTaskTiers(crossed, {
      ...foldTaskTiers(crossed),
      high: {
        primary: { providerId: "ds", model: "flash" },
        backup: { providerId: "", model: "" },
      },
    });
    expect(cleared.routing.tier_backups).toEqual({ low: "ds" });
    expect(foldTaskTiers(cleared).high.backup.providerId).toBe("");
    expect(foldTaskTiers(cleared).low.backup.providerId).toBe("ds");

    // 改低级备用为未指定
    const clearedLow = applyTaskTiers(crossed, {
      ...foldTaskTiers(crossed),
      low: {
        primary: { providerId: "local", model: "qwen7" },
        backup: { providerId: "", model: "" },
      },
    });
    expect(foldTaskTiers(clearedLow).low.backup.providerId).toBe("");
    expect(foldTaskTiers(clearedLow).high.backup.providerId).toBe("local");
  });

  it("allows same provider with a different backup model", () => {
    const doc = {
      providers: [{ id: "ds", default_model: "flash", task_models: {} }],
      routing: { chain_fallback: [], tasks: {} },
    };
    const next = applyTaskTiers(doc, {
      high: {
        primary: { providerId: "ds", model: "flash" },
        backup: { providerId: "ds", model: "reasoner" },
      },
      low: {
        primary: { providerId: "ds", model: "flash" },
        backup: { providerId: "ds", model: "chat" },
      },
    });
    expect(next.routing.tier_backups).toEqual({ high: "ds", low: "ds" });
    expect(next.routing.tier_backup_models).toEqual({ high: "reasoner", low: "chat" });
    // 同提供方备用不得覆盖主配置 task_models
    expect(next.providers[0]?.task_models.llm_chat).toBe("flash");
    expect(next.providers[0]?.task_models.repeater_select).toBe("flash");
    const folded = foldTaskTiers(next);
    expect(folded.high.backup).toEqual({ providerId: "ds", model: "reasoner" });
    expect(folded.low.backup).toEqual({ providerId: "ds", model: "chat" });
    expect(folded.high.primary.model).toBe("flash");
  });
});

describe("llmTierRouting local tiers", () => {
  it("maps primary/backup into moe sibling slots", () => {
    const next = applyLocalTiers(
      { llm_model: "old", moe_models: {}, task_models: {} },
      {
        high: { primary: "c14", backup: "c7" },
        low: { primary: "m7", backup: "m05" },
      },
    );
    expect(next.moe_models).toEqual({
      complex: "c14",
      vision: "c7",
      medium: "m7",
      simple: "m05",
    });
    expect(next.llm_model).toBe("m7");
    expect(next.task_models?.llm_chat).toBe("c14");
    expect(next.task_models?.repeater_select).toBe("m7");
  });

  it("folds moe sibling slots when backup differs", () => {
    const folded = foldLocalTiers({
      llm_model: "m7",
      moe_models: { complex: "c14", vision: "c7", medium: "m7", simple: "m05" },
    });
    expect(folded.high).toEqual({ primary: "c14", backup: "c7" });
    expect(folded.low).toEqual({ primary: "m7", backup: "m05" });
  });

  it("treats identical sibling as no backup", () => {
    const folded = foldLocalTiers({
      moe_models: { complex: "c14", vision: "c14", medium: "m7", simple: "m7" },
    });
    expect(folded.high.backup).toBe("");
    expect(folded.low.backup).toBe("");
  });
});
