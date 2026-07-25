#!/usr/bin/env node
/**
 * build_app_icons.mjs — Node 22+ 零依赖图标生成器
 *
 * 依赖: 仅 Node 内置 zlib + fs
 * 输出: realty_app/unpackage/res/icons/{72,96,144,192}.png
 *
 * 设计：参考 static/app-icon.svg，但用纯像素绘制保证跨平台一致。
 *  - 圆角矩形背景: 顶(15,42,71) -> 底(10,28,48) 垂直渐变
 *  - 4 根 amber (#F7C56C) 柱: 高度比 1:1.5:2:1.4
 *  - 第 3 根柱顶置 amber 圆点 "pin"
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "static", "app-icons");
const SIZES = [72, 96, 144, 192];

const BG_TOP = [15, 42, 71];
const BG_BOT = [10, 28, 48];
const AMBER = [247, 197, 108];

/** blend two RGBA tuples by alpha in [0,1] */
function blend(dst, src, a) {
  return [
    Math.round(dst[0] * (1 - a) + src[0] * a),
    Math.round(dst[1] * (1 - a) + src[1] * a),
    Math.round(dst[2] * (1 - a) + src[2] * a),
    255,
  ];
}

/** rounded-square distance: returns 0 inside, >0 outside */
function roundedSquareDist(x, y, size, radius) {
  const dx = Math.max(Math.abs(x - size / 2 + 0.5) - (size / 2 - radius), 0);
  const dy = Math.max(Math.abs(y - size / 2 + 0.5) - (size / 2 - radius), 0);
  return Math.sqrt(dx * dx + dy * dy) - radius;
}

function gen(size) {
  const px = new Uint8ClampedArray(size * size * 4);
  const bg = [0, 0, 0, 0];
  const barW = Math.round(size * 0.10);
  const gap = Math.round(size * 0.04);
  const baseY = Math.round(size * 0.78);
  const heights = [
    Math.round(size * 0.20),
    Math.round(size * 0.30),
    Math.round(size * 0.40),
    Math.round(size * 0.28),
  ];
  const totalW = 4 * barW + 3 * gap;
  const x0 = Math.floor((size - totalW) / 2);
  const bars = heights.map((h, i) => ({
    x0: x0 + i * (barW + gap),
    y0: baseY - h,
    x1: x0 + i * (barW + gap) + barW,
    y1: baseY,
  }));
  const pinX = Math.round((bars[2].x0 + bars[2].x1) / 2);
  const pinY = Math.round(bars[2].y0 - size * 0.05);
  const pinR = Math.max(2, Math.round(size * 0.025));

  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const bgLine = [
      Math.round(BG_TOP[0] * (1 - t) + BG_BOT[0] * t),
      Math.round(BG_TOP[1] * (1 - t) + BG_BOT[1] * t),
      Math.round(BG_TOP[2] * (1 - t) + BG_BOT[2] * t),
      255,
    ];
    for (let x = 0; x < size; x++) {
      let color = bg;
      // mask: rounded square
      const d = roundedSquareDist(x, y, size, Math.round(size * 0.22));
      if (d > 0.5) {
        color = bg;
      } else if (d > -0.5) {
        // edge AA
        const a = Math.max(0, Math.min(1, 0.5 - d));
        color = blend(bg, bgLine, a);
      } else {
        color = bgLine;
        // bar?
        for (const b of bars) {
          if (x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) {
            const corner = Math.min(
              x - b.x0,
              b.x1 - 1 - x,
              y - b.y0,
              b.y1 - 1 - y,
            );
            if (corner > 0) color = AMBER.concat([255]);
            else {
              const a = Math.max(0, Math.min(1, 0.5 + corner));
              color = blend(bgLine, AMBER.concat([255]), a);
            }
            break;
          }
        }
        // pin
        if (color === bgLine) {
          const dx = x - pinX;
          const dy = y - pinY;
          if (dx * dx + dy * dy <= pinR * pinR) {
            color = AMBER.concat([255]);
          }
        }
      }
      const i = (y * size + x) * 4;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = color[3];
    }
  }
  return encodePng(px, size, size);
}

/** PNG encoder: RGB(A) only, no interlace */
function encodePng(rgba, w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // raw scanlines: filter byte 0 + RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1
    );
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0, 0);
  return Buffer.concat([len, t, data, crc]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

mkdirSync(OUT, { recursive: true });
for (const s of SIZES) {
  const png = gen(s);
  const p = join(OUT, `${s}.png`);
  writeFileSync(p, png);
  console.log(`wrote ${p} (${png.length} bytes)`);
}