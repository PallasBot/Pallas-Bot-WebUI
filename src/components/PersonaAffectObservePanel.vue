<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { fetchLlmPersonaObserve } from "@/api/consoleApi";
import type { PersonaAxisSnapshot, PersonaObserveBotRow, PersonaObserveData } from "@/api/pallasTypes";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import AiObservationLinks from "@/components/ai-config/AiObservationLinks.vue";
import UiBadge from "@/components/ui/UiBadge.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { AI_CONFIG_LAYER_LINKS } from "@/config/aiEntrySemantics";
import { toastApiError } from "@/utils/consoleToastFeedback";
import {
  buildPersonaObserveFallback,
  isPersonaObserveApiMissing,
} from "@/utils/personaObserveFallback";

const props = withDefaults(
  defineProps<{
    embedded?: boolean;
    headless?: boolean;
    syncGroupId?: string;
  }>(),
  {
    embedded: false,
    headless: false,
    syncGroupId: "",
  },
);

const loading = ref(false);
const err = ref("");
const legacyMode = ref(false);
const data = ref<PersonaObserveData | null>(null);
const groupIdInput = ref("");

const groupIdParsed = computed(() => {
  const raw = groupIdInput.value.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
});

const groupIdInvalid = computed(() => {
  const raw = groupIdInput.value.trim();
  return raw.length > 0 && groupIdParsed.value == null;
});

const bots = computed(() => data.value?.bots ?? []);
const groupSnapshot = computed(() => data.value?.group_style_snapshot ?? null);
const affectRefine = computed(() => data.value?.affect_refine ?? null);
const affectTriggers = computed(() => data.value?.affect_triggers ?? []);
const overviewStats = computed(() => [
  {
    label: "Bot 数量",
    value: String(bots.value.length),
    accent: true,
  },
  {
    label: "当前群号",
    value: groupIdParsed.value ? String(groupIdParsed.value) : "仅看基线",
  },
  {
    label: "数据来源",
    value: legacyMode.value ? "降级展示" : "运行时接口",
    tone: legacyMode.value ? "warn" : "ok",
  },
  {
    label: "群画像",
    value: groupSnapshot.value ? (groupSnapshot.value.ready ? "可用" : "样本不足") : "未选择群",
    tone: groupSnapshot.value ? (groupSnapshot.value.ready ? "ok" : "warn") : "muted",
  },
]);

const axisDefs = [
  { key: "warmth" as const, label: "温和度", positive: "热络", negative: "冷淡" },
  { key: "assertiveness" as const, label: "主张度", positive: "敢接梗", negative: "被动" },
  { key: "bluntness" as const, label: "直率度", positive: "直给", negative: "客气" },
];

function formatAxis(value: number | undefined): string {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toFixed(2);
}

function axisBarStyle(value: number | undefined): Record<string, string> {
  const v = Number.isFinite(value) ? Math.max(-1, Math.min(1, Number(value))) : 0;
  const pct = Math.abs(v) * 50;
  if (v >= 0) {
    return { left: "50%", width: `${pct}%` };
  }
  return { left: `${50 + v * 50}%`, width: `${pct}%` };
}

function axisTone(value: number | undefined): "pos" | "neg" | "neutral" {
  const v = Number(value);
  if (!Number.isFinite(v) || Math.abs(v) < 0.08) return "neutral";
  return v > 0 ? "pos" : "neg";
}

function pickSnapshot(row: PersonaObserveBotRow, mode: "resolved" | "base"): PersonaAxisSnapshot {
  if (mode === "resolved" && row.resolved) return row.resolved;
  return row.base;
}

function snapshotLabel(row: PersonaObserveBotRow, mode: "resolved" | "base"): string {
  if (mode === "resolved") {
    if (!groupIdParsed.value) return "需填群号";
    if (!row.group_style_enabled) return "已关闭群风格";
    if (!row.resolved) return "无合并画像";
    return row.resolved.preset_label || row.resolved.archetype || "合并后";
  }
  return row.base.preset_label || row.base.archetype || "基线";
}

function hintsFor(row: PersonaObserveBotRow, mode: "resolved" | "base"): string[] {
  if (mode === "resolved" && row.resolved_hints.length) return row.resolved_hints;
  return row.base_hints;
}

