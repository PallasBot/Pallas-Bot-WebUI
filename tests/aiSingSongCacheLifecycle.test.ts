import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("唱歌歌曲缓存生命周期配置", () => {
  it("将缓存字段声明在控制台客户端的读取与保存类型中", () => {
    const source = readSource("src/api/console.ts");

    expect(source).toMatch(/export type SingSpeakersPayload = \{[\s\S]*?song_cache_days\?: number;[\s\S]*?song_cache_size\?: number;/);
    expect(source).toMatch(/putSingDefaults\(body: \{[\s\S]*?song_cache_days\?: number;[\s\S]*?song_cache_size\?: number;/);
    expect(source).toMatch(/Promise<\{[\s\S]*?song_cache_days\?: number;[\s\S]*?song_cache_size\?: number;/);
  });

  it("从唱歌 payload 初始化缓存编辑状态，并校验后保存", () => {
    const source = readSource("src/pages/ai/sections/AiConfigMediaSection.tsx");

    expect(source).toContain('const [songCacheDays, setSongCacheDays] = useState("");');
    expect(source).toContain('const [songCacheSize, setSongCacheSize] = useState("");');
    expect(source).toContain('setSongCacheDays(sp.song_cache_days != null ? String(sp.song_cache_days) : "");');
    expect(source).toContain('setSongCacheSize(sp.song_cache_size != null ? String(sp.song_cache_size) : "");');
    expect(source).toContain('notifyErr("请填写 1 到 3650 的歌曲缓存保留天数");');
    expect(source).toContain('notifyErr("请填写 0 到 10000 的缓存保护数量");');
    expect(source).toContain("song_cache_days: songCacheDaysNum");
    expect(source).toContain("song_cache_size: songCacheSizeNum");
  });

  it("展示缓存字段及窄屏单列默认设置布局", () => {
    const source = readSource("src/pages/ai/sections/AiConfigMediaSection.tsx");

    expect(source).toContain('className="grid grid-cols-1 min-[561px]:grid-cols-2 gap-3"');
    expect(source).toContain('label="歌曲缓存保留天数"');
    expect(source).toContain('label="缓存保护数量"');
    expect(source).toContain('超过天数且不在保护范围内会在每日清理删除');
    expect(source).toContain('数量按最近访问保护且不是磁盘容量');
    expect(source).toContain('保存后下一次每日清理生效');
    expect(source).toContain('type="number"');
  });

  it("同步 OpenAPI 生成类型的歌曲缓存字段", () => {
    const source = readSource("src/api/generated/pallasConsoleOpenapi.ts");

    expect(source).toMatch(/_LlmSingDefaultsBody: \{[\s\S]*?song_cache_days\?: number \| null;[\s\S]*?song_cache_size\?: number \| null;/);
  });
});
