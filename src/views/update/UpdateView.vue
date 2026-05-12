<script setup lang="ts">
import { fetchUpdateCheck, postUpdateApply, fetchBotUpdateCheck, postBotUpdateApply } from "@/api/consoleApi";
import type { UpdateCheckData, BotUpdateCheckData } from "@/api/pallasTypes";
import { ref, onMounted } from "vue";
import {
  Refresh,
  Download,
  SuccessFilled,
  WarningFilled,
  InfoFilled,
  Monitor,
  Cpu,
  Right,
} from "@element-plus/icons-vue";
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
    ElMessage.success(`更新成功：${result.version ?? result.tag}`);
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
    <header class="page-head">
      <h1 class="page-title">版本与更新</h1>
      <p class="page-desc">
        分别检查<strong>控制台静态资源</strong>与<strong>Bot 主仓</strong>的发布版本；有更新时可一键拉取，建议在低峰时段操作并留意进程重启策略。
      </p>
    </header>

    <div class="cards-grid">
      <!-- 控制台前端（静态资源）更新 -->
      <div class="update-card">
        <div class="card-top">
          <div class="card-icon-wrap web">
            <el-icon :size="22"><Monitor /></el-icon>
          </div>
          <div class="card-head-text">
            <div class="update-header">
              <span class="update-title">控制台前端</span>
              <el-button :icon="Refresh" :loading="checking" size="small" @click="doCheck">检查更新</el-button>
            </div>
            <p class="card-blurb">随 Bot 进程挂载的 Web 静态文件；更新后刷新浏览器即可加载新资源。</p>
          </div>
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

          <div class="version-compare">
            <div class="ver-col">
              <span class="version-label">当前</span>
              <el-tag :type="info.current_tag ? 'info' : 'warning'" size="large" class="version-tag">
                {{ info.current_tag || "未知" }}
              </el-tag>
            </div>
            <el-icon class="ver-arrow"><Right /></el-icon>
            <div class="ver-col">
              <span class="version-label">远程最新</span>
              <el-tag v-if="info.latest_tag" :type="info.has_update ? 'success' : 'info'" size="large" class="version-tag">
                {{ info.latest_tag }}
              </el-tag>
              <el-tag v-else type="warning" size="large" class="version-tag">获取失败</el-tag>
            </div>
          </div>

          <div v-if="!checkError" class="update-status">
            <template v-if="info.has_update">
              <el-icon class="status-icon update-available"><WarningFilled /></el-icon>
              <span>发现新版本 <strong>{{ info.latest_tag }}</strong>，可一键更新静态资源</span>
            </template>
            <template v-else-if="info.latest_tag">
              <el-icon class="status-icon up-to-date"><SuccessFilled /></el-icon>
              <span>已是最新版本</span>
            </template>
          </div>

          <div class="card-footer">
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
                @click="doApply"
              >
                {{ applying ? "更新中..." : `更新到 ${info.latest_tag}` }}
              </el-button>
              <a v-if="info.release_url" :href="info.release_url" target="_blank" rel="noopener" class="release-link">
                发布说明
              </a>
            </div>
          </div>
        </template>

        <div v-else class="update-empty">
          <p>尚未拉取版本信息</p>
          <el-button type="primary" plain :icon="Refresh" @click="doCheck">立即检查</el-button>
        </div>
      </div>

      <!-- Bot 主程序更新 -->
      <div class="update-card">
        <div class="card-top">
          <div class="card-icon-wrap bot">
            <el-icon :size="22"><Cpu /></el-icon>
          </div>
          <div class="card-head-text">
            <div class="update-header">
              <span class="update-title">Bot 主程序</span>
              <el-button :icon="Refresh" :loading="botChecking" size="small" @click="doBotCheck">检查更新</el-button>
            </div>
            <p class="card-blurb">对主仓执行 git 拉取；需具备写权限与可用远端，更新后可能需重启 Bot 进程。</p>
          </div>
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

          <div class="version-compare">
            <div class="ver-col">
              <span class="version-label">当前</span>
              <el-tag :type="botInfo.current_tag ? 'info' : 'warning'" size="large" class="version-tag">
                {{ botInfo.current_tag || botInfo.current_commit || "未知" }}
              </el-tag>
              <span v-if="botInfo.current_commit && botInfo.current_tag" class="commit-hint" :title="botInfo.current_commit">
                {{ botInfo.current_commit.slice(0, 7) }}
              </span>
            </div>
            <el-icon class="ver-arrow"><Right /></el-icon>
            <div class="ver-col">
              <span class="version-label">远程最新</span>
              <el-tag v-if="botInfo.latest_tag" :type="botInfo.has_update ? 'success' : 'info'" size="large" class="version-tag">
                {{ botInfo.latest_tag }}
              </el-tag>
              <el-tag v-else type="warning" size="large" class="version-tag">获取失败</el-tag>
            </div>
          </div>

          <div v-if="!botCheckError" class="update-status">
            <template v-if="botInfo.has_update">
              <el-icon class="status-icon update-available"><WarningFilled /></el-icon>
              <span>发现新版本 <strong>{{ botInfo.latest_tag }}</strong>，将执行 git pull</span>
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

          <div class="card-footer">
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
                @click="doBotApply"
              >
                {{ botApplying ? "更新中..." : `更新到 ${botInfo.latest_tag}` }}
              </el-button>
              <a v-if="botInfo.release_url" :href="botInfo.release_url" target="_blank" rel="noopener" class="release-link">
                发布说明
              </a>
            </div>
          </div>
        </template>

        <div v-else class="update-empty">
          <p>尚未拉取版本信息</p>
          <el-button type="primary" plain :icon="Refresh" @click="doBotCheck">立即检查</el-button>
        </div>
      </div>
    </div>

    <el-alert class="page-foot-tip" type="info" :closable="false" show-icon>
      <template #title>操作建议</template>
      先更新 Bot 再更新控制台，或按你的发布流程执行；生产环境请在维护窗口操作，并确认备份与回滚方式。
    </el-alert>
  </div>
