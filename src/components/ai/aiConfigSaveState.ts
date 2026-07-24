/** 子面板向 AI 配置顶栏注册保存能力 */
export type AiConfigSaveState = {
  dirty: boolean;
  saving: boolean;
  save: () => void;
};

export type AiConfigSaveStateHandler = (state: AiConfigSaveState | null) => void;
