import { describe, expect, it } from "vitest";
import {
  groupExpressionView,
  scopedSemanticStyleQuality,
  semanticStyleQualityView,
} from "@/utils/groupExpressionModel";

describe("groupExpressionView", () => {
  it("格式化 aggregate、reply shape 与 examples summary", () => {
    const view = groupExpressionView({
      aggregate: {
        sample_count: 12,
        window_hours: 168,
        message_count: 40,
        answer_count: 10,
        distinct_answer_keywords: 8,
        active_hour_count: 5,
        messages_per_active_hour: 8.5,
        message_length: { average: 20, p50: 14, p90: 42 },
        answer_ratio: 0.25,
        repetition_rate: 0.125,
        contamination_skipped_messages: 2,
        contamination_skipped_answers: 1,
        forced_teach_weight: 0,
      },
      reply_shape: {
        length_pref: "short",
        bubble_count_p50: 1,
        bubble_count_p90: 3,
        segment_char_length_p50: 9,
        segment_char_length_p90: 24,
        rhythm_distribution: { single: 7, burst: 3 },
      },
      examples_summary: {
        profile_ref: "group:1",
        scene: "banter",
        sample_count: 10,
        direct_example_count: 4,
        direct_pair_count: 3,
        rewrite_seed_count: 2,
        intensity_counts: { light: 6, strong: 4 },
        form_counts: { text: 8, image: 2 },
      },
      updated_at: "2026-01-01T08:00:00Z",
    });

    expect(view.meta.windowHours).toBe("168 小时");
    expect(view.meta.updatedAt).not.toBe("—");
    expect(view.sampleGroup).toContainEqual(["样本数", "12"]);
    expect(view.sampleGroup).toContainEqual(["消息 / 回答", "40 / 10"]);
    expect(view.sampleGroup).toContainEqual(["回答率（回复 / 消息）", "25.0%"]);
    expect(view.replyShape).toContainEqual(["每条回复段数", "1 ~ 3 段"]);
    expect(view.replyShape).toContainEqual(["每段字数", "约 9 字，偶尔到 24"]);
    expect(view.qualityGroup).toContainEqual(["复读率", "12.5%"]);
    expect(view.qualityGroup).toContainEqual(["疑似污染已排除", "消息 2 · 回复 1"]);
    expect(view.exampleScene).toBe("banter");
    expect(view.exampleGroup).toContainEqual(["语义样本", "10 组"]);
    expect(view.exampleGroup).toContainEqual(["直给样例", "4 · 其中配对 3"]);
    // 节奏分布归一化为占比条目；未知 key 保留原文
    expect(view.rhythm).toEqual([
      { label: "单条", ratio: 0.7, value: "70%" },
      { label: "burst", ratio: 0.3, value: "30%" },
    ]);
    expect(view.summary.length).toBe("偏短促");
    expect(view.summary.rhythm).toBe("节奏以单条为主（70%）");
    expect(view.lowSample).toBe(false);
  });

  it("样本不足时标记 lowSample", () => {
    const view = groupExpressionView({
      aggregate: {
        sample_count: 2,
        window_hours: 24,
        message_count: 2,
        answer_count: 0,
        distinct_answer_keywords: 0,
        active_hour_count: 1,
        messages_per_active_hour: 2,
        answer_ratio: 0,
        repetition_rate: 0,
        forced_teach_weight: 0,
        contamination_skipped_messages: 0,
        contamination_skipped_answers: 0,
      },
      reply_shape: {
        length_pref: "any",
        bubble_count_p50: 1,
        bubble_count_p90: 1,
        segment_char_length_p50: 6,
        segment_char_length_p90: 6,
      },
      examples_summary: {
        profile_ref: "group:1",
        scene: "banter",
        sample_count: 0,
        direct_example_count: 0,
        direct_pair_count: 0,
        rewrite_seed_count: 0,
      },
    });

    expect(view.lowSample).toBe(true);
    expect(view.summary.length).toBe("尚未形成稳定长度偏好");
    expect(view.summary.sample).toBe("暂未整理出足够的语义样本");
    expect(view.rhythm).toEqual([]);
    expect(view.qualityGroup).toContainEqual(["疑似污染已排除", "无"]);
  });

  it("兼容旧群画像字段", () => {
    const view = groupExpressionView(null, {
      updated_at: 1767225600,
      sample: { message_count: 20, answer_count: 4, window_hours: 24 },
      raw: {
        avg_plain_len: 18,
        p50_plain_len: 12,
        msgs_per_hour_active: 3.5,
        local_answer_ratio: 0.2,
        repeat_chain_rate: 0.1,
      },
    });

    expect(view.meta.windowHours).toBe("24 小时");
    expect(view.meta.updatedAt).not.toBe("—");
    expect(view.sampleGroup).toContainEqual(["消息 / 回答", "20 / 4"]);
    expect(view.replyShape).toContainEqual(["平均 / P50 消息长度", "18 / 12"]);
    expect(view.qualityGroup).toContainEqual(["复读率", "10.0%"]);
  });
});

describe("semanticStyleQualityView", () => {
  it("格式化真实 nested status 而不字符串化对象", () => {
    const rows = semanticStyleQualityView({
      status: {
        enabled: true,
        overrides: { aggressive: true, nonsense: false, direct: true, image: false },
        example_count: 12,
        profile_count: 3,
        backfill_cursor: {
          before_created_at: 0,
          before_message_id: 0,
          day_started_at: 0,
          enqueued_today: 0,
        },
      },
      label_version: 2,
      positive_bot_style_count: 5,
    });

    expect(rows).toContainEqual(["状态", "已启用"]);
    expect(rows).toContainEqual(["样例 / 画像", "12 / 3"]);
    expect(rows.flat().join(" ")).not.toContain("[object Object]");
  });

  it("切换 Bot 或群后不显示上一范围的质量结果", () => {
    const quality = {
      status: {
        enabled: true,
        overrides: { aggressive: false, nonsense: false, direct: true, image: false },
        example_count: 12,
        profile_count: 3,
        backfill_cursor: {},
      },
      label_version: 2,
      positive_bot_style_count: 5,
    };
    const stored = { scopeKey: "100:42", data: quality };

    expect(scopedSemanticStyleQuality(stored, 100, 42)).toEqual(quality);
    expect(scopedSemanticStyleQuality(stored, 100, 43)).toBeNull();
    expect(scopedSemanticStyleQuality(stored, 101, 42)).toBeNull();
  });
});
