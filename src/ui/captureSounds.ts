import type { PieceType } from '../engine/types';

/*
 * Capture sound effects, synthesised sample by sample (recipes designed with
 * Gemini). Pure functions, no Web Audio here, so they can be tested; sound.ts
 * copies the samples into an AudioBuffer. Each sound is normalised to a peak
 * of 0.707 (-3 dB).
 */

export type CaptureSound = 'pop' | 'wood' | 'thud';

/** The sound grows with the piece taken: pawns pop, minor pieces knock, rooks and queens thud. */
export function captureSoundFor(captured: PieceType): CaptureSound {
  if (captured === 'p') return 'pop';
  if (captured === 'r' || captured === 'q') return 'thud';
  return 'wood';
}

const TAU = 2 * Math.PI;
const PEAK = 0.707;

/** A random number in [-1, 1). */
type Noise = () => number;
const whiteNoise: Noise = () => Math.random() * 2 - 1;

function render(seconds: number, sampleRate: number, sample: (t: number) => number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.floor(seconds * sampleRate));
  for (let i = 0; i < out.length; i++) out[i] = sample(i / sampleRate);
  return normalise(out);
}

function normalise(samples: Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer> {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max === 0) return samples;
  const scale = PEAK / max;
  for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! * scale;
  return samples;
}

/** Wooden knock (240 Hz body, felt transient) with a soft low-passed whoosh. */
function wood(sampleRate: number, noise: Noise): Float32Array<ArrayBuffer> {
  let whooshNoise = 0;
  return render(0.45, sampleRate, (t) => {
    const body = (Math.sin(TAU * 240 * t) * 0.7 + Math.sin(TAU * 480 * t) * 0.3) * Math.exp(-t / 0.04);
    const felt = noise() * Math.exp(-t / 0.012) * 0.25;
    // Swells to a peak at 60 ms, then fades; one-pole low-pass keeps it airy rather than hissy.
    const swell = (t / 0.06) * Math.exp(1 - t / 0.06) * Math.exp(-t / 0.18);
    whooshNoise += 0.15 * (noise() - whooshNoise);
    return body + felt + whooshNoise * swell * 0.2;
  });
}

/** A pitch-dropping pop (650 Hz down to 220 Hz) with a C7 + E7 sparkle 30 ms later. */
function pop(sampleRate: number): Float32Array<ArrayBuffer> {
  return render(0.4, sampleRate, (t) => {
    // Phase of a sweep from 650 Hz to 220 Hz with a 20 ms time constant.
    const phase = TAU * (220 * t + 430 * 0.02 * (1 - Math.exp(-t / 0.02)));
    const body = Math.sin(phase) * Math.exp(-t / 0.045) * 0.8;
    const st = t - 0.03;
    const sparkle = st > 0 ? (Math.sin(TAU * 2093 * st) * 0.15 + Math.sin(TAU * 2637 * st) * 0.1) * Math.exp(-st / 0.12) : 0;
    return body + sparkle;
  });
}

/** A deep, softly saturated 98 Hz thud with a warm 880/1320 Hz shimmer swelling in. */
function thud(sampleRate: number): Float32Array<ArrayBuffer> {
  return render(0.75, sampleRate, (t) => {
    const raw = Math.sin(TAU * 98 * t) + 0.35 * Math.sin(TAU * 196 * t);
    const body = Math.tanh(raw * 1.4) * Math.exp(-t / 0.11) * 0.75;
    const shimmer = (Math.sin(TAU * 880 * t) * 0.18 + Math.sin(TAU * 1320 * t) * 0.1) * (1 - Math.exp(-t / 0.025)) * Math.exp(-t / 0.22);
    return body + shimmer;
  });
}

export function renderCaptureSound(kind: CaptureSound, sampleRate: number, noise: Noise = whiteNoise): Float32Array<ArrayBuffer> {
  switch (kind) {
    case 'wood':
      return wood(sampleRate, noise);
    case 'pop':
      return pop(sampleRate);
    case 'thud':
      return thud(sampleRate);
  }
}
