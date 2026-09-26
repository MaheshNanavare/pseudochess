import { describe, expect, it } from 'vitest';
import { captureSoundFor, renderCaptureSound, type CaptureSound } from '../captureSounds';

const RATE = 44100;
const peak = (samples: Float32Array): number => samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);

describe('captureSoundFor', () => {
  it('grows with the piece taken', () => {
    expect(captureSoundFor('p')).toBe('pop');
    expect(captureSoundFor('n')).toBe('wood');
    expect(captureSoundFor('b')).toBe('wood');
    expect(captureSoundFor('r')).toBe('thud');
    expect(captureSoundFor('q')).toBe('thud');
  });
});

describe('renderCaptureSound', () => {
  const lengths: Record<CaptureSound, number> = { pop: 0.4, wood: 0.45, thud: 0.75 };

  for (const [kind, seconds] of Object.entries(lengths) as [CaptureSound, number][]) {
    it(`renders ${kind} at the right length, normalised to -3 dB`, () => {
      const samples = renderCaptureSound(kind, RATE);
      expect(samples.length).toBe(Math.floor(seconds * RATE));
      expect(peak(samples)).toBeCloseTo(0.707, 5);
      expect(samples.every(Number.isFinite)).toBe(true);
    });

    it(`${kind} starts from silence and fades out, so it never clicks`, () => {
      const samples = renderCaptureSound(kind, RATE);
      expect(Math.abs(samples[0]!)).toBeLessThan(0.2);
      expect(peak(samples.subarray(-Math.floor(RATE * 0.02)))).toBeLessThan(0.05);
    });
  }

  it('uses the given noise source, so the wooden knock is repeatable', () => {
    const seeded = () => {
      let x = 1;
      return () => ((x = (x * 16807) % 2147483647) / 2147483647) * 2 - 1;
    };
    expect(renderCaptureSound('wood', RATE, seeded())).toEqual(renderCaptureSound('wood', RATE, seeded()));
  });
});
