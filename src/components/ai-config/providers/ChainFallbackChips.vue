<script setup lang="ts">
import { computed } from "vue";
import UiButton from "@/components/ui/UiButton.vue";
import { addFallbackId, moveFallbackIndex, removeFallbackId } from "@/utils/chainFallbackOrder";

const props = defineProps<{
  chainFallback: string[];
  providerIds: string[];
}>();

const emit = defineEmits<{
  "set-chain": [ids: string[]];
}>();

const fallbackChoices = computed(() =>
  props.providerIds.filter((id) => !props.chainFallback.includes(id)),
);

function moveFallback(index: number, dir: -1 | 1) {
  emit("set-chain", moveFallbackIndex(props.chainFallback, index, dir));
}

function removeFallback(index: number) {
  emit("set-chain", removeFallbackId(props.chainFallback, index));
}

function addFallback(id: string) {
  const next = addFallbackId(props.chainFallback, id);
  if (next.join("\n") !== props.chainFallback.join("\n")) emit("set-chain", next);
}
</script>

<template>
  <section class="chain-fallback-chips">
    <div class="chain-fallback-chips__head">
      <h4 class="chain-fallback-chips__title">链路兜底顺序</h4>
      <p class="muted chain-fallback-chips__hint">
        未命中任务路由时，按此顺序依次尝试 Provider。
      </p>
    </div>

    <div
      v-if="chainFallback.length"
      class="chain-fallback-chips__list"
    >
      <span
        v-for="(id, i) in chainFallback"
        :key="id"
        class="chain-fallback-chips__chip"
      >
        <span class="chain-fallback-chips__rank">{{ i + 1 }}</span>
        <span class="chain-fallback-chips__id">{{ id }}</span>
        <span class="chain-fallback-chips__actions">
          <UiButton
            variant="ghost"
            size="sm"
            :disabled="i === 0"
            :aria-label="`${id} 上移`"
            @click="moveFallback(i, -1)"
          >
            ↑
          </UiButton>
          <UiButton
            variant="ghost"
            size="sm"
            :disabled="i === chainFallback.length - 1"
            :aria-label="`${id} 下移`"
            @click="moveFallback(i, 1)"
          >
            ↓
          </UiButton>
          <UiButton
            variant="ghost"
            size="sm"
            :aria-label="`${id} 移除`"
            @click="removeFallback(i)"
          >
            ×
          </UiButton>
        </span>
      </span>
    </div>
    <p
      v-else
      class="muted chain-fallback-chips__empty"
    >
      未设置兜底顺序。
    </p>

    <select
      v-if="fallbackChoices.length"
      class="inp chain-fallback-chips__add"
      aria-label="添加 Provider 到兜底链"
      @change="addFallback(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''"
    >
      <option value="">+ 添加 Provider 到兜底链…</option>
      <option
        v-for="providerId in fallbackChoices"
        :key="providerId"
        :value="providerId"
      >
        {{ providerId }}
      </option>
    </select>
  </section>
</template>

<style scoped>
.chain-fallback-chips {
  display: grid;
  gap: 10px;
}

.chain-fallback-chips__title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 700;
}

.chain-fallback-chips__hint,
.chain-fallback-chips__empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.chain-fallback-chips__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chain-fallback-chips__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 6px 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.chain-fallback-chips__rank {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: color-mix(in srgb, var(--accent, #7c3aed) 16%, transparent);
}

.chain-fallback-chips__id {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 650;
}

.chain-fallback-chips__actions {
  display: inline-flex;
  gap: 2px;
}

.chain-fallback-chips__add {
  max-width: 280px;
}

@media (max-width: 560px) {
  .chain-fallback-chips__list,
  .chain-fallback-chips__chip {
    display: grid;
    width: 100%;
  }

  .chain-fallback-chips__chip {
    grid-template-columns: auto minmax(0, 1fr) auto;
    border-radius: 12px;
  }

  .chain-fallback-chips__add {
    max-width: none;
  }
}
</style>
