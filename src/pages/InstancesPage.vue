<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchInstances } from "@/api/consoleApi";
import type { InstancesData } from "@/api/pallasTypes";

const err = ref("");
const data = ref<InstancesData | null>(null);

onMounted(async () => {
  try {
    data.value = await fetchInstances();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Topology</p>
      <h1 class="page-hero__title">实例与连接</h1>
      <p class="page-hero__desc">汇总编排器在线情况、数据面账号及协议管理器快照，便于排障与变更前核对。</p>
    </header>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">社交数据</h2>
      </div>
      <div class="panel__bd muted">
        <p style="margin: 0 0 10px">好友列表、好友申请与群列表已拆成独立页面，便于日常运营。</p>
        <div class="row-actions">
          <RouterLink
            class="btn btn--primary"
            to="/bot-social-config"
          >颗粒配置</RouterLink>
          <RouterLink
            class="btn"
            to="/friends"
          >好友</RouterLink>
          <RouterLink
            class="btn"
            to="/groups"
          >群</RouterLink>
        </div>
      </div>
    </div>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <template v-if="data">
      <div class="panel">
        <div class="panel__hd">
          <h2 class="panel__title">NoneBot 连接</h2>
        </div>
        <div class="panel__bd">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>self_id</th>
                  <th>adapter</th>
                  <th>connection_key</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(b, i) in data.nonebot_bots"
                  :key="i"
                >
                  <td>{{ b.self_id }}</td>
                  <td>{{ b.adapter }}</td>
                  <td class="muted">{{ b.connection_key }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__hd">
          <h2 class="panel__title">数据库中的 Bot 配置</h2>
        </div>
        <div class="panel__bd">
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>account</th>
                  <th>security</th>
                  <th>auto_accept_friend</th>
                  <th>auto_accept_group</th>
                  <th>disabled_plugins</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in data.db_bot_configs"
                  :key="c.account"
                >
                  <td>{{ c.account }}</td>
                  <td>{{ c.security }}</td>
                  <td>{{ c.auto_accept_friend }}</td>
                  <td>{{ c.auto_accept_group }}</td>
                  <td class="muted">{{ c.disabled_plugins?.join(", ") }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div
        v-if="data.pallas_protocol"
        class="panel"
      >
        <div class="panel__hd">
          <h2 class="panel__title">协议管理（{{ data.pallas_protocol.plugin }}）</h2>
        </div>
        <div class="panel__bd">
          <p class="muted">WebUI：{{ data.pallas_protocol.webui_enabled ? "启用" : "关闭" }} · 路径 {{ data.pallas_protocol.webui_path }}</p>
          <div class="table-wrap">
            <table class="data">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>运行</th>
                  <th>已连接</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(a, i) in data.pallas_protocol.accounts"
                  :key="i"
                >
                  <td>{{ a.qq || a.id }}</td>
                  <td>{{ a.process_running ?? a.running }}</td>
                  <td>{{ a.connected }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
