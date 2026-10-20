import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
const svg = await readFile('public/apex.svg');
for (const [name, size] of [
  ['icon-192', 192],
  ['icon-512', 512],
  ['apple-touch-icon', 180],
  ['maskable-512', 512],
])
  await sharp(svg).resize(size, size).png().toFile(`public/icons/${name}.png`);
