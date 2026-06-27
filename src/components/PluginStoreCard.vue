<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import PluginIcon from "@/components/PluginIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";

export interface PluginStoreMenuItem {
  id: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle: string;
    description?: string;
    author?: string;
    pluginId: string;
    iconUrl?: string | null;
    avatarUrl?: string | null;
    installed?: boolean;
    installBusy?: boolean;
    updateBusy?: boolean;
    uninstallBusy?: boolean;
    installQueued?: boolean;
    updateQueued?: boolean;
    /** @deprecated 使用 installBusy / updateBusy / uninstallBusy */
    busy?: boolean;
    repoUrl?: string | null;
    menuItems?: PluginStoreMenuItem[];
    showInstall?: boolean;
    showUninstall?: boolean;
    /** 更新按钮可点击（否则显示禁用的「最新」） */
    showUpdate?: boolean;
    installLabel?: string;
    uninstallLabel?: string;
    updateLabel?: string;
    latestLabel?: string;
    statusLabel?: string;
    installedVersionLabel?: string;
    latestVersionLabel?: string;
    detailLabel?: string;
    canOpen?: boolean;
    metaLinkLabel?: string;
    metaLinkUrl?: string | null;
  }>(),
  {
    description: "",
    author: "",
    iconUrl: null,
    avatarUrl: null,
    installed: false,
    installBusy: false,
    updateBusy: false,
    uninstallBusy: false,
    installQueued: false,
    updateQueued: false,
    busy: false,
    repoUrl: null,
    menuItems: () => [],
    showInstall: false,
    showUninstall: false,
    showUpdate: false,
    installLabel: "安装",
    uninstallLabel: "卸载",
    updateLabel: "更新",
    latestLabel: "最新",
    statusLabel: "",
    installedVersionLabel: "",
    latestVersionLabel: "",
    detailLabel: "详情",
    canOpen: true,
    metaLinkLabel: "",
    metaLinkUrl: null,
  },
);

const emit = defineEmits<{
  open: [];
  install: [];
  uninstall: [];
  update: [];
  "menu-action": [id: string];
}>();

const menuOpen = ref(false);
const menuRoot = ref<HTMLElement | null>(null);
const avatarImageFailed = ref(false);

const resolvedAvatarUrl = computed(() => {
  if (avatarImageFailed.value) return null;
  return (props.avatarUrl || "").trim() || null;
});

const cardBusy = computed(
  () => Boolean(
    props.busy
    || props.installBusy
    || props.updateBusy
    || props.uninstallBusy
    || props.installQueued
    || props.updateQueued,
  ),
);
const footLocked = computed(() => Boolean(
  props.updateBusy
  || props.uninstallBusy
  || props.installBusy
  || props.busy
  || props.installQueued
  || props.updateQueued,
));
const hasMenu = computed(() => props.menuItems.some((item) => !item.disabled));
const hasMetaLink = computed(() => Boolean((props.metaLinkLabel || "").trim() && (props.metaLinkUrl || "").trim()));
const versionChips = computed(() => {
  const chips: Array<{ key: string; value: string }> = [];
  const installed = (props.installedVersionLabel || "").trim();
  if (installed) {
    chips.push({ key: "installed", value: installed });
  }
  return chips;
});

function shortVersionLabel(value: string): string {
  const trimmed = value.trim();
  if (/^[0-9a-f]{6,40}$/i.test(trimmed)) {
    return trimmed.slice(0, 5);
  }
  return trimmed;
}

