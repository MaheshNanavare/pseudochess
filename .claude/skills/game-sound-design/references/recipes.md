# Recipes

## Contents
1. The modal recipe (code)
2. Material tables
3. Composite events (captures, drops, slides)
4. UI, alerts and stings

## 1. The modal recipe

```ts
type Rng = () => number; // uniform in [0, 1)

/** A force pulse: a raised-cosine bump `widthMs` wide plus a little noise for surface roughness. */
function strike(fs: number, widthMs: number, rough: number, rng: Rng): Float32Array {
  const n = Math.max(2, Math.round((widthMs / 1000) * fs));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    out[i] = w * (1 + rough * (rng() * 2 - 1));
  }
  return out;
}

/** One vibration mode: a two-pole resonator at `f` Hz whose ringing decays with time constant `tau` seconds. */
function mode(excitation: Float32Array, f: number, tau: number, fs: number, length: number): Float32Array {
  const r = Math.exp(-1 / (tau * fs));
  const a1 = 2 * r * Math.cos((2 * Math.PI * f) / fs);
  const a2 = -r * r;
  const out = new Float32Array(length);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < length; i++) {
    const y = (excitation[i] ?? 0) + a1 * y1 + a2 * y2;
    out[i] = y; y2 = y1; y1 = y;
  }
  return out;
}
```

Mix the modes with amplitudes `amp_k * pulseGain(strike, f_k)`, after scaling each mode by `1 / peak(mode_k)`. The per-mode scaling makes `amp_k` mean what it says. The pulse gain puts back how hard the contact drives each frequency. If you drop it, a felt pulse and a wooden pulse sound the same, which loses the main material cue.

```ts
/** |pulse spectrum at f| / |pulse spectrum at 0 Hz|: 1 for low f, falling off sooner for wider (softer) pulses. */
function pulseGain(pulse: Float32Array, f: number, fs: number): number {
  let re = 0, im = 0, dc = 0;
  pulse.forEach((v, i) => { re += v * Math.cos(2 * Math.PI * f * i / fs); im -= v * Math.sin(2 * Math.PI * f * i / fs); dc += v; });
  return dc > 0 ? Math.hypot(re, im) / dc : 0;
}
```

A raised-cosine pulse `T` seconds wide has its first spectral null at `2 / T`, so a 1 ms felt contact barely drives anything above ~1.5 kHz. Decay per mode: `tau_k = tau0 * ratio_k ** -0.7`. Finish with a 5-10 ms fade-out at the end, then normalise.

**Early reflection:** `out[i] += g * lowpass(out)[i - d]`, with `d` of 10-20 ms and `g` around 0.15-0.2. A one-pole low-pass (`y += 0.3 * (x - y)`) keeps it soft.

## 2. Material tables

Ratios are relative to `f0`. Amplitudes fall with the mode number. `tau0` is the decay of the lowest mode.

| Material / object | f0 | ratios | tau0 | strike width | feel |
|---|---|---|---|---|---|
| Felt-based wooden piece on a wooden board | 170-220 Hz | 1, 1.47, 2.09, 2.82, 3.9, 5.3 | 60-90 ms | 2-3 ms | dull, warm thock |
| Small hard wooden piece struck (clack) | 700-1200 Hz | 1, 1.73, 2.61, 3.49, 4.72 | 25-45 ms | 0.25-0.4 ms | bright, dry clack |
| Free wooden bar (marimba-like, use sparingly) | any | 1, 2.76, 5.40, 8.93 | 150-400 ms | 0.5-1 ms | pitched wood |
| Stone / marble piece | 900-1600 Hz | 1, 1.6, 2.4, 3.3 | 60-120 ms | 0.2 ms | cold, glassy click |
| Thin metal (bell, coin) | any | 1, 2.0, 3.0, 4.16, 5.43, 6.79 | 400-1500 ms | 0.2 ms | ringing; stays tonal |
| Glass | 1-3 kHz | 1, 2.32, 4.25, 6.63 | 200-600 ms | 0.1 ms | bright, pure |

Size sets pitch: a bigger or heavier object gives a lower `f0` (roughly proportional to 1/size), a longer `tau0` and more amplitude. Scale the whole mode set, not single modes.

## 3. Composite events

- **Capture (piece takes piece):** a hard clack from the two pieces meeting, then 50-90 ms later the felt thock of the capturer landing. Scale the clack's `f0` down and its level up with the captured piece's value, so taking a queen feels heavier than taking a pawn. For the biggest pieces, add a low board "boom" mode (80-110 Hz, tau ~120 ms) at low level.
- **Drop onto a box or tray:** 2-3 thocks with shrinking gaps (e.g. 0, 70, 115 ms) and levels (1, 0.45, 0.2), each slightly higher in pitch: a settling bounce.
- **Slide:** band-passed noise (1-3 kHz) with a slow swell and fall over 80-200 ms, very quiet under the landing sound.

## 4. UI, alerts and stings

- **UI click:** the clack recipe at `f0` ~2 kHz, tau0 ~15 ms, very short. Keep it quieter than game sounds.
- **Check / alert:** here a tonal sound is appropriate, because it should stand out from the wood. Use two soft mallet notes a fourth apart (the free-bar ratios, strike 1 ms, tau0 ~250 ms), 90 ms apart.
- **Win sting:** a rising 3-4 note figure on the pitched-wood or bell table (major triad, 90-110 ms apart), with the last note longer. **Loss:** a falling minor figure, lower and slower. **Draw:** two equal notes, or a suspended chord that resolves to neither. Keep stings under ~1.2 s so they do not cover the result screen's music.