</template>

<style scoped lang="scss">
.update-view {
  padding: 20px 24px 32px;
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-head {
  padding: 4px 0 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.page-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.page-desc {
  margin: 0;
  max-width: 72ch;
  font-size: 14px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  align-items: stretch;
}

.update-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 20px 22px 22px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 280px;
}

.card-top {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.card-icon-wrap {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-white);

  &.web {
    background: linear-gradient(135deg, var(--el-color-primary) 0%, var(--el-color-primary-light-3) 100%);
  }

  &.bot {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  }
}

.card-head-text {
  flex: 1;
  min-width: 0;
}

.card-blurb {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
}

.update-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.update-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.update-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  padding: 8px 0;
}

.update-alert {
  border-radius: 8px;
}

.version-compare {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--el-fill-color-light);
  border-radius: 10px;
  border: 1px solid var(--el-border-color-extra-light);
}

.ver-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.ver-arrow {
  flex-shrink: 0;
  font-size: 18px;
  color: var(--el-text-color-placeholder);
}

.version-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.version-tag {
  font-size: 14px;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  max-width: 100%;
}

.commit-hint {
  font-size: 11px;
  font-family: ui-monospace, monospace;
  color: var(--el-text-color-placeholder);
}

.update-status {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

.status-icon {
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.update-available {
  color: var(--el-color-warning);
}

.up-to-date {
  color: var(--el-color-success);
}

.card-footer {
  margin-top: auto;
  padding-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

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
  gap: 14px;
  flex-wrap: wrap;
}

.release-link {
  font-size: 13px;
  color: var(--el-color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.update-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
  padding: 28px 12px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  background: var(--el-fill-color-blank);
  border-radius: 10px;
  border: 1px dashed var(--el-border-color);

  p {
    margin: 0;
  }
}

.page-foot-tip {
  border-radius: 10px;

  :deep(.el-alert__title) {
    font-weight: 600;
  }
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }

  .update-card {
    min-height: 0;
  }
}

@media (max-width: 768px) {
  .update-view {
    padding: 12px 12px 24px;
    gap: 16px;
  }

  .page-title {
    font-size: 19px;
  }

  .page-desc {
    font-size: 13px;
  }

  .update-card {
    padding: 16px 14px;
    gap: 14px;
  }

  .update-title {
    font-size: 16px;
  }

  .update-header {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .version-compare {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .ver-arrow {
    display: none;
  }

  .ver-col {
    align-items: stretch;
  }

  .update-status {
    align-items: flex-start;
  }

  .card-top {
    flex-direction: column;
  }

  .card-icon-wrap {
    width: 40px;
    height: 40px;
  }
}
</style>
