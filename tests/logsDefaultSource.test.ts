import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const logsPage = readFileSync(resolve(process.cwd(), "src/pages/LogsPage.tsx"), "utf8");

describe("日志默认来源", () => {
  it("默认请求主进程日志而非合并全部来源", () => {
    expect(logsPage).toContain('const [logSource, setLogSource] = useState("hub")');
  });
});
