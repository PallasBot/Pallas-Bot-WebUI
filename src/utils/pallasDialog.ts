import { DialogPlugin } from "tdesign-vue-next";

/** 与 Element MessageBox.confirm 类似的确认框；取消时 reject */
export function confirmPallas(options: {
  title: string;
  body: string;
  theme?: "default" | "info" | "warning" | "danger" | "success";
  confirmText?: string;
  cancelText?: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const dlg = DialogPlugin.confirm({
      header: options.title,
      body: options.body,
      theme: options.theme ?? "warning",
      confirmBtn: options.confirmText ?? "确定",
      cancelBtn: options.cancelText ?? "取消",
      onConfirm: () => {
        dlg.destroy();
        resolve();
      },
      onCancel: () => {
        dlg.destroy();
        reject(new Error("cancel"));
      },
      onClose: () => {
        dlg.destroy();
        reject(new Error("cancel"));
      },
    });
  });
}
