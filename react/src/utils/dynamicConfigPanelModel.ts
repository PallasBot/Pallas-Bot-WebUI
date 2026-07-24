/** 弹层定位 */

import type { PluginConfigField } from "@/api/console";
import type { PluginConfigFieldGroup } from "@/api/pallasTypes";
import { fieldTypeClusterRank } from "@/utils/pluginConfigFieldModel";

export interface DynamicConfigGroup {
  id: string;
  title: string;
  fields: PluginConfigField[];
  subtitle?: string;
  advanced?: boolean;
}

function fieldsForGroup(group: PluginConfigFieldGroup, fields: PluginConfigField[]): PluginConfigField[] {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const out: PluginConfigField[] = [];
  for (const name of group.field_names) {
    const field = byName.get(name);
    if (field) out.push(field);
  }
  return out;
}

function clusterByType(fields: PluginConfigField[]): PluginConfigField[] {
  return fields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => {
      const ra = fieldTypeClusterRank(a.field);
      const rb = fieldTypeClusterRank(b.field);
      if (ra !== rb) return ra - rb;
      return a.index - b.index;
    })
    .map((entry) => entry.field);
}

function sortByUiOrder(fields: PluginConfigField[]): PluginConfigField[] {
  return [...fields].sort((a, b) => {
    const ao = typeof a.ui_order === "number" ? a.ui_order : 9999;
    const bo = typeof b.ui_order === "number" ? b.ui_order : 9999;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
}

function groupByUiGroup(fields: PluginConfigField[]): DynamicConfigGroup[] {
  const buckets = new Map<string, PluginConfigField[]>();
  const order: string[] = [];
  for (const field of fields) {
    if (field.ui_hidden) continue;
    const title = String(field.ui_group || "").trim() || "配置项";
    if (!buckets.has(title)) {
      buckets.set(title, []);
      order.push(title);
    }
    buckets.get(title)!.push(field);
  }
  return order.map((title) => ({
    id: `ui:${title}`,
    title,
    fields: sortByUiOrder(buckets.get(title) ?? []),
  }));
}

export function buildDynamicConfigGroups(
  fields: PluginConfigField[],
  fieldGroups?: PluginConfigFieldGroup[],
): DynamicConfigGroup[] {
  if (!fields.length) return [];

  const hidden = sortByUiOrder(fields.filter((f) => f.ui_hidden));
  const visible = fields.filter((f) => !f.ui_hidden);

  let main: DynamicConfigGroup[] = [];
  if (fieldGroups?.length) {
    main = fieldGroups
      .map((group) => ({
        id: group.id,
        title: group.title,
        fields: fieldsForGroup(group, visible),
      }))
      .filter((group) => group.fields.length);
  }
  if (!main.length) {
    main = groupByUiGroup(visible);
    if (!main.length && visible.length) {
      main = [{ id: "all", title: "配置项", fields: sortByUiOrder(visible) }];
    }
  }

  if (hidden.length) {
    main.push({
      id: "__advanced__",
      title: "进阶",
      fields: hidden,
      advanced: true,
    });
  }
  for (const group of main) {
    group.fields = clusterByType(group.fields);
  }
  return main;
}
