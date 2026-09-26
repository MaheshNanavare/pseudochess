import type { PieceType } from '../engine/types';

/*
 * Wooden piece sounds, made by modal synthesis (see the game-sound-design
 * skill): a short force pulse rings a handful of inharmonic, fast-decaying
 * modes, the way a real piece and board vibrate. Pure functions with no Web
 * Audio, so they can be tested and rendered to WAV; sound.ts copies them into
 * AudioBuffers.
 *
 * - move: a weighted boxwood piece with a felt base set down on a wooden board
 *   (soft 0.9 ms contact, so a warm "thock").
 * - capture: the two pieces clack together (hard 0.3 ms contact on a small
 *   piece, bright and dry), then the capturing piece lands with a thock.
 *   The bigger the piece taken, the lower and heavier the clack, and rooks
 *   and queens add a low board "boom".
 */

export type CaptureSize = 'light' | 'medium' | 'heavy' | 'massive';
export type PieceSound = 'move' | `capture-${CaptureSize}`;

/** Each sound is rendered in a few variants, so repeated moves do not sound machine-made. */
export const VARIANTS = 4;

/**
 * Playback level for each sound. Every rendered sound is normalised to the
 * same peak, so the balance lives only here: moves sit well under captures.
 */
export const PLAYBACK_GAIN: Record<PieceSound, number> = {
  move: 0.38,
  'capture-light': 0.5,
  'capture-medium': 0.56,
  'capture-heavy': 0.63,
  'capture-massive': 0.7,
};

export function captureSize(captured: PieceType): CaptureSize {
  if (captured === 'p') return 'light';
  if (captured === 'r') return 'heavy';
  if (captured === 'q') return 'massive';
  return 'medium';
}

type Rng = () => number;

/** Small seeded generator (mulberry32), so a variant always renders the same. */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ModeSet {
  f0: number;
  ratios: readonly number[];
  amps: readonly number[];
  /** Decay time constant of the lowest mode, in seconds; higher modes die faster. */
  tau0: number;
}

/** Felt-based piece on a wooden board. */
const THOCK: ModeSet = { f0: 275, ratios: [1, 1.47, 2.09, 2.82, 3.9, 5.3], amps: [0.4, 0.62, 0.85, 0.78, 0.62, 0.42], tau0: 0.045 };
/** Small hard wooden piece struck by another. */
const CLACK: ModeSet = { f0: 1000, ratios: [1, 1.73, 2.61, 3.49, 4.72], amps: [1, 0.85, 0.6, 0.42, 0.26], tau0: 0.032 };
/** The board's lowest resonance, only for heavy captures. */
const BOOM: ModeSet = { f0: 96, ratios: [1, 1.52], amps: [1, 0.4], tau0: 0.11 };

const CAPTURE: Record<CaptureSize, { clackPitch: number; clackTau: number; thockPitch: number; boom: number }> = {
  light: { clackPitch: 1.15, clackTau: 0.9, thockPitch: 1.06, boom: 0 },
  medium: { clackPitch: 0.96, clackTau: 1, thockPitch: 1, boom: 0 },
  heavy: { clackPitch: 0.82, clackTau: 1.1, thockPitch: 0.95, boom: 0.28 },
  massive: { clackPitch: 0.7, clackTau: 1.25, thockPitch: 0.9, boom: 0.42 },
};

const PEAK = 0.9;

/** A force pulse: a raised-cosine bump plus a little noise for surface roughness. */
function strike(fs: number, widthMs: number, rough: number, rng: Rng): Float32Array {
  const n = Math.max(2, Math.round((widthMs / 1000) * fs));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))) * (1 + rough * (rng() * 2 - 1));
  return out;
}

/** One vibration mode: a two-pole resonator ringing at f Hz with decay tau seconds, scaled to a peak of 1. */
function mode(excitation: Float32Array, f: number, tau: number, fs: number, length: number): Float32Array {
  const r = Math.exp(-1 / (tau * fs));
  const a1 = 2 * r * Math.cos((2 * Math.PI * f) / fs);
  const a2 = -r * r;
  const out = new Float32Array(length);
  let y1 = 0;
  let y2 = 0;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const y = (excitation[i] ?? 0) + a1 * y1 + a2 * y2;
    out[i] = y;
    y2 = y1;
    y1 = y;
    peak = Math.max(peak, Math.abs(y));
  }
  if (peak > 0) for (let i = 0; i < length; i++) out[i] = out[i]! / peak;
  return out;
}

/**
 * How strongly a pulse drives frequency f, relative to its total force (1 at 0 Hz).
 * A wide (soft) pulse falls off early, which is what makes felt sound dull and wood-on-wood bright.
 */
function pulseGain(pulse: Float32Array, f: number, fs: number): number {
  let re = 0;
  let im = 0;
  let dc = 0;
  pulse.forEach((v, i) => {
    re += v * Math.cos((2 * Math.PI * f * i) / fs);
    im -= v * Math.sin((2 * Math.PI * f * i) / fs);
    dc += v;
  });
  return dc > 0 ? Math.hypot(re, im) / dc : 0;
}

