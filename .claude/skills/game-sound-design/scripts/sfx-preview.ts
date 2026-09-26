/**
 * Renders a sound module to WAV files and prints objective metrics, so sounds
 * can be checked before (and after) listening. No Python needed.
 *
 *   npx tsx .claude/skills/game-sound-design/scripts/sfx-preview.ts <module.ts> [outDir] [sampleRate]
 *
 * The module must export:
 *   previewSounds(sampleRate: number): Record<string, Float32Array>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Preview = (sampleRate: number) => Record<string, Float32Array>;

const [modulePath, outDir = 'test-results/sfx', rateArg = '44100'] = process.argv.slice(2);
if (!modulePath) {
  console.error('Usage: sfx-preview.ts <module.ts> [outDir] [sampleRate]');
  process.exit(1);
}
const sampleRate = Number(rateArg);

function wav(samples: Float32Array, fs: number): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(fs, 24);
  header.writeUInt32LE(fs * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** In-place radix-2 FFT; re and im have a power-of-two length. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = a + len / 2;
        const xr = re[b]! * wr - im[b]! * wi, xi = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - xr; im[b] = im[a]! - xi;
        re[a] = re[a]! + xr; im[a] = im[a]! + xi;
      }
    }
  }
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

function metrics(s: Float32Array, fs: number) {
  let peak = 0, peakAt = 0, sumSq = 0;
  s.forEach((v, i) => {
    const a = Math.abs(v);
    sumSq += v * v;
    if (a > peak) { peak = a; peakAt = i; }
  });
  // Decay: last time the 5 ms envelope is above -40 dB relative to the peak.
  const win = Math.round(0.005 * fs);
  let lastLoud = peakAt;
  for (let i = peakAt; i < s.length; i += win) {
    let m = 0;
    for (let j = i; j < Math.min(s.length, i + win); j++) m = Math.max(m, Math.abs(s[j]!));
    if (m > peak * 0.01) lastLoud = i;
  }
  // Spectrum of the first 8192 samples from the onset, Hann-windowed.
  const n = 8192;
  const re = new Float64Array(n), im = new Float64Array(n);
  const start = Math.max(0, peakAt - Math.round(0.002 * fs));
  for (let i = 0; i < n && start + i < s.length; i++) re[i] = s[start + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  const power = Array.from({ length: n / 2 }, (_, k) => re[k]! ** 2 + im[k]! ** 2);
  const total = power.reduce((a, b) => a + b, 0) || 1;
  const centroid = power.reduce((a, p, k) => a + p * ((k * fs) / n), 0) / total;
  const top = power.indexOf(Math.max(...power));
  const near = power.slice(Math.max(0, top - 3), top + 4).reduce((a, b) => a + b, 0);
  return {
    ms: Math.round((s.length / fs) * 1000),
    peakDb: db(peak).toFixed(1),
    rmsDb: db(Math.sqrt(sumSq / s.length)).toFixed(1),
    attackMs: ((peakAt / fs) * 1000).toFixed(1),
    decay40Ms: Math.round(((lastLoud - peakAt) / fs) * 1000),
    centroidHz: Math.round(centroid),
    tonal: (near / total).toFixed(2),
    edges: `${Math.abs(s[0] ?? 0).toFixed(3)}/${Math.abs(s.at(-1) ?? 0).toFixed(3)}`,
  };
}

function warnings(m: ReturnType<typeof metrics>): string {
  const w: string[] = [];
  if (Number(m.tonal) > 0.5) w.push('tonal (beep-like)');
  if (m.decay40Ms > 500) w.push('rings long');
  if (m.centroidHz < 250) w.push('muddy on small speakers');
  if (Number(m.peakDb) > -0.1) w.push('clipping');
  const [a, b] = m.edges.split('/').map(Number);
  if ((a ?? 0) > 0.02 || (b ?? 0) > 0.02) w.push('click at start/end');
  return w.join(', ') || 'ok';
}

const mod = (await import(pathToFileURL(resolve(modulePath)).href)) as { previewSounds?: Preview };
if (typeof mod.previewSounds !== 'function') {
  console.error(`${modulePath} does not export previewSounds(sampleRate)`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const rows = Object.entries(mod.previewSounds(sampleRate)).map(([name, samples]) => {
  writeFileSync(join(outDir, `${name}.wav`), wav(samples, sampleRate));
  const m = metrics(samples, sampleRate);
  return { name, ...m, check: warnings(m) };
});
console.table(rows);
console.log(`WAV files in ${resolve(outDir)}`);
