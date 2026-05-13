<script setup lang="ts">
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import type { DensityMode, RadiusMode, ThemeMode } from "@/utils/consolePrefs";

function setTheme(v: ThemeMode) {
  setConsolePrefs({ theme: v });
}
function setRadius(v: RadiusMode) {
  setConsolePrefs({ radius: v });
}
function setDensity(v: DensityMode) {
  setConsolePrefs({ density: v });
}
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Preferences</p>
      <h1 class="page-hero__title">外观偏好</h1>
      <p class="page-hero__desc">主题、圆角与内容密度保存在本机浏览器，立即作用于整个控制台。</p>
    </header>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">颜色模式</h2>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0 0 12px">「跟随系统」会监听系统深色 / 浅色切换。</p>
        <div class="row-actions">
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.theme === 'dark' }"
            @click="setTheme('dark')"
          >
            深色
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.theme === 'light' }"
            @click="setTheme('light')"
          >
            浅色
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.theme === 'system' }"
            @click="setTheme('system')"
          >
            跟随系统
          </button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">圆角风格</h2>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0 0 12px">影响卡片、面板、按钮与下拉框等控件的圆角。</p>
        <div class="row-actions">
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.radius === 'tight' }"
            @click="setRadius('tight')"
          >
            紧凑
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.radius === 'default' }"
            @click="setRadius('default')"
          >
            默认
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.radius === 'round' }"
            @click="setRadius('round')"
          >
            更圆
          </button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">内容密度</h2>
      </div>
      <div class="panel__bd">
        <div class="row-actions">
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.density === 'comfortable' }"
            @click="setDensity('comfortable')"
          >
            舒适
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': consolePrefs.density === 'compact' }"
            @click="setDensity('compact')"
          >
            紧凑
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