function signalNum(signals: Record<string, unknown> | null | undefined, key: string): string {
  const raw = signals?.[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw.toFixed(3);
  if (typeof raw === "string" && raw.trim()) return raw;
  return "—";
}

function formatUpdatedAt(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return "—";
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toLocaleString();
}

function refineSourceLabel(source: string): string {
  if (source === "llm") return "LLM";
  if (source === "heuristic") return "启发式";
  if (source === "none") return "无";
  return source || "—";
}

async function load() {
  loading.value = true;
  err.value = "";
  legacyMode.value = false;
  try {
    data.value = await fetchLlmPersonaObserve({
      groupId: groupIdParsed.value,
    });
  } catch (e) {
    if (isPersonaObserveApiMissing(e)) {
      try {
        data.value = await buildPersonaObserveFallback(groupIdParsed.value);
        legacyMode.value = true;
        err.value =
          "当前 Bot 尚未注册 persona-observe 接口：已用群配置与在线账号降级展示。分片部署请确认访问主节点控制台并已重启主节点，再查看完整情感轴。";
      } catch (fallbackErr) {
        data.value = null;
        err.value = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        toastApiError(fallbackErr, "加载牛格观测失败");
      }
    } else {
      data.value = null;
      err.value = e instanceof Error ? e.message : String(e);
      toastApiError(e, "加载牛格观测失败");
    }
  } finally {
    loading.value = false;
  }
}

watch(groupIdInput, () => {
  void load();
});

watch(
  () => props.syncGroupId,
  (next) => {
    if (!props.embedded) return;
    const normalized = String(next ?? "").trim();
    if (normalized !== groupIdInput.value.trim()) {
      groupIdInput.value = normalized;
    }
  },
  { immediate: true },
);

onMounted(() => {
  void load();
});

defineExpose({ reload: load });
</script>

<template>
  <UiCard
    tag="div"
    :glass="!headless"
    class="persona-observe-panel"
    :class="{
      'persona-observe-panel--headless': headless,
      'persona-observe-panel--embedded': embedded && !headless,
    }"
  >
    <div
      v-if="!headless"
      class="panel__hd panel__hd--split persona-observe-panel__hd"
      :class="{ 'persona-observe-panel__hd--embedded': embedded }"
    >
      <div class="persona-observe-panel__hd-main">
        <h2 class="panel__title">
          {{ embedded ? "牛格观测" : "牛格情感观测" }}
        </h2>
        <div class="persona-observe-panel__summary">
          <div
            v-for="item in overviewStats"
            :key="item.label"
            class="persona-observe-panel__summary-item"
          >
            <span class="persona-observe-panel__summary-label">{{ item.label }}</span>
            <strong
              class="persona-observe-panel__summary-value"
              :class="[
                item.accent ? 'persona-observe-panel__summary-value--accent' : '',
                item.tone === 'ok' ? 'ok' : '',
                item.tone === 'warn' ? 'warn' : '',
                item.tone === 'muted' ? 'muted' : '',
              ]"
            >
              {{ item.value }}
            </strong>
          </div>
        </div>
      </div>
      <div
        v-if="!embedded"
        class="row-actions persona-observe-panel__hd-actions"
      >
        <label class="persona-observe-panel__group-field">
          <span class="persona-observe-panel__group-label">群号</span>
          <input
            v-model="groupIdInput"
            class="inp persona-observe-panel__group-inp"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="留空仅看 bot 基线"
          >
        </label>
        <RefreshIconButton
          :busy="loading"
          label="刷新"
          @click="load"
        />
      </div>
      <RefreshIconButton
        v-else
        :busy="loading"
        label="刷新"
        class="persona-observe-panel__embedded-refresh"
        @click="load"
      />
    </div>

    <div class="panel__bd">
      <p
        v-if="!embedded"
        class="muted persona-observe-panel__lede"
      >
        查看各 bot 的情感轴基线与群合并结果；数据只读，由 persona 运行时解析。
      </p>
      <div
        v-if="!embedded"
        class="persona-observe-panel__links"
      >
        <AiObservationLinks />
        <RouterLink
          :to="AI_CONFIG_LAYER_LINKS.provider.path"
          class="ai-obs-links__item"
        >
          {{ AI_CONFIG_LAYER_LINKS.provider.label }}
        </RouterLink>
      </div>

      <p
        v-if="err"
        class="alert"
        :class="legacyMode ? 'alert--warn' : 'alert--err'"
      >
        {{ err }}
      </p>
      <p
        v-if="groupIdInvalid"
        class="alert alert--warn persona-observe-panel__warn"
      >
        群号须为正整数。
      </p>

      <section
        v-if="groupIdParsed && groupSnapshot"
        class="persona-observe-panel__section"
        aria-label="群级情感画像"
      >
        <div class="persona-observe-panel__section-hd">
          <h3 class="persona-observe-panel__section-title">
            群 {{ groupIdParsed }} · 语气画像
          </h3>
          <UiBadge :variant="groupSnapshot.ready ? 'ok' : 'warn'">
            {{ groupSnapshot.ready ? "可用" : "样本不足" }}
          </UiBadge>
        </div>
        <p
          v-if="groupSnapshot.hints?.length"
          class="persona-observe-panel__hints muted"
        >
          {{ groupSnapshot.hints.join("；") }}
        </p>
        <dl
          v-if="groupSnapshot.signals"
          class="persona-observe-panel__signals"
        >
          <div>
            <dt>warmth 偏移</dt>
            <dd>{{ signalNum(groupSnapshot.signals, "warmth_bias") }}</dd>
          </div>
          <div>
            <dt>assertiveness 偏移</dt>
            <dd>{{ signalNum(groupSnapshot.signals, "assertiveness_bias") }}</dd>
          </div>
          <div>
            <dt>文明度</dt>
            <dd>{{ signalNum(groupSnapshot.signals, "civility_score") }}</dd>
          </div>
          <div>
            <dt>粗口占比</dt>
            <dd>{{ signalNum(groupSnapshot.signals, "harsh_msg_ratio") }}</dd>
          </div>
          <div>
            <dt>礼貌占比</dt>
            <dd>{{ signalNum(groupSnapshot.signals, "polite_msg_ratio") }}</dd>
          </div>
          <div>
            <dt>标点攻击性</dt>
            <dd>{{ signalNum(groupSnapshot.signals, "punct_aggression_avg") }}</dd>
          </div>
          <div>
            <dt>更新</dt>
            <dd>{{ formatUpdatedAt(groupSnapshot.updated_at ?? null) }}</dd>
          </div>
        </dl>

        <div
          v-if="affectRefine"
          class="persona-observe-panel__refine"
        >
          <div class="persona-observe-panel__refine-hd">
            <span class="muted">批次 affect-refine</span>
            <UiBadge variant="secondary">
              {{ refineSourceLabel(affectRefine.source) }}
            </UiBadge>
            <span class="muted">置信 {{ formatAxis(affectRefine.confidence) }}</span>
          </div>
          <p
            v-if="affectRefine.summary"
            class="persona-observe-panel__refine-summary"
          >
            {{ affectRefine.summary }}
          </p>
          <p class="muted persona-observe-panel__refine-delta">
            Δ warmth {{ formatAxis(affectRefine.warmth_delta) }} ·
            Δ assertiveness {{ formatAxis(affectRefine.assertiveness_delta) }}
          </p>
        </div>

        <div
          v-if="affectTriggers.length"
          class="persona-observe-panel__triggers"
        >
          <h4 class="persona-observe-panel__triggers-title">
            热路径 triggers（{{ affectTriggers.length }}）
          </h4>
          <ul class="persona-observe-panel__trigger-list">
            <li
              v-for="item in affectTriggers"
              :key="`${item.phrase}-${item.expires_at}`"
            >
              <code>{{ item.phrase }}</code>
              <span class="muted">
                w{{ formatAxis(item.warmth_delta) }} ·
                a{{ formatAxis(item.assertiveness_delta) }} ·
                ×{{ formatAxis(item.weight) }}
              </span>
            </li>
          </ul>
        </div>
      </section>

      <p
        v-if="!loading && !bots.length"
        class="muted persona-observe-panel__empty"
      >
        暂无 bot 账号：请在实例页创建 bot_config，或先让牛牛上线。
      </p>

      <div
        v-else
        class="persona-observe-panel__bot-grid"
      >
        <article
          v-for="row in bots"
          :key="row.account"
          class="persona-observe-panel__bot-card"
        >
          <header class="persona-observe-panel__bot-hd">
            <h3 class="persona-observe-panel__bot-title">
              {{ row.account }}
            </h3>
            <UiBadge
              v-if="!row.group_style_enabled"
              variant="warn"
            >
              群风格关
            </UiBadge>
            <UiBadge
              v-if="row.seed_prefs?.length"
              variant="default"
            >
              种子{{ row.seed_source === "manual" ? "·手改" : "·自动" }}：{{
                row.seed_prefs.join(" / ")
              }}
            </UiBadge>
          </header>

          <div
            v-for="mode in (groupIdParsed ? (['base', 'resolved'] as const) : (['base'] as const))"
            :key="mode"
            class="persona-observe-panel__mode-block"
          >
            <div class="persona-observe-panel__mode-label">
              <span>{{ mode === "base" ? "Bot 基线" : "群合并" }}</span>
              <span class="muted">{{ snapshotLabel(row, mode) }}</span>
            </div>
            <template v-if="mode === 'resolved' && groupIdParsed && !row.resolved">
              <p class="muted persona-observe-panel__mode-empty">
                {{ snapshotLabel(row, mode) }}
              </p>
            </template>
            <template v-else>
              <p
                v-if="legacyMode"
                class="muted persona-observe-panel__mode-empty"
              >
                降级模式：情感轴需 Bot 更新后可用
              </p>
              <div
                v-else
                v-for="axis in axisDefs"
                :key="`${row.account}-${mode}-${axis.key}`"
                class="persona-axis"
              >
                <div class="persona-axis__head">
                  <span class="persona-axis__label">{{ axis.label }}</span>
                  <span
                    class="persona-axis__value"
                    :class="`persona-axis__value--${axisTone(pickSnapshot(row, mode)[axis.key])}`"
                  >{{ formatAxis(pickSnapshot(row, mode)[axis.key]) }}</span>
                </div>
                <div
                  class="persona-axis__track"
                  :aria-label="`${axis.label} ${formatAxis(pickSnapshot(row, mode)[axis.key])}`"
                >
                  <span class="persona-axis__tick persona-axis__tick--neg">{{ axis.negative }}</span>
                  <div class="persona-axis__bar-wrap">
                    <span class="persona-axis__zero" />
                    <span
                      class="persona-axis__fill"
                      :class="`persona-axis__fill--${axisTone(pickSnapshot(row, mode)[axis.key])}`"
                      :style="axisBarStyle(pickSnapshot(row, mode)[axis.key])"
                    />
                  </div>
                  <span class="persona-axis__tick persona-axis__tick--pos">{{ axis.positive }}</span>
                </div>
              </div>
              <ul
                v-if="!legacyMode && hintsFor(row, mode).length"
                class="persona-observe-panel__hint-list muted"
              >
                <li
                  v-for="(hint, idx) in hintsFor(row, mode)"
                  :key="`${row.account}-${mode}-hint-${idx}`"
                >
                  {{ hint }}
                </li>
              </ul>
              <dl
                v-if="!legacyMode"
                class="persona-observe-panel__meta"
              >
                <div>
                  <dt>tone</dt>
                  <dd>{{ pickSnapshot(row, mode).tone || "—" }}</dd>
                </div>
                <div>
                  <dt>chaos</dt>
                  <dd>{{ formatAxis(pickSnapshot(row, mode).chaos_bias) }}</dd>
                </div>
                <div>
                  <dt>reply</dt>
                  <dd>{{ formatAxis(pickSnapshot(row, mode).reply_bias) }}</dd>
                </div>
                <div>
                  <dt>活跃</dt>
                  <dd>{{ pickSnapshot(row, mode).activity_level || "—" }}</dd>
                </div>
              </dl>
            </template>
          </div>
        </article>
      </div>
    </div>
  </UiCard>
