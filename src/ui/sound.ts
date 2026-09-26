/**
 * Sound effects, all synthesised (no audio files, so they work offline and
 * add nothing to the download). The context is created on first use, which
 * always follows a user gesture in this app.
 *
 * Piece moves and captures are wooden sounds from pieceSounds.ts; check and
 * the end-of-game cues are short tones, meant to stand apart from the wood.
 */
import type { PieceType } from '../engine/types';
import { captureSize, PLAYBACK_GAIN, renderPieceSound, VARIANTS, type PieceSound } from './pieceSounds';

export type SoundKind = 'check' | 'win' | 'loss' | 'draw';

let context: AudioContext | null = null;
const pieceBuffers = new Map<PieceSound, AudioBuffer[]>();

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(ctx: AudioContext, freq: number, start: number, duration: number, type: OscillatorType, gain: number): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playSound(kind: SoundKind): void {
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  switch (kind) {
    case 'check':
      tone(ctx, 880, t, 0.12, 'sine', 0.16);
      tone(ctx, 660, t + 0.09, 0.14, 'sine', 0.12);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(ctx, f, t + i * 0.09, 0.22, 'triangle', 0.16));
      break;
    case 'loss':
      [392, 330, 262].forEach((f, i) => tone(ctx, f, t + i * 0.12, 0.26, 'sine', 0.16));
      break;
    case 'draw':
      tone(ctx, 440, t, 0.2, 'sine', 0.14);
      tone(ctx, 440, t + 0.18, 0.2, 'sine', 0.1);
      break;
  }
}

/** All variants of a piece sound, rendered once on first use. */
function variants(ctx: AudioContext, sound: PieceSound): AudioBuffer[] {
  let buffers = pieceBuffers.get(sound);
  if (!buffers) {
    buffers = Array.from({ length: VARIANTS }, (_, v) => {
      const samples = renderPieceSound(sound, v, ctx.sampleRate);
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.copyToChannel(samples, 0);
      return buffer;
    });
    pieceBuffers.set(sound, buffers);
  }
  return buffers;
}

/** A random variant at a slightly random speed, so no two moves sound identical. */
function playPiece(sound: PieceSound): void {
  const ctx = audio();
  if (!ctx) return;
  const buffers = variants(ctx, sound);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffers[Math.floor(Math.random() * buffers.length)]!;
  source.playbackRate.value = 0.97 + Math.random() * 0.06;
  gain.gain.value = PLAYBACK_GAIN[sound];
  source.connect(gain).connect(ctx.destination);
  source.start();
}

export function playMove(): void {
  playPiece('move');
}

/** The capture sound for the piece that was taken: heavier for bigger pieces. */
export function playCapture(captured: PieceType): void {
  playPiece(`capture-${captureSize(captured)}`);
}
