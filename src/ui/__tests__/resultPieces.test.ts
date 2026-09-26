import { describe, expect, it } from 'vitest';
import type { Move, Piece } from '../../engine/types';
import { atLeast, heldPieces, shedPieces } from '../resultPieces';

const move = (color: 'w' | 'b', captured?: Move['captured']): Move => ({ from: 'e2', to: 'e4', color, piece: 'p', san: 'x', ...(captured ? { captured } : {}) });

describe('shedPieces', () => {
  it("lists a side's pieces taken by the other side, most valuable first", () => {
    const history = [move('w'), move('b', 'p'), move('w', 'n'), move('b', 'q'), move('w', 'p')];
    expect(shedPieces(history, 'w')).toEqual(['q', 'p']);
    expect(shedPieces(history, 'b')).toEqual(['n', 'p']);
  });
});

describe('heldPieces', () => {
  it('lists the pieces still on the board, without the king', () => {
    const pieces: Piece[] = [
      { color: 'w', type: 'k', square: 'e1' },
      { color: 'w', type: 'p', square: 'a2' },
      { color: 'w', type: 'r', square: 'h1' },
      { color: 'b', type: 'q', square: 'd8' },
    ];
    expect(heldPieces(pieces, 'w')).toEqual(['r', 'p']);
  });
});

describe('atLeast', () => {
  it('repeats a short list up to the count', () => {
    expect(atLeast(['q', 'p'], 5, 'k')).toEqual(['q', 'p', 'q', 'p', 'q']);
  });

  it('keeps a long list as it is', () => {
    expect(atLeast(['p', 'p', 'p'], 2, 'k')).toEqual(['p', 'p', 'p']);
  });

  it('falls back when there is nothing to show', () => {
    expect(atLeast([], 3, 'k')).toEqual(['k', 'k', 'k']);
  });
});