function onCardClick() {
  if (!props.canOpen) return;
  emit("open");
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function closeMenu() {
  menuOpen.value = false;
}

function onMenuItem(item: PluginStoreMenuItem) {
  if (item.disabled) return;
  closeMenu();
  emit("menu-action", item.id);
}

function onDocumentClick(event: MouseEvent) {
  if (!menuOpen.value) return;
  const root = menuRoot.value;
  if (root && !root.contains(event.target as Node)) {
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
});

watch(
  () => [props.iconUrl, props.avatarUrl],
  () => {
    avatarImageFailed.value = false;
  },
);
</script>

<template>
  <UiCard
    tag="article"
    class="plugin-store-card"
    :class="{
      'plugin-store-card--installed': installed,
      'plugin-store-card--busy': cardBusy,
      'plugin-store-card--clickable': canOpen,
    }"
    glass
    :interactive="canOpen"
    @click="onCardClick"
  >
    <div
      v-if="hasMenu"
      ref="menuRoot"
      class="plugin-store-card__menu-corner"
    >
      <button
        type="button"
        class="btn plugin-store-card__menu-trigger"
        :aria-expanded="menuOpen"
        aria-haspopup="menu"
        aria-label="更多操作"
        :disabled="footLocked"
        @click.stop="toggleMenu"
      >
        ⋯
      </button>
      <div
        v-if="menuOpen"
        class="plugin-store-card__menu"
        role="menu"
      >
        <button
          v-for="item in menuItems"
          :key="item.id"
          type="button"
          role="menuitem"
          class="plugin-store-card__menu-item"
          :class="{ 'plugin-store-card__menu-item--danger': item.danger }"
          :disabled="item.disabled"
          @click="onMenuItem(item)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <div class="plugin-store-card__layout">
      <div class="plugin-store-card__media">
        <div class="plugin-store-card__cover">
          <PluginIcon
            :plugin-id="pluginId"
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
            :alt="author || title"
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
          v-if="author"
          class="plugin-store-card__byline muted"
          :title="author"
        >
          {{ author }}
        </p>
        <div
          v-if="hasMetaLink || versionChips.length"
          class="plugin-store-card__meta-row"
        >
          <a
            v-if="hasMetaLink"
            class="plugin-store-card__meta-link"
            :href="metaLinkUrl || undefined"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
          >
            {{ metaLinkLabel }}
          </a>
          <span
            v-for="chip in versionChips"
            :key="chip.key"
            class="plugin-store-card__meta-link plugin-store-card__meta-link--version"
            :title="chip.value"
          >
            {{ shortVersionLabel(chip.value) }}
          </span>
        </div>
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

    <template #footer>
      <div
        class="plugin-store-card__foot"
        @click.stop
      >
        <div class="plugin-store-card__foot-main">
        <template v-if="showUninstall">
          <UiButton
            class="plugin-store-card__foot-btn"
            :variant="showUpdate ? 'primary' : 'latest'"
            block
            :disabled="footLocked || !showUpdate || updateQueued"
            :busy="updateBusy"
            @click="showUpdate && !updateQueued && emit('update')"
          >
            <svg
              class="ui-btn__ico plugin-store-card__foot-ico"
              viewBox="0 0 24 24"
              width="15"
              height="15"
              aria-hidden="true"
            >
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
              />
            </svg>
            <span>{{ updateBusy ? "更新中…" : updateQueued ? "排队中" : showUpdate ? updateLabel : latestLabel }}</span>
          </UiButton>
          <UiButton
            class="plugin-store-card__foot-btn"
            variant="destructive"
            block
            :disabled="footLocked"
            :busy="uninstallBusy"
            @click="emit('uninstall')"
          >
            <svg
              class="ui-btn__ico plugin-store-card__foot-ico"
              viewBox="0 0 24 24"
              width="15"
              height="15"
              aria-hidden="true"
            >
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 6h18M8 6V4h8v2m-1 14H9a2 2 0 0 1-2-2V8h10v10a2 2 0 0 1-2 2Z"
              />
            </svg>
            <span>{{ uninstallBusy ? "卸载中…" : uninstallLabel }}</span>
          </UiButton>
        </template>
        <template v-else-if="showInstall">
          <UiButton
            class="plugin-store-card__foot-btn"
            variant="primary"
            block
            :disabled="footLocked || installQueued"
            :busy="installBusy || busy"
            @click="!installQueued && emit('install')"
          >
            <svg
              class="ui-btn__ico plugin-store-card__foot-ico"
              viewBox="0 0 24 24"
              width="15"
              height="15"
              aria-hidden="true"
            >
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
              />
            </svg>
            <span>{{ installBusy || busy ? "安装中…" : installQueued ? "排队中" : installLabel }}</span>
          </UiButton>
          <UiButton
            v-if="repoUrl"
            class="plugin-store-card__foot-btn"
            variant="outline"
            block
            :href="repoUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ detailLabel }}
          </UiButton>
          <UiButton
            v-else-if="canOpen"
            class="plugin-store-card__foot-btn"
            variant="outline"
            block
            @click="emit('open')"
          >
            {{ detailLabel }}
          </UiButton>
        </template>
        <template v-else>
          <UiButton
            v-if="canOpen"
            class="plugin-store-card__foot-btn plugin-store-card__foot-btn--full"
            variant="outline"
            block
            @click="emit('open')"
          >
            {{ detailLabel }}
          </UiButton>
          <UiButton
            v-else-if="repoUrl"
            class="plugin-store-card__foot-btn plugin-store-card__foot-btn--full"
            variant="outline"
            block
            :href="repoUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ detailLabel }}
          </UiButton>
        </template>
      </div>
    </div>
    </template>
  </UiCard>
</template>
