<script setup lang="ts">
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import type { ThemeMode } from "@/utils/consolePrefs";

const nav = [
  { to: "/", label: "总览", icon: "◆" },
  { to: "/logs", label: "运行日志", icon: "≡" },
  { to: "/plugins", label: "插件", icon: "▣" },
  { to: "/common-config", label: "通用配置", icon: "⚙" },
  { to: "/instances", label: "实例与连接", icon: "◎" },
  { to: "/friends", label: "好友", icon: "☺" },
  { to: "/groups", label: "群", icon: "☷" },
  { to: "/bot-social-config", label: "颗粒配置", icon: "✧" },
  { to: "/database", label: "数据库", icon: "▤" },
  { to: "/update", label: "更新", icon: "↑" },
  { to: "/ai", label: "AI 扩展", icon: "◇" },
  { to: "/security", label: "安全", icon: "◈" },
];

function setTheme(mode: ThemeMode) {
  setConsolePrefs({ theme: mode });
}
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
        <RouterLink to="/preferences">
          <span class="shell__nav-ico">✦</span>
          外观偏好
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
        <div
          class="shell-toolbar"
          role="toolbar"
          aria-label="主题与偏好"
        >
          <div
            class="shell-toolbar__seg"
            role="group"
            aria-label="颜色模式"
          >
            <button
              type="button"
              :class="{ 'is-on': consolePrefs.theme === 'dark' }"
              @click="setTheme('dark')"
            >
              深色
            </button>
            <button
              type="button"
              :class="{ 'is-on': consolePrefs.theme === 'light' }"
              @click="setTheme('light')"
            >
              浅色
            </button>
            <button
              type="button"
              :class="{ 'is-on': consolePrefs.theme === 'system' }"
              @click="setTheme('system')"
            >
              跟随系统
            </button>
          </div>
          <RouterLink
            class="shell-toolbar__link"
            to="/preferences"
          >
            外观偏好设置 →
          </RouterLink>
        </div>
        <RouterView />
      </div>
    </div>
  </div>
</template>
