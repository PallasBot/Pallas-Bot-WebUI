import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  dismissConsoleToast,
  getConsoleToastItems,
  subscribeConsoleToast,
  type ConsoleToastItem,
} from "@/utils/consoleToast";

export default function ConsoleToastHost() {
  const [items, setItems] = useState<readonly ConsoleToastItem[]>(() => getConsoleToastItems());

  useEffect(() => subscribeConsoleToast(() => setItems(getConsoleToastItems())), []);

  if (!items.length || typeof document === "undefined") return null;

  return createPortal(
    <div className="console-toast-host" role="status" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <div key={item.id} className={`console-toast console-toast--${item.level}`}>
          <span className="console-toast__msg">{item.message}</span>
          <button
            type="button"
            className="console-toast__close"
            aria-label="关闭"
            onClick={() => dismissConsoleToast(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