</template>

<style scoped>
.persona-observe-panel__hd {
  align-items: flex-start;
  gap: 12px;
}

.persona-observe-panel__hd-main {
  min-width: 0;
  flex: 1 1 220px;
}

.persona-observe-panel__lede {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.55;
}

.persona-observe-panel__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.persona-observe-panel__summary-item {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--primary, var(--accent)) 18%, var(--border));
  background: color-mix(in srgb, var(--primary, var(--accent)) 5%, var(--card, var(--bg-card)));
}

.persona-observe-panel__summary-label {
  font-size: 12px;
  font-weight: 650;
  color: var(--text-muted, #64748b);
}

.persona-observe-panel__summary-value {
  font-size: 0.98rem;
  font-weight: 700;
}

.persona-observe-panel__summary-value--accent {
  font-size: 1.06rem;
}

.persona-observe-panel__summary-value.ok {
  color: var(--ok, #3d9a5c);
}

.persona-observe-panel__summary-value.warn {
  color: var(--warn, #c9a227);
}

.persona-observe-panel__summary-value.muted {
  color: var(--text-muted, #64748b);
}

.persona-observe-panel__links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 0 12px;
}

.persona-observe-panel__hd-actions {
  flex: 1 1 200px;
  justify-content: flex-end;
  align-items: flex-end;
}

.persona-observe-panel__group-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1 1 140px;
  max-width: 220px;
}

.persona-observe-panel__group-label {
  font-size: 12px;
  color: var(--muted);
}

.persona-observe-panel__group-inp {
  width: 100%;
  min-width: 0;
}

.persona-observe-panel__warn {
  margin: 0 0 12px;
}

.persona-observe-panel__section {
  margin-bottom: 18px;
  padding: 14px;
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--border);
  background: var(--surface-1);
}

.persona-observe-panel__section-hd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.persona-observe-panel__section-title {
  margin: 0;
  font-size: 15px;
}

.persona-observe-panel__hints {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.5;
}

.persona-observe-panel__signals {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px 12px;
  margin: 0;
}

.persona-observe-panel__signals dt {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
}

.persona-observe-panel__signals dd {
  margin: 2px 0 0;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.persona-observe-panel__refine {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}

.persona-observe-panel__refine-hd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.persona-observe-panel__refine-summary,
.persona-observe-panel__refine-delta {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
}

.persona-observe-panel__triggers {
  margin-top: 12px;
}

.persona-observe-panel__triggers-title {
  margin: 0 0 8px;
  font-size: 13px;
}

.persona-observe-panel__trigger-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}

.persona-observe-panel__trigger-list li {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
}

.persona-observe-panel__empty {
  margin: 0;
  font-size: 13px;
}

.persona-observe-panel__bot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.persona-observe-panel__bot-card {
  padding: 12px;
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--border);
  background: var(--surface-1);
}

