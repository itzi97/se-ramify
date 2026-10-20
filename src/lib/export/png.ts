/**
 * Small PNG helpers for exports, pure so they can be tested.
 *
 * A capture at 2×, 3× or 4× has that many pixels per CSS pixel. Without a
 * resolution, Word, PowerPoint and pdflatex assume 72 or 96 dpi and insert
 * it two to four times too big. `withPhys` writes a pHYs chunk saying
 * "scale × 96 dpi", so the image's physical size is the size it had on
 * screen, however sharp it is.
 */

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let table: Uint32Array | null = null;

/** CRC-32 as PNG chunks use it (over the chunk type and data). */
export function crc32(bytes: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of bytes) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 24 && SIGNATURE.every((b, i) => bytes[i] === b);
}

const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const type = (b: Uint8Array, at: number) => String.fromCharCode(b[at + 4], b[at + 5], b[at + 6], b[at + 7]);

interface Chunk {
  type: string;
  /** Offset of the length field. */
  at: number;
  /** Whole chunk length: 12 + data. */
  size: number;
}

function chunks(png: Uint8Array): Chunk[] {
  const out: Chunk[] = [];
  let at = 8;
  while (at + 12 <= png.length) {
    const len = u32(png, at);
    out.push({ type: type(png, at), at, size: 12 + len });
    if (type(png, at) === 'IEND') break;
    at += 12 + len;
  }
  return out;
}

/** Width and height in pixels, from the IHDR chunk. */
export function pngSize(png: Uint8Array): { width: number; height: number } {
  if (!isPng(png)) throw new Error('not a PNG');
  return { width: u32(png, 16), height: u32(png, 20) };
}

/** Dots per inch from the pHYs chunk, or null when there is none (or it has no unit). */
export function pngDpi(png: Uint8Array): number | null {
  if (!isPng(png)) return null;
  const c = chunks(png).find((x) => x.type === 'pHYs');
  if (!c || png[c.at + 16] !== 1) return null;
  return Math.round(u32(png, c.at + 8) * 0.0254);
}

/** Size in inches at the PNG's resolution (96 dpi when it has none). */
export function pngInches(png: Uint8Array): { width: number; height: number } {
  const { width, height } = pngSize(png);
  const dpi = pngDpi(png) ?? 96;
  return { width: width / dpi, height: height / dpi };
}

/** The pHYs chunk for `dpi` dots per inch (stored as dots per metre). */
export function physChunk(dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const out = new Uint8Array(21);
  const view = new DataView(out.buffer);
  view.setUint32(0, 9);
  out.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  out[16] = 1; // unit: metre
  view.setUint32(17, crc32(out.subarray(4, 17)));
  return out;
}

/**
 * The same PNG with a pHYs chunk for `scale` × 96 dpi, right after IHDR
 * (replacing any pHYs it had). The pixels are untouched.
 */
export function withPhys(png: Uint8Array, scale: number): Uint8Array {
  if (!isPng(png)) return png;
  const all = chunks(png);
  const ihdr = all.find((c) => c.type === 'IHDR');
  if (!ihdr) return png;
  const phys = physChunk(scale * 96);
  const keep = all.filter((c) => c.type !== 'pHYs');
  const size = 8 + keep.reduce((s, c) => s + c.size, 0) + phys.length;
  const out = new Uint8Array(size);
  out.set(png.subarray(0, 8), 0);
  let at = 8;
  for (const c of keep) {
    out.set(png.subarray(c.at, c.at + c.size), at);
    at += c.size;
    if (c.type === 'IHDR') {
      out.set(phys, at);
      at += phys.length;
    }
  }
  return out;
}

/** Bytes → base64, in chunks (browsers and node). */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
