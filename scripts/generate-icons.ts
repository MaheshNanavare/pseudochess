/**
 * Renders the app icon SVG to the PNG sizes the PWA manifest and the
 * Microsoft Store (via PWABuilder) need. Run: npm run icons
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = (maskable: boolean): string => {
  const src = readFileSync('public/icons/icon.svg', 'utf8');
  // Maskable icons need content inside the central 80% safe zone and a full-bleed background.
  return maskable ? src.replace('data-scale="1"', 'data-scale="0.8"').replace('transform="scale(1)"', 'transform="translate(51.2 51.2) scale(0.8)"').replace('rx="112"', 'rx="0"') : src;
};

const outputs: { file: string; size: number; maskable: boolean }[] = [
  { file: 'public/icons/icon-192.png', size: 192, maskable: false },
  { file: 'public/icons/icon-512.png', size: 512, maskable: false },
  { file: 'public/icons/icon-maskable-512.png', size: 512, maskable: true },
  { file: 'public/icons/apple-touch-icon.png', size: 180, maskable: true },
];

for (const { file, size, maskable } of outputs) {
  const png = new Resvg(svg(maskable), { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(file, png);
  console.log(`wrote ${file} (${size}px)`);
}
