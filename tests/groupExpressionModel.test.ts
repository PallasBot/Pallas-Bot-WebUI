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
        scene: "group",
        sample_count: 10,
        direct_example_count: 4,
        direct_pair_count: 3,
        rewrite_seed_count: 2,
        intensity_counts: { light: 6, strong: 4 },
        form_counts: { text: 8, image: 2 },
      },
    });

    expect(view.aggregate).toContainEqual(["活跃小时", "5"]);
    expect(view.aggregate).toContainEqual(["消息长度 P50 / P90", "14 / 42"]);
    expect(view.aggregate).toContainEqual(["回答率", "25.0%"]);
    expect(view.replyShape).toContainEqual(["气泡 P50 / P90", "1 / 3"]);
    expect(view.exampleSummary).toContainEqual(["直给样例 / 配对", "4 / 3"]);
    expect(view.rhythm).toBe("single 7 · burst 3");
  });

  it("兼容旧群画像字段", () => {
    const view = groupExpressionView(null, {
      sample: { message_count: 20, answer_count: 4, window_hours: 24 },
      raw: {
        avg_plain_len: 18,
        p50_plain_len: 12,
        msgs_per_hour_active: 3.5,
        local_answer_ratio: 0.2,
        repeat_chain_rate: 0.1,
      },
    });

    expect(view.aggregate).toContainEqual(["消息 / 回答", "20 / 4"]);
    expect(view.aggregate).toContainEqual(["平均 / P50 长度", "18 / 12"]);
    expect(view.aggregate).toContainEqual(["复读率", "10.0%"]);
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
