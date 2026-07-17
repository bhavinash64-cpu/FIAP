/**
 * Regenerates the responsive WebP variants of the auth illustration.
 * Source of truth: src/assets/auth-illustration.png (1536x1024).
 * Run with: node scripts/optimize-images.mjs
 */
import sharp from "sharp";
import { readFileSync, statSync } from "node:fs";

const SRC = "src/assets/auth-illustration.png";
const WIDTHS = [640, 1024, 1536];

const kb = (p) => (statSync(p).size / 1024).toFixed(0) + "KB";
console.log("source", SRC, kb(SRC));

for (const w of WIDTHS) {
  const out = `src/assets/auth-illustration-${w}.webp`;
  await sharp(SRC).resize({ width: w }).webp({ quality: 78, effort: 6 }).toFile(out);
  console.log("  ->", out, kb(out));
}

// Compressed PNG fallback for browsers without WebP.
const fallback = "src/assets/auth-illustration-fallback.png";
await sharp(SRC).resize({ width: 1024 }).png({ quality: 70, compressionLevel: 9, palette: true }).toFile(fallback);
console.log("  ->", fallback, kb(fallback));