.persona-observe-panel__bot-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.persona-observe-panel__bot-title {
  margin: 0;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.persona-observe-panel__mode-block + .persona-observe-panel__mode-block {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}

.persona-observe-panel__mode-label {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
}

.persona-observe-panel__mode-empty {
  margin: 0;
  font-size: 12px;
}

.persona-axis + .persona-axis {
  margin-top: 10px;
}

.persona-axis__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.persona-axis__label {
  font-size: 12px;
}

.persona-axis__value {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.persona-axis__value--pos {
  color: var(--ok, #6dd4a8);
}

.persona-axis__value--neg {
  color: var(--warn, #e8b86d);
}

.persona-axis__track {
  display: grid;
  grid-template-columns: minmax(0, 2.2em) 1fr minmax(0, 2.2em);
  gap: 6px;
  align-items: center;
}

.persona-axis__tick {
  font-size: 10px;
  color: var(--muted);
  line-height: 1.2;
}

.persona-axis__tick--neg {
  text-align: left;
}

.persona-axis__tick--pos {
  text-align: right;
}

.persona-axis__bar-wrap {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.persona-axis__zero {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: color-mix(in srgb, var(--foreground) 18%, transparent);
  transform: translateX(-50%);
  z-index: 1;
}

.persona-axis__fill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--foreground) 35%, transparent);
}

.persona-axis__fill--pos {
  background: color-mix(in srgb, var(--success) 75%, transparent);
}

.persona-axis__fill--neg {
  background: color-mix(in srgb, var(--warn) 75%, transparent);
}

.persona-observe-panel__hint-list {
  margin: 10px 0 0;
  padding-left: 1.1em;
  font-size: 12px;
  line-height: 1.45;
}

.persona-observe-panel__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 10px;
  margin: 10px 0 0;
}

.persona-observe-panel__meta dt {
  margin: 0;
  font-size: 10px;
  color: var(--muted);
}

.persona-observe-panel__meta dd {
  margin: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.persona-observe-panel__hd--embedded {
  align-items: center;
}

.persona-observe-panel--headless {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}

.persona-observe-panel--headless :deep(.panel__bd) {
  padding: 0;
}

.persona-observe-panel__embedded-refresh {
  margin-left: auto;
}

@media (max-width: 560px) {
  .persona-observe-panel__hd--embedded {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }
}

@media (max-width: 560px) {
  .persona-observe-panel__hd {
    flex-direction: column;
  }

  .persona-observe-panel__hd-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .persona-observe-panel__group-field {
    max-width: none;
  }

  .persona-observe-panel__bot-grid {
    grid-template-columns: 1fr;
  }

  .persona-axis__track {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .persona-axis__tick {
    display: none;
  }
}
</style>