/** A struck object: the excitation rings every mode of the set, higher modes decaying faster. */
function body(set: ModeSet, pitch: number, tauScale: number, excitation: Float32Array, fs: number, length: number, rng: Rng): Float32Array {
  const out = new Float32Array(length);
  set.ratios.forEach((ratio, k) => {
    // Each mode is detuned a touch, like a real (imperfect) piece.
    const f = set.f0 * pitch * ratio * (1 + (rng() * 2 - 1) * 0.012);
    const tau = set.tau0 * tauScale * ratio ** -0.7;
    const ring = mode(excitation, f, tau, fs, length);
    // `mode` scales each ring to a peak of 1, so put back how hard this pulse drives it.
    const amp = (set.amps[k] ?? 0) * pulseGain(excitation, f, fs);
    for (let i = 0; i < length; i++) out[i] = out[i]! + ring[i]! * amp;
  });
  return out;
}

/** Adds `src` into `dst` starting at sample `at`, scaled by `gain`. */
function mixInto(dst: Float32Array, src: Float32Array, at: number, gain: number): void {
  for (let i = 0; i < src.length && at + i < dst.length; i++) dst[at + i] = dst[at + i]! + src[i]! * gain;
}

/** A soft early reflection, so it sounds like a room rather than the inside of a speaker. */
function reflect(s: Float32Array, fs: number, ms: number, gain: number): void {
  const d = Math.round((ms / 1000) * fs);
  let lp = 0;
  for (let i = s.length - 1; i >= d; i--) {
    lp += 0.3 * (s[i - d]! - lp);
    s[i] = s[i]! + lp * gain;
  }
}

/** Fades the last few milliseconds and scales to the common peak. */
function finish(s: Float32Array, fs: number): Float32Array {
  const fade = Math.round(0.008 * fs);
  for (let i = 0; i < fade; i++) s[s.length - 1 - i] = s[s.length - 1 - i]! * (i / fade);
  let peak = 0;
  for (const v of s) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < s.length; i++) s[i] = (s[i]! / peak) * PEAK;
  return s;
}

const jitter = (rng: Rng, amount: number) => 1 + (rng() * 2 - 1) * amount;

/** Felt base on wood: a warm thock with a faint contact tick. */
function thock(fs: number, rng: Rng, pitch: number, length: number): Float32Array {
  const out = body(THOCK, pitch * jitter(rng, 0.04), jitter(rng, 0.1), strike(fs, 0.9, 0.3, rng), fs, length, rng);
  // The rim of the base touches first: a quiet, bright tick.
  mixInto(out, body(CLACK, pitch * 1.9, 0.35, strike(fs, 0.35, 0.6, rng), fs, Math.round(0.03 * fs), rng), 0, 0.32);
  return out;
}

function renderMove(fs: number, rng: Rng): Float32Array {
  const out = thock(fs, rng, 1, Math.round(0.26 * fs));
  reflect(out, fs, 13, 0.16);
  return finish(out, fs);
}

function renderCapture(size: CaptureSize, fs: number, rng: Rng): Float32Array {
  const p = CAPTURE[size];
  const out = new Float32Array(Math.round(0.42 * fs));
  const clack = body(CLACK, p.clackPitch * jitter(rng, 0.04), p.clackTau, strike(fs, 0.3, 0.5, rng), fs, Math.round(0.2 * fs), rng);
  mixInto(out, clack, 0, 1);
  // The capturing piece lands a moment after it knocks the other one.
  const land = Math.round((0.062 + rng() * 0.016) * fs);
  mixInto(out, thock(fs, rng, p.thockPitch, Math.round(0.3 * fs)), land, 0.5);
  if (p.boom > 0) mixInto(out, body(BOOM, jitter(rng, 0.03), 1, strike(fs, 3, 0.2, rng), fs, Math.round(0.35 * fs), rng), land, p.boom);
  reflect(out, fs, 15, 0.16);
  return finish(out, fs);
}

const SEEDS: Record<PieceSound, number> = { move: 11, 'capture-light': 23, 'capture-medium': 37, 'capture-heavy': 41, 'capture-massive': 53 };

/** Renders one variant (0..VARIANTS-1) of a sound; the same variant always renders the same samples. */
export function renderPieceSound(sound: PieceSound, variant: number, sampleRate: number): Float32Array<ArrayBuffer> {
  const rng = seeded(SEEDS[sound] * 1000 + variant);
  const out = sound === 'move' ? renderMove(sampleRate, rng) : renderCapture(sound.slice('capture-'.length) as CaptureSize, sampleRate, rng);
  return out as Float32Array<ArrayBuffer>;
}

export const PIECE_SOUNDS: readonly PieceSound[] = ['move', 'capture-light', 'capture-medium', 'capture-heavy', 'capture-massive'];

/** For the game-sound-design preview script: every variant of every sound. */
export function previewSounds(sampleRate: number): Record<string, Float32Array> {
  const all: Record<string, Float32Array> = {};
  for (const sound of PIECE_SOUNDS) for (let v = 0; v < VARIANTS; v++) all[`${sound}-${v + 1}`] = renderPieceSound(sound, v, sampleRate);
  return all;
}
