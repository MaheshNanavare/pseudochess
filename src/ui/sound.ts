/**
 * Small synthesised sound effects (no audio files, so they work offline and
 * add nothing to the download). The context is created on first use, which
 * always follows a user gesture in this app.
 */
export type SoundKind = 'move' | 'capture' | 'check' | 'win' | 'loss' | 'draw';

let context: AudioContext | null = null;

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
    case 'move':
      tone(ctx, 520, t, 0.07, 'triangle', 0.18);
      break;
    case 'capture':
      tone(ctx, 300, t, 0.09, 'triangle', 0.25);
      tone(ctx, 200, t + 0.05, 0.12, 'sine', 0.2);
      break;
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
