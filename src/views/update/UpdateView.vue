<script setup lang="ts">
import { fetchUpdateCheck, postUpdateApply, fetchBotUpdateCheck, postBotUpdateApply } from "@/api/consoleApi";
import type { UpdateCheckData, BotUpdateCheckData } from "@/api/pallasTypes";
import { ref, onMounted } from "vue";
import { Refresh, Download, SuccessFilled, WarningFilled, InfoFilled } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

const checking = ref(false);
const applying = ref(false);
const info = ref<UpdateCheckData | null>(null);
const checkError = ref<string | null>(null);

const botChecking = ref(false);
const botApplying = ref(false);
const botInfo = ref<BotUpdateCheckData | null>(null);
const botCheckError = ref<string | null>(null);

async function doCheck() {
  checking.value = true;
  checkError.value = null;
  try {
    info.value = await fetchUpdateCheck();
    if (info.value.error) checkError.value = info.value.error;
  } catch (e: unknown) {
    checkError.value = e instanceof Error ? e.message : String(e);
  } finally {
    checking.value = false;
  }
}

async function doApply() {
  applying.value = true;
  try {
    const result = await postUpdateApply();
    ElMessage.success(`更新成功：${result.tag}`);
    await doCheck();
  } catch (e: unknown) {
    ElMessage.error(`更新失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    applying.value = false;
  }
}

async function doBotCheck() {
  botChecking.value = true;
  botCheckError.value = null;
  try {
    botInfo.value = await fetchBotUpdateCheck();
    if (botInfo.value.error) botCheckError.value = botInfo.value.error;
  } catch (e: unknown) {
    botCheckError.value = e instanceof Error ? e.message : String(e);
  } finally {
    botChecking.value = false;
  }
}

async function doBotApply() {
  botApplying.value = true;
  try {
    const result = await postBotUpdateApply();
    ElMessage.success(`Bot 更新成功：${result.tag}`);
    await doBotCheck();
  } catch (e: unknown) {
    ElMessage.error(`Bot 更新失败：${e instanceof Error ? e.message : String(e)}`);
  } finally {
    botApplying.value = false;
  }
}

onMounted(() => {
  void doCheck();
  void doBotCheck();
});

function formatTime(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("zh-CN");
}
</script>

<template>
  <div class="update-view">
    <!-- WebUI 更新卡片 -->
    <div class="update-card">
      <div class="update-header">
        <span class="update-title">WebUI 更新</span>
        <el-button :icon="Refresh" :loading="checking" size="small" @click="doCheck">
          检查更新
        </el-button>
      </div>

      <div v-if="checking && !info" class="update-loading">
        <el-icon class="spin"><Refresh /></el-icon>
        <span>正在检查更新...</span>
      </div>

      <template v-else-if="info">
        <el-alert v-if="checkError" type="warning" :closable="false" class="update-alert">
          <template #title>
            <el-icon><WarningFilled /></el-icon>
            检查更新失败：{{ checkError }}
          </template>
        </el-alert>

        <div class="version-grid">
          <div class="version-item">
            <span class="version-label">当前版本</span>
            <el-tag :type="info.current_tag ? 'info' : 'warning'" size="large" class="version-tag">
              {{ info.current_tag || "未知" }}
            </el-tag>
          </div>
          <div class="version-item">
            <span class="version-label">最新版本</span>
            <el-tag v-if="info.latest_tag" :type="info.has_update ? 'success' : 'info'" size="large" class="version-tag">
              {{ info.latest_tag }}
            </el-tag>
            <el-tag v-else type="warning" size="large" class="version-tag">获取失败</el-tag>
          </div>
        </div>

        <div v-if="!checkError" class="update-status">
          <template v-if="info.has_update">
            <el-icon class="status-icon update-available"><WarningFilled /></el-icon>
            <span>发现新版本 <strong>{{ info.latest_tag }}</strong>，可点击下方按钮一键更新</span>
          </template>
          <template v-else-if="info.latest_tag">
            <el-icon class="status-icon up-to-date"><SuccessFilled /></el-icon>
            <span>已是最新版本</span>
          </template>
        </div>

        <div class="update-meta">
          <el-icon><InfoFilled /></el-icon>
          检查时间：{{ formatTime(info.checked_at) }}
        </div>

        <div class="update-actions">
          <el-button
            v-if="info.has_update"
            type="primary"
            :icon="Download"
            :loading="applying"
            size="large"
            @click="doApply"
          >
            {{ applying ? "更新中..." : `更新到 ${info.latest_tag}` }}
          </el-button>
          <a v-if="info.release_url" :href="info.release_url" target="_blank" rel="noopener" class="release-link">
            查看发布说明 →
          </a>
        </div>
      </template>

      <div v-else class="update-empty">点击"检查更新"获取版本信息</div>
    </div>

    <!-- Bot 更新卡片 -->
    <div class="update-card">
      <div class="update-header">
        <span class="update-title">Bot 更新</span>
        <el-button :icon="Refresh" :loading="botChecking" size="small" @click="doBotCheck">
          检查更新
        </el-button>
      </div>

      <div v-if="botChecking && !botInfo" class="update-loading">
        <el-icon class="spin"><Refresh /></el-icon>
        <span>正在检查更新...</span>
      </div>

      <template v-else-if="botInfo">
        <el-alert v-if="botCheckError" type="warning" :closable="false" class="update-alert">
          <template #title>
            <el-icon><WarningFilled /></el-icon>
            检查更新失败：{{ botCheckError }}
          </template>
        </el-alert>

        <div class="version-grid">
          <div class="version-item">
            <span class="version-label">当前版本</span>
            <el-tag :type="botInfo.current_tag ? 'info' : 'warning'" size="large" class="version-tag">
              {{ botInfo.current_tag || botInfo.current_commit || "未知" }}
            </el-tag>
          </div>
          <div class="version-item">
            <span class="version-label">最新版本</span>
            <el-tag v-if="botInfo.latest_tag" :type="botInfo.has_update ? 'success' : 'info'" size="large" class="version-tag">
              {{ botInfo.latest_tag }}
            </el-tag>
            <el-tag v-else type="warning" size="large" class="version-tag">获取失败</el-tag>
          </div>
        </div>

        <div v-if="!botCheckError" class="update-status">
          <template v-if="botInfo.has_update">
            <el-icon class="status-icon update-available"><WarningFilled /></el-icon>
            <span>发现新版本 <strong>{{ botInfo.latest_tag }}</strong>，可点击下方按钮执行 git pull</span>
          </template>
          <template v-else-if="botInfo.latest_tag">
            <el-icon class="status-icon up-to-date"><SuccessFilled /></el-icon>
            <span>已是最新版本</span>
          </template>
          <template v-else-if="!botInfo.current_tag">
            <el-icon class="status-icon"><InfoFilled /></el-icon>
            <span>当前未处于 Release Tag，无法比较版本</span>
          </template>
        </div>

        <div class="update-meta">
          <el-icon><InfoFilled /></el-icon>
          检查时间：{{ formatTime(botInfo.checked_at) }}
        </div>

        <div class="update-actions">
          <el-button
            v-if="botInfo.has_update"
            type="primary"
            :icon="Download"
            :loading="botApplying"
            size="large"
            @click="doBotApply"
          >
            {{ botApplying ? "更新中..." : `更新到 ${botInfo.latest_tag}` }}
          </el-button>
          <a v-if="botInfo.release_url" :href="botInfo.release_url" target="_blank" rel="noopener" class="release-link">
            查看发布说明 →
          </a>
        </div>
      </template>

      <div v-else class="update-empty">点击"检查更新"获取版本信息</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.update-view {
  padding: 24px;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.update-card {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 28px 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.update-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.update-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.update-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.update-alert {
  border-radius: 8px;
}

.version-grid {
  display: flex;
  gap: 32px;
}

.version-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.version-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.version-tag {
  font-size: 14px;
  font-weight: 600;
  font-family: monospace;
  min-width: 80px;
  justify-content: center;
}

.update-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.status-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.update-available { color: var(--el-color-warning); }
.up-to-date { color: var(--el-color-success); }

.update-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.update-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.release-link {
  font-size: 13px;
  color: var(--el-color-primary);
  text-decoration: none;
  &:hover { text-decoration: underline; }
}

.update-empty {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  text-align: center;
  padding: 20px 0;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
