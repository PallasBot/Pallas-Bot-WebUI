import type { AiConfigSectionId } from "@/config/aiConfigSections";
import { AI_CONFIG_SECTIONS, aiConfigSectionPath } from "@/config/aiConfigSections";

/** 配置字段 → 分区深链（Cmd+K / 轨内搜索） */
export const AI_CONFIG_FIELD_DEEP_LINKS: Array<{
  keywords: string[];
  sectionId: AiConfigSectionId;
  hash?: string;
  label: string;
}> = [
  { keywords: ["provider", "模型", "ollama", "openai", "接入"], sectionId: "provider", label: "接入 · 模型服务" },
  { keywords: ["gpu", "层数", "切换模型", "卸载"], sectionId: "provider", hash: "model-admin", label: "接入 · 本地模型" },
  { keywords: ["对话", "策略", "限流", "接话", "learning", "反哺"], sectionId: "strategy", label: "对话策略" },
  { keywords: ["learning-loop", "写回", "加权"], sectionId: "strategy", hash: "learning-loop", label: "对话 · 学习闭环" },
  { keywords: ["知识库", "方舟", "语料"], sectionId: "knowledge", label: "知识库" },
  { keywords: ["能力包", "tts", "唱歌", "权重"], sectionId: "capabilities", label: "能力包" },
  { keywords: ["媒体", "gateway", "连接"], sectionId: "connection", label: "媒体服务" },
  { keywords: ["画画", "draw"], sectionId: "draw", label: "画画" },
  { keywords: ["网易云", "ncm"], sectionId: "ncm", label: "网易云" },
  { keywords: ["日志", "logs"], sectionId: "logs", label: "扩展日志" },
];

export type AiConfigSearchHit = {
  sectionId: AiConfigSectionId;
  path: string;
  label: string;
  kind: "section" | "field";
};

export function searchAiConfigTargets(query: string): AiConfigSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: AiConfigSearchHit[] = [];
  const seen = new Set<string>();

  for (const sec of AI_CONFIG_SECTIONS) {
    const hay = `${sec.id} ${sec.label} ${sec.lead}`.toLowerCase();
    if (hay.includes(q)) {
      const key = `sec:${sec.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        hits.push({
          sectionId: sec.id,
          path: aiConfigSectionPath(sec.id),
          label: sec.label,
          kind: "section",
        });
      }
    }
  }

  for (const row of AI_CONFIG_FIELD_DEEP_LINKS) {
    if (row.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))) {
      const path = row.hash
        ? `${aiConfigSectionPath(row.sectionId)}#${row.hash}`
        : aiConfigSectionPath(row.sectionId);
      const key = `field:${path}`;
      if (!seen.has(key)) {
        seen.add(key);
        hits.push({
          sectionId: row.sectionId,
          path,
          label: row.label,
          kind: "field",
        });
      }
    }
  }

  return hits.slice(0, 12);
}
