<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { protocolApiErrorMessage, protocolImportAccounts } from "@/api/protocolApi";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PageChrome from "@/components/PageChrome.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import UiInput from "@/components/ui/UiInput.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { useProtocolMount } from "@/composables/useProtocolMount";
import { pushConsoleToast } from "@/utils/consoleToast";

const router = useRouter();
const panelNavIcon = usePanelNavIcon();
const { err, pageReady, mountUrl } = useProtocolMount();

const sourceDir = ref("");
const wsUrl = ref("");
const wsToken = ref("");
const dryRun = ref(false);
const skipExisting = ref(true);
const busy = ref(false);
const result = ref<Record<string, unknown> | null>(null);

const importResultCounts = computed(() => {
  const r = result.value;
  const len = (key: string) => (Array.isArray(r?.[key]) ? (r![key] as unknown[]).length : 0);
  return { imported: len("imported"), skipped: len("skipped"), failed: len("failed") };
});

const importFailedRows = computed(() => {
  const rows = result.value?.failed;
  return Array.isArray(rows)
    ? rows.filter((x): x is { folder?: string; reason?: string } => typeof x === "object" && x != null)
    : [];
});

async function submitImport() {
  const mount = mountUrl.value;
  if (!mount) {
    pushConsoleToast("协议端未就绪", "warn");
    return;
  }
  if (!sourceDir.value.trim()) {
    pushConsoleToast("请填写账号文件夹根目录", "warn");
    return;
  }
  busy.value = true;
  result.value = null;
  try {
    const data = await protocolImportAccounts(mount, {
      source_dir: sourceDir.value.trim(),
      dry_run: dryRun.value,
      skip_existing: skipExisting.value,
      ws_url: wsUrl.value.trim(),
      ws_token: wsToken.value,
    });
    result.value = data;
    const imported = Array.isArray(data.imported) ? data.imported : [];
    const n = imported.length;
    pushConsoleToast(dryRun.value ? `预检完成：可导入 ${n} 个` : `已导入 ${n} 个账号`, n ? "ok" : "warn");
    if (!dryRun.value && n > 0) {
      setTimeout(() => {
        void router.push("/protocol");
      }, 1200);
    }
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "导入失败"), "err");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="console-hub-page protocol-sub-page">
    <ConsolePageSkeleton v-if="!pageReady" :panels="1" />
    <template v-else>
      <div
        v-if="err"
        class="alert alert--err"
      >
        {{ err }}
      </div>
      <PageChrome
        :icon="panelNavIcon"
        title="导入协议账号"
        lead="从本地账号目录批量导入；可先 dry run 预检。"
      >
        <template #actions>
          <RouterLink
            custom
            v-slot="{ navigate }"
            to="/protocol"
          >
            <UiButton
              variant="outline"
              @click="navigate"
            >
              返回实例列表
            </UiButton>
          </RouterLink>
        </template>
      </PageChrome>
      <UiCard
        tag="div"
        glass
        class="protocol-sub-page__panel"
      >
        <div class="panel__bd protocol-form-grid">
          <label class="field field--full">
            <span class="field__label">账号文件夹根目录</span>
            <UiInput
              v-model="sourceDir"
              placeholder="/path/to/instances"
              autocomplete="off"
            />
          </label>
          <label class="field field--full">
            <span class="field__label">默认 WS 地址</span>
            <UiInput
              v-model="wsUrl"
              autocomplete="off"
            />
          </label>
          <label class="field field--full">
            <span class="field__label">WS Token</span>
            <UiInput
              v-model="wsToken"
              type="password"
              revealable
              autocomplete="off"
            />
          </label>
          <label class="field field--check">
            <input
              v-model="dryRun"
              type="checkbox"
            >
            仅预检（dry run）
          </label>
          <label class="field field--check">
            <input
              v-model="skipExisting"
              type="checkbox"
            >
            跳过已存在账号
          </label>
          <div class="field field--full row-actions">
            <UiButton
              variant="primary"
              :disabled="!mountUrl"
              :busy="busy"
              @click="submitImport"
            >
              {{ dryRun ? "开始预检" : "开始导入" }}
            </UiButton>
          </div>
        </div>
      </UiCard>
      <UiCard
        v-if="result"
        tag="div"
        glass
        class="protocol-sub-page__panel"
      >
        <div class="panel__hd">
          <h3 class="panel__title">
            导入结果
          </h3>
        </div>
        <div class="panel__bd protocol-import-result">
          <p>
            已导入：{{ importResultCounts.imported }} · 跳过：{{ importResultCounts.skipped }} · 失败：{{ importResultCounts.failed }}
          </p>
          <ul
            v-if="importFailedRows.length"
            class="protocol-import-result__list"
          >
            <li
              v-for="(row, i) in importFailedRows"
              :key="'f-' + i"
            >
              {{ row.folder || "—" }}：{{ row.reason }}
            </li>
          </ul>
        </div>
      </UiCard>
    </template>
  </div>
</template>

