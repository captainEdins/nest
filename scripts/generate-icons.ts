/**
 * NEST — one-off icon rasterizer.
 *
 * Rasterizes public/nest-logo.svg into the PWA icon set:
 *   public/icons/icon-192.png, icon-512.png, apple-touch-icon.png (180).
 *
 * Run once: `bun scripts/generate-icons.ts`
 */
import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile("public/nest-logo.svg");

await mkdir("public/icons", { recursive: true });

await sharp(svg, { density: 384 }).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(svg, { density: 384 }).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(svg, { density: 384 }).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");

console.log("icons written to public/icons/");
