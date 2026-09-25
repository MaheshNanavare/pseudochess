/**
 * Generates the app icons and Microsoft Store art from one geometry
 * ("Inverted Gravity", see store-assets/philosophy.md). Run: npm run icons
 *
 * Outputs
 *   public/favicon.svg, public/icons/icon.svg      vector sources
 *   public/icons/icon-192.png, icon-512.png         PWA icons
 *   public/icons/icon-maskable-512.png              maskable (80% safe zone)
 *   public/icons/apple-touch-icon.png               180px, full bleed
 *   store-assets/store-logo-1080.png                Store 1:1 logo
 *   store-assets/hero-1920x1080.png                 Store 16:9 hero art (no text: the Store overlays the title)
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const INK = '#211c2e';
const TILE = '#2c2540';
const LILAC = '#e3dcef';
const DUSK = '#8a7db5';
const MARIGOLD = '#e9a23b';

/**
 * A segmented Staunton-style king on a 512 grid, drawn upright; callers rotate it.
 * Every part is separated by an 8px gap so the silhouette reads as built, not traced.
 */
function king(fill: string, accent: string): string {
  return `
    <rect x="241" y="52" width="30" height="84" rx="8" fill="${accent}"/>
    <rect x="214" y="79" width="84" height="30" rx="8" fill="${accent}"/>
    <path d="M164 188 Q256 136 348 188 L316 270 Q256 282 196 270 Z" fill="${fill}"/>
    <rect x="188" y="286" width="136" height="26" rx="13" fill="${fill}"/>
    <path d="M212 322 L300 322 C302 360 318 386 344 404 L168 404 C194 386 210 360 212 322 Z" fill="${fill}"/>
    <rect x="148" y="412" width="216" height="24" rx="10" fill="${fill}"/>
    <rect x="132" y="444" width="248" height="22" rx="10" fill="${fill}"/>`;
}

/** Faint 8x8 checker that thins out towards the top: weight rising, then gone. */
function checker(size: number): string {
  const cell = size / 8;
  let out = '';
  for (let row = 0; row < 8; row++) {
    const opacity = ((row + 1) / 8) ** 1.6;
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 0) continue;
      out += `<rect x="${col * cell}" y="${row * cell}" width="${cell}" height="${cell}" fill="${TILE}" fill-opacity="${opacity.toFixed(3)}"/>`;
    }
  }
  return out;
}

function iconSvg({ maskable }: { maskable: boolean }): string {
  // Inverted king: rotated 180 degrees about the centre, nudged so its optical centre sits mid-tile.
  const scale = maskable ? 0.72 : 0.86;
  const t = 256 - 256 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><clipPath id="tile"><rect width="512" height="512" rx="${maskable ? 0 : 112}"/></clipPath></defs>
  <g clip-path="url(#tile)">
    <rect width="512" height="512" fill="${INK}"/>
    ${checker(512)}
  </g>
  <g transform="translate(${t} ${t - 6}) scale(${scale}) rotate(180 256 256)">${king(LILAC, MARIGOLD)}</g>
</svg>`;
}

/**
 * Hero art: fifteen identical tiles (the pieces you must lose) released one by
 * one up and out of a field of reference marks, towards a monumental inverted king.
 */
function heroSvg(): string {
  const W = 1920;
  const H = 1080;
  let marks = '';
  for (let x = 120; x < W; x += 80) {
    for (let y = 120; y < H; y += 80) marks += `<circle cx="${x}" cy="${y}" r="2" fill="${TILE}"/>`;
  }
  let tiles = '';
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    const x = 160 + i * 72;
    const y = 840 - 600 * t ** 2.2;
    const opacity = 1 - 0.92 * t ** 1.3;
    const size = 48 - 12 * t;
    tiles += `<rect x="${(x + (48 - size) / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" rx="${(size * 0.22).toFixed(1)}" fill="${i === 0 ? DUSK : LILAC}" fill-opacity="${opacity.toFixed(3)}"/>`;
  }
  // Baseline the tiles leave from.
  const rule = `<rect x="160" y="912" width="${14 * 72 + 48}" height="2" fill="${TILE}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${INK}"/>
  ${marks}
  ${rule}
  ${tiles}
  <g transform="translate(1250 158) scale(1.44) rotate(180 256 256)">${king(LILAC, MARIGOLD)}</g>
</svg>`;
}

function renderPng(svg: string, width: number, file: string): void {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  writeFileSync(file, png);
  console.log(`wrote ${file} (${width}px)`);
}

mkdirSync('public/icons', { recursive: true });
mkdirSync('store-assets', { recursive: true });

const standard = iconSvg({ maskable: false });
const maskable = iconSvg({ maskable: true });
writeFileSync('public/icons/icon.svg', standard);
writeFileSync('public/favicon.svg', standard);

renderPng(standard, 192, 'public/icons/icon-192.png');
renderPng(standard, 512, 'public/icons/icon-512.png');
renderPng(maskable, 512, 'public/icons/icon-maskable-512.png');
renderPng(maskable, 180, 'public/icons/apple-touch-icon.png');
renderPng(maskable, 1080, 'store-assets/store-logo-1080.png');
renderPng(heroSvg(), 1920, 'store-assets/hero-1920x1080.png');
