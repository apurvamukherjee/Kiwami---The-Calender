// One-off procedural icon generator — not wired into the build (same
// convention the original placeholder icons used: run once, commit the
// output). Draws Kiwami's actual signature mark — a ring of amber beads
// orbiting a glowing ember core on an obsidian radial-gradient background,
// the same motif src/components/SplashScreen.tsx's SVG animates — into raw
// RGBA buffers and PNG-encodes them via Node's built-in zlib, with zero new
// dependencies (no canvas/sharp/etc).
//
// Run: node scripts/generate-icons.mjs

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

// --- PNG encoding (signature + IHDR + IDAT + IEND), CRC-32 hand-rolled since
// Node's zlib module compresses but doesn't expose the checksum PNG chunks need.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Drawing: procedural, per-pixel. `scale` shrinks the ring/core motif
// toward the center while the background still fills edge-to-edge — used
// for maskable variants, whose OS-level shape mask can crop right up to the
// canvas edge, so content must stay inside a safe interior zone.
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}
// Soft circular coverage in [0,1] for anti-aliasing small icons (esp. the 32px favicon).
function circleCoverage(d, r, feather = 1) {
  return Math.max(0, Math.min(1, (r - d) / feather + 0.5));
}

function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const motifScale = maskable ? 0.72 : 1; // keeps content inside the ~80% maskable safe zone
  const ringR = size * 0.46 * motifScale;
  const ringStroke = Math.max(1, size * 0.012);
  const beadOrbitR = size * 0.326 * motifScale;
  const beadR = Math.max(0.8, size * 0.035 * motifScale);
  const coreR = size * 0.065 * motifScale;
  const glowR = size * 0.22 * motifScale;
  const beadCount = 10;

  const bgInner = [31, 20, 8]; // #1f1408
  const bgMid = [19, 19, 19]; // #131313
  const bgOuter = [10, 10, 10]; // #0a0a0a
  const ringColor = [255, 255, 255];
  const beadColor = [255, 184, 107]; // #ffb86b
  const coreColor = [255, 159, 28]; // #ff9f1c

  const beads = Array.from({ length: beadCount }, (_, i) => {
    const angle = (i / beadCount) * Math.PI * 2 - Math.PI / 2;
    return [cx + beadOrbitR * Math.cos(angle), cy + beadOrbitR * Math.sin(angle)];
  });

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const maxD = size * 0.72;
      const t = Math.min(1, d / maxD);
      let color = t < 0.55 ? lerpColor(bgInner, bgMid, t / 0.55) : lerpColor(bgMid, bgOuter, (t - 0.55) / 0.45);

      // Outer ring stroke.
      const ringCov = circleCoverage(Math.abs(d - ringR), ringStroke / 2, 1) * 0.55;
      if (ringCov > 0) color = lerpColor(color, ringColor, ringCov);

      // Beads.
      for (const [bx, by] of beads) {
        const bd = Math.sqrt((x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2);
        const cov = circleCoverage(bd, beadR, 1);
        if (cov > 0) color = lerpColor(color, beadColor, cov);
      }

      // Ember core + soft glow.
      const glowT = d <= coreR ? 1 : Math.max(0, 1 - (d - coreR) / (glowR - coreR));
      if (glowT > 0) color = lerpColor(color, coreColor, glowT * (d <= coreR ? 1 : 0.5));

      const i = (y * size + x) * 4;
      rgba[i] = Math.round(color[0]);
      rgba[i + 1] = Math.round(color[1]);
      rgba[i + 2] = Math.round(color[2]);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function writeIcon(path, size, opts) {
  const rgba = drawIcon(size, opts);
  writeFileSync(path, encodePNG(size, size, rgba));
  console.log(`wrote ${path} (${size}x${size}${opts?.maskable ? ", maskable" : ""})`);
}

mkdirSync(join(PUBLIC_DIR, "icons"), { recursive: true });
writeIcon(join(PUBLIC_DIR, "favicon-32.png"), 32);
writeIcon(join(PUBLIC_DIR, "apple-touch-icon.png"), 180);
writeIcon(join(PUBLIC_DIR, "icons", "icon-192.png"), 192);
writeIcon(join(PUBLIC_DIR, "icons", "icon-512.png"), 512);
writeIcon(join(PUBLIC_DIR, "icons", "icon-maskable-192.png"), 192, { maskable: true });
writeIcon(join(PUBLIC_DIR, "icons", "icon-maskable-512.png"), 512, { maskable: true });
console.log("Done.");
