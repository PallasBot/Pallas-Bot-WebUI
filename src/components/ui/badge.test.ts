import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { badgeVariants } from "@/components/ui/badge";

const styles = readFileSync(resolve(process.cwd(), "src/styles/console/app.css"), "utf8");

describe("Badge", () => {
  it("为状态与信息标签输出稳定的语义与尺寸类名", () => {
    const compactSuccess = badgeVariants({ variant: "success", size: "compact" });
    const regularInfo = badgeVariants({ variant: "info", size: "regular" });

    expect(compactSuccess).toContain("badge");
    expect(compactSuccess).toContain("badge--success");
    expect(compactSuccess).toContain("badge--compact");
    expect(regularInfo).toContain("badge--info");
    expect(regularInfo).toContain("badge--regular");
  });

  it("使用更清晰的语义色阶，并保持紧凑标签的日志行高", () => {
    expect(styles).toContain("min-height: 19px;");
    expect(styles).toContain("min-height: 18px;");
    expect(styles).toContain("var(--primary) 22%");
    expect(styles).toContain("var(--primary) 44%");
    expect(styles).toContain("#3b82f6 22%");
    expect(styles).toContain("#ef4444 20%");
    expect(styles).toContain("#f59e0b 22%");
  });
});
