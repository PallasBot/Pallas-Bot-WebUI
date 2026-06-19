<script setup lang="ts">
import type { PluginRow } from "@/api/pallasTypes";
import PluginIcon from "@/components/PluginIcon.vue";
import UiBadge from "@/components/ui/UiBadge.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { pluginFavoriteNames, toggleFavoritePlugin } from "@/utils/pluginFavorites";
import {
  hasPluginLoadWhere,
  pluginLoadBadgeText,
  pluginLoadWhere,
} from "@/utils/pluginLoadRoleLabel";
import { hasPluginSource, pluginSourceDir, pluginSourceLabel } from "@/utils/pluginSourceLabel";

defineProps<{
  plugin: PluginRow;
  iconUrl?: string | null;
  active?: boolean;
}>();

const emit = defineEmits<{
  select: [];
}>();

function displayTitle(p: PluginRow): string {
  return p.metadata?.name || p.nb_plugin_name || p.name;
}

function pluginId(p: PluginRow): string {
  return (p.resolved_plugin_id || p.name || "").trim();
}

function isFavorite(name: string): boolean {
  return pluginFavoriteNames.value.has(name);
}
</script>

<template>
  <UiCard
    class="plugin-catalog-card"
    :active="active"
    interactive
    glass
  >
    <div class="plugin-catalog-card__body">
      <button
        type="button"
        class="plugin-catalog-card__main"
        @click="emit('select')"
      >
        <PluginIcon
          :plugin-id="pluginId(plugin)"
          :label="displayTitle(plugin)"
          :icon-url="iconUrl"
          size="md"
        />
        <div class="plugin-catalog-card__text">
          <div class="plugin-catalog-card__title-row">
            <h3 class="plugin-catalog-card__title" :title="displayTitle(plugin)">
              {{ displayTitle(plugin) }}
            </h3>
            <UiBadge
              v-if="plugin.globally_disabled"
              variant="muted"
            >
              已禁用
            </UiBadge>
            <UiBadge
              v-if="pluginLoadBadgeText(plugin)"
              variant="warn"
              :title="pluginLoadWhere(plugin)"
            >
              {{ pluginLoadBadgeText(plugin) }}
            </UiBadge>
          </div>
          <p
            v-if="plugin.nb_plugin_name && plugin.nb_plugin_name !== pluginId(plugin) && displayTitle(plugin) !== plugin.nb_plugin_name"
            class="muted plugin-catalog-card__id"
          >
            {{ plugin.nb_plugin_name }}
          </p>
          <p
            class="muted plugin-catalog-card__desc"
            :title="(plugin.metadata?.description || plugin.module) || undefined"
          >
            {{ plugin.metadata?.description || plugin.module }}
          </p>
          <p
            v-if="hasPluginSource(plugin)"
            class="plugin-catalog-card__meta muted"
          >
            {{ pluginSourceLabel(plugin.plugin_source) }}
            <template v-if="pluginSourceDir(plugin)">
              · {{ pluginSourceDir(plugin) }}
            </template>
          </p>
          <p
            v-if="hasPluginLoadWhere(plugin)"
            class="plugin-catalog-card__meta muted"
          >
            {{ pluginLoadWhere(plugin) }}
          </p>
        </div>
      </button>
      <button
        type="button"
        class="plugin-catalog-card__fav"
        :aria-pressed="isFavorite(pluginId(plugin))"
        :title="isFavorite(pluginId(plugin)) ? '取消收藏' : '收藏'"
        :aria-label="isFavorite(pluginId(plugin)) ? `取消收藏「${displayTitle(plugin)}」` : `收藏「${displayTitle(plugin)}」`"
        @click.stop="toggleFavoritePlugin(pluginId(plugin))"
      >
        ★
      </button>
    </div>
    <template #footer>
      <UiButton
        variant="primary"
        block
        @click="emit('select')"
      >
        编辑配置
      </UiButton>
    </template>
  </UiCard>
</template>
