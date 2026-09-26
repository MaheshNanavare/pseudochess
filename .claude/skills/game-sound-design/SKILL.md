---
name: game-sound-design
description: Design and synthesise game sound effects in code (TypeScript / Web Audio) that sound like real materials, not beeps. Use this whenever a game or app needs sound effects made without audio files, when sounds are described as "beepy", "synthetic", "not wooden", "cheap" or "not real", or when adding or reworking move, capture, click, impact, UI, win, loss or draw sounds, even if the user only says "make the sounds nicer". Covers physical (modal) synthesis of wood, felt, stone, metal and glass impacts, variation so repeated sounds do not fatigue, loudness balance, and a Node workflow that renders every sound to WAV with objective checks (no Python needed).
---

# Game sound design (synthesised)

Sounds are generated sample by sample in plain TypeScript, so they cost nothing to download, work offline, and can be unit-tested and rendered to WAV for listening. The runtime only copies the samples into an `AudioBuffer`.

## Why synthetic sounds come out "beepy"

People recognise materials from three cues. Get these right and a few lines of maths read as wood; get them wrong and it reads as an electronic tone:

1. **Inharmonic partials.** Struck objects vibrate in modes whose frequencies are *not* whole-number multiples (a free wooden bar: 1, 2.76, 5.40, 8.93). Sine waves at 1x and 2x sound musical, like a marimba or a beep.
2. **Higher modes die faster.** Wood has high internal damping. Each mode decays in tens of milliseconds, and the higher the mode, the shorter it rings (roughly `tau_k = tau_0 * (f_0 / f_k)^0.7`). One long sine tail is the single most common reason a "wood" sound is not wooden.
3. **The contact tells the hardness.** The strike is a short force pulse. A hard contact (wood on wood) is a pulse of ~0.3 ms, which excites everything up to several kHz: a bright "clack". A soft contact (felt base, rubber) is 2-4 ms, which acts as a low-pass filter: a dull "thock". Changing only the pulse width changes the material feel convincingly.

A little texture completes it: a few percent of noise in the excitation (real surfaces are rough) and a faint early reflection (~10-20 ms, -14 dB) so it sounds like it happened in a room rather than inside the speaker.

## Workflow

1. **Name the physical event** before writing any code. "A weighted boxwood piece with a felt base set down on a wooden board" gives you the materials, the contact hardness, and the sizes (which set the pitch). A capture is two events: piece strikes piece (hard, bright, small object), then the capturing piece lands (soft, lower, board resonance).
2. **Build it from the modal recipe** in `references/recipes.md`: an excitation pulse fed through a handful of two-pole resonators (one per mode), mixed, plus optional reflection. Start from the closest material table there.
3. **Make it vary.** Render 3-5 variants per sound with different random seeds and ±3-5% pitch. Pick one at random per play, optionally with a playback rate of 0.97-1.03. Identical repeats ("machine-gun effect") are what make game sounds grating after a few minutes.
4. **Balance loudness by role.** Frequent sounds (moves) sit lowest, about 4-6 dB under important ones (captures), and stings (win, loss) sit near the capture level. Normalise every rendered sound to the same peak, then set the level at playback with a gain node, so the balance lives in one place.
5. **Render and check** (see below), then listen to the WAVs. Iterate on the recipe, not on the runtime code.
6. **Test** the pure generators with Vitest: length, peak, finiteness, silent start and end, and that the variants differ from each other.

## Rendering and checking

The bundled script renders any sound module to WAV files and prints objective metrics:

```bash
npx tsx .claude/skills/game-sound-design/scripts/sfx-preview.ts src/ui/pieceSounds.ts test-results/sfx
```

The module must export `previewSounds(sampleRate: number): Record<string, Float32Array>`. The keys become the file names.

The metrics catch problems before anyone has to listen:

| Metric | Wooden impact | Warning sign |
|---|---|---|
| Tonal ratio (energy share of the strongest spectral peak) | 0.10-0.40 | above 0.5 = reads as a beep or bell |
| Decay to -40 dB | 60-250 ms (moves), up to ~400 ms (big captures) | over 500 ms = ringing, not wood |
| Spectral centroid | 400-1500 Hz for felt thocks, 1-3 kHz for clacks | under 250 Hz = muddy thud on laptop speakers |
| Start / end sample | about 0 | a jump = audible click |

Render **every** variant when checking, not just one: random detuning can make a single variant tonal.

**Fixing what the checks flag:**
- **Tonal:** a mode's share of the energy grows with `amp² × tau`, so the long-ringing low modes win. Shorten `tau0`, lower the amplitudes of the lowest modes, and give more to the middle ones. Raising the level of the contact tick also helps.
- **Muddy (low centroid):** raise `f0`, narrow the strike pulse a little, or let the bright part of a composite (the clack in a capture) lead in the mix.
- **Rings long:** lower `tau0`, or reduce the steepness exponent so the high modes fade with the low ones.

Laptop and phone speakers reproduce little below ~150 Hz. Keep the defining energy of a sound above that, and use the low end only as weight.

## Runtime pattern (Web Audio)

- Create the `AudioContext` lazily on the first user gesture (browsers block audio before one).
- Render each variant once on first use and cache the `AudioBuffer`s. Rendering a few hundred milliseconds of audio takes well under a millisecond per variant.
- Play through `AudioBufferSourceNode → GainNode → destination`, with the role's gain.
- Keep a user-facing mute for effects, separate from any music mute.

## Other sounds

`references/recipes.md` also has starting points for UI clicks, check or alert chimes, and short win, loss and draw stings. They use the same idea: build from physical events, then vary and balance them.
