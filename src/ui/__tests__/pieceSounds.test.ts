import { describe, expect, it } from 'vitest';
import { captureSize, PIECE_SOUNDS, previewSounds, renderPieceSound, VARIANTS } from '../pieceSounds';

const RATE = 44100;
const peak = (s: Float32Array): number => s.reduce((max, v) => Math.max(max, Math.abs(v)), 0);

describe('captureSize', () => {
  it('grows with the piece taken', () => {
    expect(captureSize('p')).toBe('light');
    expect(captureSize('n')).toBe('medium');
    expect(captureSize('b')).toBe('medium');
    expect(captureSize('r')).toBe('heavy');
    expect(captureSize('q')).toBe('massive');
  });
});

describe('renderPieceSound', () => {
  for (const sound of PIECE_SOUNDS) {
    it(`${sound}: every variant is short, finite and normalised`, () => {
      for (let v = 0; v < VARIANTS; v++) {
        const s = renderPieceSound(sound, v, RATE);
        expect(s.length / RATE).toBeLessThan(0.5);
        expect(s.every(Number.isFinite)).toBe(true);
        expect(peak(s)).toBeCloseTo(0.9, 5);
      }
    });

    it(`${sound}: starts from silence and fades out, so it never clicks`, () => {
      const s = renderPieceSound(sound, 0, RATE);
      expect(Math.abs(s[0]!)).toBeLessThan(0.05);
      expect(Math.abs(s.at(-1)!)).toBeLessThan(0.001);
      // Wood dies quickly: the last 50 ms is far below the peak.
      expect(peak(s.subarray(-Math.round(0.05 * RATE)))).toBeLessThan(0.05);
    });
  }

  it('renders the same samples for the same variant', () => {
    expect(renderPieceSound('move', 2, RATE)).toEqual(renderPieceSound('move', 2, RATE));
  });

  it('makes the variants differ from each other', () => {
    expect(renderPieceSound('move', 0, RATE)).not.toEqual(renderPieceSound('move', 1, RATE));
  });

  it('lets bigger captures ring longer', () => {
    const tailEnergy = (s: Float32Array) => s.subarray(Math.round(0.15 * RATE)).reduce((a, v) => a + v * v, 0);
    expect(tailEnergy(renderPieceSound('capture-massive', 0, RATE))).toBeGreaterThan(tailEnergy(renderPieceSound('capture-light', 0, RATE)));
  });

  it('offers every variant to the preview script', () => {
    expect(Object.keys(previewSounds(RATE))).toHaveLength(PIECE_SOUNDS.length * VARIANTS);
  });
});
