<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { PluginRow } from "@/api/pallasTypes";
import PluginIcon from "@/components/PluginIcon.vue";
import UiBadge from "@/components/ui/UiBadge.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import {
  pluginDisplayDescription,
  pluginDisplaySubtitle,
  pluginDisplayTitle,
  pluginResolvedId,
} from "@/utils/pluginDisplayMeta";
import { pluginFavoriteNames, toggleFavoritePlugin } from "@/utils/pluginFavorites";
import {
  pluginLoadBadgeText,
  pluginLoadProcessTags,
  pluginLoadWhere,
} from "@/utils/pluginLoadRoleLabel";
import { hasPluginSource, pluginSourceDir, pluginSourceLabel } from "@/utils/pluginSourceLabel";

const props = defineProps<{
  plugin: PluginRow;
  iconUrl?: string | null;
  avatarUrl?: string | null;
  active?: boolean;
}>();

const emit = defineEmits<{
  select: [];
}>();

const avatarImageFailed = ref(false);

const resolvedAvatarUrl = computed(() => {
  if (avatarImageFailed.value) return null;
  return (props.avatarUrl || "").trim() || null;
});

const title = computed(() => pluginDisplayTitle(props.plugin));
const subtitle = computed(() => pluginDisplaySubtitle(props.plugin));
const description = computed(() => pluginDisplayDescription(props.plugin));
const pluginIdValue = computed(() => pluginResolvedId(props.plugin));
const loadProcessTags = computed(() => pluginLoadProcessTags(props.plugin));

function isFavorite(name: string): boolean {
  return pluginFavoriteNames.value.has(name);
}

watch(
  () => [props.iconUrl, props.avatarUrl],
  () => {
    avatarImageFailed.value = false;
  },
);
</script>

<template>
  <UiCard
    class="plugin-store-card plugin-catalog-card"
    :active="active"
    glass
    interactive
  >
    <button
      type="button"
      class="plugin-catalog-card__fav"
      :aria-pressed="isFavorite(pluginIdValue)"
      :title="isFavorite(pluginIdValue) ? '取消收藏' : '收藏'"
      :aria-label="isFavorite(pluginIdValue) ? `取消收藏「${title}」` : `收藏「${title}」`"
      @click.stop="toggleFavoritePlugin(pluginIdValue)"
    >
      ★
    </button>

    <button
      type="button"
      class="plugin-catalog-card__hit"
      @click="emit('select')"
    >
      <div class="plugin-store-card__layout">
        <div class="plugin-store-card__media">
          <div class="plugin-store-card__cover">
            <PluginIcon
              :plugin-id="pluginIdValue"
              :label="title"
              :icon-url="iconUrl"
              size="xl"
            />
          </div>
          <div
            v-if="resolvedAvatarUrl"
            class="plugin-store-card__avatar"
          >
            <img
              :src="resolvedAvatarUrl"
              :alt="title"
              loading="lazy"
              @error="avatarImageFailed = true"
            >
          </div>
        </div>

        <div class="plugin-store-card__info">
          <h3 class="plugin-store-card__title" :title="title">
            {{ title }}
          </h3>
          <p
            v-if="subtitle"
            class="plugin-store-card__byline muted"
            :title="subtitle"
          >
            {{ subtitle }}
          </p>
        </div>

        <div
          v-if="plugin.globally_disabled || pluginLoadBadgeText(plugin) || hasPluginSource(plugin) || loadProcessTags.length"
          class="plugin-store-card__meta-row plugin-catalog-card__meta-row"
        >
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
          <span
            v-if="hasPluginSource(plugin)"
            class="plugin-store-card__meta-link plugin-store-card__meta-link--version"
            :title="pluginSourceDir(plugin) || pluginSourceLabel(plugin.plugin_source)"
          >
            {{ pluginSourceLabel(plugin.plugin_source) }}
          </span>
          <span
            v-for="tag in loadProcessTags"
            :key="tag"
            class="plugin-store-card__meta-link plugin-store-card__meta-link--version"
            :title="`${tag} 进程`"
          >
            {{ tag }} 进程
          </span>
        </div>

        <div
          v-if="description"
          class="plugin-store-card__summary"
        >
          <p
            class="plugin-store-card__desc muted"
            :title="description"
          >
            {{ description }}
          </p>
        </div>
      </div>
    </button>

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
