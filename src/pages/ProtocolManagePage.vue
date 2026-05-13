<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchInstances, fetchSystem } from "@/api/consoleApi";
import type { InstancesData, SystemData } from "@/api/pallasTypes";
import { botHttpBaseFromSystem, protocolDashboardUrl, protocolSnapshot, yn } from "@/utils/protocolLinks";

const err = ref("");
const system = ref<SystemData | null>(null);
const instances = ref<InstancesData | null>(null);

const snap = computed(() => protocolSnapshot(instances.value));
const dashUrl = computed(() => protocolDashboardUrl(system.value, snap.value));
const botBase = computed(() => botHttpBaseFromSystem(system.value));

async function load() {
  err.value = "";
  try {
    const [s, i] = await Promise.all([fetchSystem(), fetchInstances()]);
    system.value = s;
    instances.value = i;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Protocol</p>
      <h1 class="page-hero__title">协议端管理</h1>
      <p class="page-hero__desc">
        打开挂载在牛牛 HTTP 服务上的协议内置管理页（路径取自实例快照）；用于日常运维与排障。
      </p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">入口</h2>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0 0 10px">
          牛牛基址：<strong style="color: var(--text)">{{ botBase ?? "（未配置 console.http_base）" }}</strong>
        </p>
        <p class="muted" style="margin: 0 0 10px">
          内置 WebUI：<strong style="color: var(--text)">{{ snap?.webui_enabled ? "已启用" : "未启用" }}</strong>
          <span v-if="snap?.webui_path"> · 路径 <code>{{ snap.webui_path }}</code></span>
        </p>
        <p class="muted" style="margin: 0 0 14px">
          控制台鉴权已配置：<strong style="color: var(--text)">{{ snap?.console_auth_configured ? "是" : "否" }}</strong>
        </p>
        <div class="row-actions">
          <a
            v-if="dashUrl"
            class="btn btn--primary"
            :href="dashUrl"
            target="_blank"
            rel="noopener noreferrer"
          >打开协议端管理</a>
          <span
            v-else
            class="muted"
          >当前无法拼接管理页 URL（请检查 http_base、webui_enabled 与 webui_path）。</span>
          <RouterLink
            class="btn"
            to="/instances"
          >实例与连接</RouterLink>
          <RouterLink
            class="btn"
            to="/"
          >返回总览</RouterLink>
        </div>
      </div>
    </div>

    <div
      v-if="(snap?.accounts?.length ?? 0) > 0"
      class="panel"
    >
      <div class="panel__hd">
        <h2 class="panel__title">协议账号</h2>
      </div>
      <div class="panel__bd">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>账号</th>
                <th>进程</th>
                <th>已连接</th>
                <th>WebUI 端口</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(a, i) in snap?.accounts ?? []"
                :key="i"
              >
                <td>{{ a.qq ?? a.id ?? "—" }}</td>
                <td>{{ yn(a.process_running ?? a.running) }}</td>
                <td>{{ yn(a.connected) }}</td>
                <td class="muted">{{ a.webui_port ?? "—" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="row-actions">
      <button
        type="button"
        class="btn btn--primary"
        @click="load"
      >
        刷新
      </button>
    </div>
  </div>
</template>
