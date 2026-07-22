# Pallas-Bot WebUI（React）

分期迁栈前端。生产由 Bot `pallas_webui_frontend=react` 挂到同一 `/pallas/`。

## 栈

- Vite + React 18 + react-router-dom
- **shadcn/ui** + Tailwind 3 + Radix（对齐 gsuid_hub）
- `@tanstack/react-query` + axios（cookie 会话）

```bash
npm install
npm run dev    # :5174 → 代理 Bot（见 .env.local）
npm run build  # → dist/ → data/pb_webui/public-react/
```

详见主仓 `docs/developer/webui-react-migration.md`。
