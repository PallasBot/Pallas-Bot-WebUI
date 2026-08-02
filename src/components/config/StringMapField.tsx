import { useEffect, useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import TagsInput from "@/components/config/TagsInput";
import { Button } from "@/components/ui/button";
import UiInput from "@/components/ui/UiInput";
import { cn } from "@/lib/utils";

/** 一组：一个 Speaker id ← 多个中文/别名 */
export type StringMapGroup = { speakerId: string; aliases: string[] };

/** 解析为 string→string 对象则返回分组；否则 null（应回退 textarea）。 */
export function tryParseStringMapGroups(raw: string): StringMapGroup[] | null {
  const text = (raw || "").trim();
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const order: string[] = [];
    const map = new Map<string, string[]>();
    for (const [alias, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "string") return null;
      const speakerId = value;
      if (!map.has(speakerId)) {
        map.set(speakerId, []);
        order.push(speakerId);
      }
      map.get(speakerId)!.push(alias);
    }
    return order.map((speakerId) => ({
      speakerId,
      aliases: map.get(speakerId) || [],
    }));
  } catch {
    return null;
  }
}

/** 兼容检测：非 null 表示可用键值编辑器 */
export function tryParseStringMap(raw: string): StringMapGroup[] | null {
  return tryParseStringMapGroups(raw);
}

export function stringMapGroupsToJson(groups: StringMapGroup[]): string {
  const out: Record<string, string> = {};
  for (const group of groups) {
    const speakerId = group.speakerId.trim();
    if (!speakerId) continue;
    for (const alias of group.aliases) {
      const key = String(alias || "").trim();
      if (!key) continue;
      out[key] = speakerId;
    }
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

/**
 * 确保映射里有该 Speaker 一组；已存在则不动。
 * 新建时默认用音色 id 作为一条命令前缀（空别名无法落盘进 JSON）。
 */
export function ensureStringMapSpeakerGroup(
  raw: string,
  speakerId: string,
): { next: string; created: boolean } | null {
  const id = speakerId.trim();
  if (!id) return null;
  const groups = tryParseStringMapGroups(raw);
  if (groups == null) return null;
  if (groups.some((g) => g.speakerId.trim() === id)) {
    return { next: stringMapGroupsToJson(groups), created: false };
  }
  return {
    next: stringMapGroupsToJson([...groups, { speakerId: id, aliases: [id] }]),
    created: true,
  };
}

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  maxWidth?: string;
  speakerPlaceholder?: string;
  aliasPlaceholder?: string;
};

/** string→string JSON：按 Speaker 分组，多别名用芯片输入。 */
export default function StringMapField({
  value,
  onValueChange,
  className,
  maxWidth = "100%",
  speakerPlaceholder = "Speaker id",
  aliasPlaceholder = "输入别名后回车…",
}: Props) {
  const baseId = useId();
  const [groups, setGroups] = useState<StringMapGroup[]>(() => tryParseStringMapGroups(value) ?? []);

  useEffect(() => {
    const parsed = tryParseStringMapGroups(value);
    if (parsed == null) return;
    setGroups((prev) => {
      if (stringMapGroupsToJson(prev) === stringMapGroupsToJson(parsed)) return prev;
      return parsed;
    });
  }, [value]);

  function commit(next: StringMapGroup[]) {
    setGroups(next);
    onValueChange(stringMapGroupsToJson(next));
  }

  function updateGroup(index: number, patch: Partial<StringMapGroup>) {
    commit(groups.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeGroup(index: number) {
    commit(groups.filter((_, i) => i !== index));
  }

  function addGroup() {
    commit([...groups, { speakerId: "", aliases: [] }]);
  }

  return (
    <div className={cn("string-map-field", className)} style={{ maxWidth }}>
      {groups.length ? (
        <ul className="string-map-field__list">
          {groups.map((group, index) => (
            <li key={`${baseId}-${index}`} className="string-map-field__group">
              <div className="string-map-field__group-head">
                <UiInput
                  className="string-map-field__speaker"
                  type="text"
                  autoComplete="off"
                  placeholder={speakerPlaceholder}
                  aria-label={`第 ${index + 1} 组 Speaker id`}
                  value={group.speakerId}
                  onValueChange={(v) => updateGroup(index, { speakerId: v })}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="string-map-field__remove shrink-0"
                  aria-label={`删除第 ${index + 1} 组`}
                  onClick={() => removeGroup(index)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
              <TagsInput
                className="string-map-field__aliases"
                variant="embedded"
                value={group.aliases}
                onChange={(aliases) => updateGroup(index, { aliases })}
                placeholder={aliasPlaceholder}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="string-map-field__empty muted">暂无映射；添加一组后，可为同一 Speaker 填多个别名。</p>
      )}
      <Button type="button" size="sm" variant="outline" className="string-map-field__add" onClick={addGroup}>
        <Plus className="size-3.5" aria-hidden />
        添加一组
      </Button>
    </div>
  );
}
