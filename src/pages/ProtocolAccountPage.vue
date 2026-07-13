<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

onMounted(() => {
  const accountId = String(route.params.accountId ?? "").trim();
  if (!accountId) {
    void router.replace({ name: "protocol" });
    return;
  }
  const tab = String(route.query.tab ?? "").trim().toLowerCase();
  void router.replace({
    name: "protocol",
    params: { accountId },
    query: tab === "settings" ? { tab: "settings" } : {},
  });
});
</script>

<template>
  <div class="console-hub-page protocol-sub-page">
    <p class="muted protocol-account-page-redirect">正在打开账号配置…</p>
  </div>
</template>

<style scoped>
.protocol-account-page-redirect {
  margin: 24px 0;
  text-align: center;
  font-size: 0.875rem;
}
</style>
