/**
 * 从 src/assets/pallas-standee.png 生成带透明通道的 WebP（体积远小于原 PNG）。
 * 将带 Alpha 的源图存为 src/assets/pallas-standee.png 后执行：npm run optimize:standee
 */
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcPng = `${root}/src/assets/pallas-standee.png`;
const outWebp = `${root}/src/assets/pallas-standee.webp`;

if (!existsSync(srcPng)) {
  if (existsSync(outWebp)) {
    console.log("已存在 pallas-standee.webp，且无 pallas-standee.png 源图，跳过。");
    process.exit(0);
  }
  console.error("缺少 src/assets/pallas-standee.webp；请将带透明底的源 PNG 存为 pallas-standee.png 后运行 npm run optimize:standee");
  process.exit(1);
}

const maxSide = 560;

const input = sharp(srcPng);
const meta = await input.metadata();
const pipeline = input
  .ensureAlpha()
  .resize({
    width: maxSide,
    height: maxSide,
    fit: "inside",
    withoutEnlargement: true,
  })
  .webp({
    quality: 86,
    alphaQuality: 100,
    effort: 6,
  });

const buf = await pipeline.toBuffer();
writeFileSync(outWebp, buf);

const outMeta = await sharp(buf).metadata();
console.log(
  JSON.stringify(
    {
      in: { w: meta.width, h: meta.height, hasAlpha: meta.hasAlpha, format: meta.format },
      out: {
        w: outMeta.width,
        h: outMeta.height,
        hasAlpha: outMeta.hasAlpha,
        format: outMeta.format,
        bytes: buf.length,
      },
    },
    null,
    2,
  ),
);
