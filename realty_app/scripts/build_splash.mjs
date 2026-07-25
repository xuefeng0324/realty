#!/usr/bin/env node
/**
 * build_splash.mjs — 简约大气启动图（暗色主题对齐 App #0b1020 / amber 柱 / 绿点缀）
 * 零依赖，输出 static/splash/{splash.png, splash@2x.png, splash@3x.png}
 */
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "static", "splash");

const BG_TOP = [11, 16, 32]; // #0b1020
const BG_BOT = [15, 23, 42]; // #0f172a
const AMBER = [247, 197, 108]; // #F7C56C
const GREEN = [74, 222, 128]; // #4ade80
const MUTED = [148, 163, 184]; // #94a3b8

function blend(a, b, t) {
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
    255
  ];
}

function setPx(px, w, x, y, c) {
  if (x < 0 || y < 0 || x >= w || y >= px.length / (w * 4)) return;
  const i = (y * w + x) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = c[3] ?? 255;
}

function fillRect(px, w, x0, y0, x1, y1, color, r = 0) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (r > 0) {
        const dx = Math.min(x - x0, x1 - 1 - x);
        const dy = Math.min(y - y0, y1 - 1 - y);
        if (dx < 0 || dy < 0) continue;
        if (dx < r && dy < r) {
          const d = Math.hypot(r - dx, r - dy);
          if (d > r + 0.5) continue;
          if (d > r - 0.5) {
            const a = Math.max(0, Math.min(1, r + 0.5 - d));
            const i = (y * w + x) * 4;
            const dst = [px[i], px[i + 1], px[i + 2]];
            setPx(px, w, x, y, blend(dst, color, a));
            continue;
          }
        }
      }
      setPx(px, w, x, y, color);
    }
  }
}

function fillCircle(px, w, cx, cy, rad, color) {
  const r2 = rad * rad;
  for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) {
    for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
      const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (d2 <= (rad - 0.5) ** 2) setPx(px, w, x, y, color);
      else if (d2 <= (rad + 0.5) ** 2) {
        const a = Math.max(0, Math.min(1, rad + 0.5 - Math.sqrt(d2)));
        const i = (y * w + x) * 4;
        if (i < 0 || i >= px.length) continue;
        setPx(px, w, x, y, blend([px[i], px[i + 1], px[i + 2]], color, a));
      }
    }
  }
}

/** 5x7 点阵字（大写） */
const GLYPHS = {
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
};

function drawText(px, w, text, cx, cy, scale, color) {
  const cell = 5 * scale + scale; // glyph width + gap
  const totalW = text.length * cell - scale;
  let x0 = Math.round(cx - totalW / 2);
  const y0 = Math.round(cy - (7 * scale) / 2);
  for (const ch of text) {
    const g = GLYPHS[ch] || GLYPHS[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === "1") {
          fillRect(
            px,
            w,
            x0 + col * scale,
            y0 + row * scale,
            x0 + col * scale + scale,
            y0 + row * scale + scale,
            color
          );
        }
      }
    }
    x0 += cell;
  }
}

function genSplash(w, h) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const line = blend(BG_TOP, BG_BOT, t);
    // 顶部微弱径向暗角
    for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * 2;
      const ny = (y / h - 0.35) * 2;
      const vig = Math.min(1, Math.sqrt(nx * nx + ny * ny) * 0.35);
      setPx(px, w, x, y, blend(line, [6, 10, 20], vig));
    }
  }

  // 细绿顶线
  fillRect(px, w, 0, 0, w, Math.max(2, Math.round(h * 0.0025)), GREEN);

  // 天际线 mark（居中偏上）
  const markH = Math.round(h * 0.14);
  const markW = Math.round(w * 0.42);
  const baseY = Math.round(h * 0.42);
  const barW = Math.round(markW * 0.16);
  const gap = Math.round(markW * 0.07);
  const heights = [0.45, 0.68, 1.0, 0.62].map((r) => Math.round(markH * r));
  const totalW = 4 * barW + 3 * gap;
  const xStart = Math.floor((w - totalW) / 2);
  const radius = Math.max(4, Math.round(barW * 0.22));
  heights.forEach((bh, i) => {
    const x0 = xStart + i * (barW + gap);
    const y0 = baseY - bh;
    const alpha = [0.55, 0.75, 1, 0.75][i];
    const col = blend(BG_BOT, AMBER, alpha);
    fillRect(px, w, x0, y0, x0 + barW, baseY, col, radius);
  });
  // pin on tallest bar
  const pinX = xStart + 2 * (barW + gap) + barW / 2;
  const pinY = baseY - heights[2] - Math.round(markH * 0.12);
  fillCircle(px, w, pinX, pinY, Math.max(4, Math.round(w * 0.012)), AMBER);
  // 绿点缀
  fillCircle(px, w, pinX + Math.round(w * 0.04), pinY + Math.round(h * 0.01), Math.max(2, Math.round(w * 0.005)), GREEN);

  // 品牌名
  const scale = Math.max(3, Math.round(w / 180));
  drawText(px, w, "REALTY", w / 2, baseY + Math.round(h * 0.08), scale, [226, 232, 240]);

  // 细分割线（不用点阵小字，避免糊成残缺字母）
  const lineY = baseY + Math.round(h * 0.14);
  const lw = Math.round(w * 0.16);
  fillRect(
    px,
    w,
    Math.round(w / 2 - lw / 2),
    lineY,
    Math.round(w / 2 + lw / 2),
    lineY + Math.max(2, Math.round(h * 0.0018)),
    [51, 65, 85]
  );

  // 底部淡绿点
  fillCircle(px, w, w / 2, Math.round(h * 0.9), Math.max(3, Math.round(w * 0.006)), blend(BG_BOT, GREEN, 0.55));

  return encodePng(px, w, h);
}

function encodePng(rgba, width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
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
const sizes = [
  ["splash.png", 1080, 1920],
  ["splash-720.png", 720, 1280],
  ["splash-square.png", 512, 512]
];
for (const [name, w, h] of sizes) {
  const png = genSplash(w, h);
  const p = join(OUT, name);
  writeFileSync(p, png);
  console.log(`wrote ${p} (${png.length} bytes)`);
}
