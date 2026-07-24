import { useEffect, useMemo, useState } from "react";

type TreeGroup = {
  id: string;
  label: string;
  items: { value: string; label: string }[];
};

function splitTarget(
  value: string,
  backend: "postgres" | "mongodb" | null,
): { groupId: string; groupLabel: string; itemLabel: string } {
  const dot = value.indexOf(".");
  if (dot > 0) {
    const groupId = value.slice(0, dot);
    return { groupId, groupLabel: groupId, itemLabel: value.slice(dot + 1) || value };
  }
  if (backend === "postgres") {
    return { groupId: "public", groupLabel: "public", itemLabel: value };
  }
  return { groupId: "__root__", groupLabel: "集合", itemLabel: value };
}

export default function BackupTargetTree({
  options,
  value,
  disabled,
  backend,
  onChange,
}: {
  options: string[];
  value: string[];
  disabled?: boolean;
  backend?: "postgres" | "mongodb" | null;
  onChange: (next: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groups = useMemo((): TreeGroup[] => {
    const map = new Map<string, TreeGroup>();
    for (const opt of options) {
      const { groupId, groupLabel, itemLabel } = splitTarget(opt, backend ?? null);
      let group = map.get(groupId);
      if (!group) {
        group = { id: groupId, label: groupLabel, items: [] };
        map.set(groupId, group);
      }
      group.items.push({ value: opt, label: itemLabel });
    }
    return [...map.values()]
      .map((g) => ({
        ...g,
        items: [...g.items].sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  }, [options, backend]);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (!(g.id in next)) next[g.id] = true;
      }
      return next;
    });
  }, [groups]);

  function groupSelectedCount(group: TreeGroup): number {
    return group.items.filter((item) => value.includes(item.value)).length;
  }

  function groupCheckState(group: TreeGroup): "all" | "none" | "partial" {
    const n = groupSelectedCount(group);
    if (n === 0) return "none";
    if (n === group.items.length) return "all";
    return "partial";
  }

  function setGroup(group: TreeGroup, checked: boolean) {
    const next = new Set(value);
    for (const item of group.items) {
      if (checked) next.add(item.value);
      else next.delete(item.value);
    }
    onChange([...next]);
  }

  function toggleItem(itemValue: string, checked: boolean) {
    const next = new Set(value);
    if (checked) next.add(itemValue);
    else next.delete(itemValue);
    onChange([...next]);
  }

  return (
    <div className="backup-target-tree" role="tree" aria-label={backend === "postgres" ? "选择表" : "选择集合"}>
      {!options.length ? (
        <p className="backup-target-tree__empty muted">暂无可选{backend === "postgres" ? "表" : "集合"}</p>
      ) : (
        <ul className="backup-target-tree__list">
          {groups.map((group) => {
            const isOpen = expanded[group.id] !== false;
            const checkState = groupCheckState(group);
            return (
              <li key={group.id} className="backup-target-tree__group" role="treeitem" aria-expanded={isOpen}>
                <div className="backup-target-tree__group-hd">
                  <button
                    type="button"
                    className="backup-target-tree__expand"
                    aria-label={isOpen ? `收起 ${group.label}` : `展开 ${group.label}`}
                    disabled={disabled}
                    onClick={() => setExpanded((e) => ({ ...e, [group.id]: !isOpen }))}
                  >
                    <span className="backup-target-tree__expand-ico" aria-hidden="true">
                      {isOpen ? "▾" : "▸"}
                    </span>
                  </button>
                  <span className="backup-target-tree__folder" aria-hidden="true">
                    📁
                  </span>
                  <label className="backup-target-tree__group-label">
                    <input
                      type="checkbox"
                      checked={checkState === "all"}
                      disabled={disabled}
                      aria-checked={checkState === "partial" ? "mixed" : checkState === "all"}
                      onChange={(e) => setGroup(group, e.target.checked)}
                    />
                    <span>{group.label}</span>
                    <span className="backup-target-tree__count muted">
                      {groupSelectedCount(group)}/{group.items.length}
                    </span>
                  </label>
                </div>
                {isOpen ? (
                  <ul className="backup-target-tree__children" role="group">
                    {group.items.map((item) => (
                      <li key={item.value} className="backup-target-tree__leaf" role="treeitem">
                        <label className="backup-target-tree__leaf-label">
                          <input
                            type="checkbox"
                            checked={value.includes(item.value)}
                            disabled={disabled}
                            onChange={(e) => toggleItem(item.value, e.target.checked)}
                          />
                          <span className="backup-target-tree__leaf-name" title={item.value}>
                            {item.label}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
