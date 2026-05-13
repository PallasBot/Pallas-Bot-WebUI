<script setup lang="ts">
const nav = [
  { to: "/", label: "总览", icon: "◆" },
  { to: "/logs", label: "运行日志", icon: "≡" },
  { to: "/plugins", label: "插件", icon: "▣" },
  { to: "/common-config", label: "通用配置", icon: "⚙" },
  { to: "/instances", label: "实例与连接", icon: "◎" },
  { to: "/database", label: "数据库", icon: "▤" },
  { to: "/update", label: "更新", icon: "↑" },
  { to: "/ai", label: "AI 扩展", icon: "◇" },
  { to: "/security", label: "安全", icon: "◈" },
];
</script>

<template>
  <div class="shell">
    <div class="shell__bg" aria-hidden="true" />
    <aside class="shell__sidebar">
      <div class="shell__brand">
        <div class="shell__logo">Operations</div>
        <div class="shell__title">Pallas</div>
      </div>
      <nav class="shell__nav" aria-label="主导航">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :end="item.to === '/'"
        >
          <span class="shell__nav-ico">{{ item.icon }}</span>
          {{ item.label }}
        </RouterLink>
      </nav>
      <footer class="shell__foot">
        控制台与机器人通过
        <code style="font-size: 10px; color: var(--text-muted)">/pallas/api</code>
        通信
      </footer>
    </aside>
    <div class="shell__main">
      <div class="shell__main-inner">
        <RouterView />
      </div>
    </div>
  </div>
</template>
