# Pallas-Bot WebUI（React）

分期迁栈前端。生产默认由 Bot `pallas_webui_frontend=react` 挂到 `/pallas/`（静态目录 `data/pb_webui/public-react/`）。

## 栈

- Vite + React 18 + react-router-dom
- **shadcn/ui** + Tailwind 3 + Radix（对齐 gsuid_hub）
- `@tanstack/react-query` + axios（cookie 会话）

控件约定见 [docs/ui-conventions.md](./docs/ui-conventions.md)（新代码只用 shadcn；`Ui*` 为 deprecated 兼容层）。`/ai/*` 视觉暂不跟 Vue，另排期。

**样式（P3）**：控制台 CSS 在 `src/styles/console/`（自有）。  
**业务 TS（P4）**：`api/` / `utils/` / 相关 `config/` 已自有，构建**不再**读上级 Vue `src/`。

```bash
npm install
npm run dev    # :5174 → 代理 Bot（见 .env.local）
npm run build  # → dist/ → data/pb_webui/public-react/
```

设计：主仓 `docs/superpowers/specs/2026-07-23-webui-react-design-system-design.md`。
