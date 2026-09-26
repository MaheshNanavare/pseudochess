import { describe, expect, it } from 'vitest';
import { Board } from '../board';
import { acceptsDrawOffer } from '../draw';

describe('acceptsDrawOffer', () => {
  it('accepts locked pawns with no capture in reach', () => {
    expect(acceptsDrawOffer(new Board('4k3/8/8/3p4/3P4/8/8/4K3 w - - 0 1'))).toBe(true);
  });

  it('accepts with only the two kings left', () => {
    expect(acceptsDrawOffer(new Board('4k3/8/8/8/8/8/8/4K3 b - - 0 1'))).toBe(true);
  });

  it('declines while any piece other than kings and pawns is on the board', () => {
    expect(acceptsDrawOffer(new Board('4k3/8/8/3p4/3P4/8/8/4K1N1 w - - 0 1'))).toBe(false);
    expect(acceptsDrawOffer(new Board('q3k3/8/8/8/8/8/8/4K3 w - - 0 1'))).toBe(false);
  });

  it('declines when a capture is available now', () => {
    expect(acceptsDrawOffer(new Board('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'))).toBe(false);
  });

  it('declines when a move can hand the opponent a capture next ply', () => {
    // e3-e4 lets d5xe4.
    expect(acceptsDrawOffer(new Board('4k3/8/8/3p4/8/4P3/8/4K3 w - - 0 1'))).toBe(false);
  });

  it('only looks as far as it is told', () => {
    // No capture now, but e2-e3 (or e2-e4, en passant) lets d4 capture on the second ply.
    const board = new Board('4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1');
    expect(acceptsDrawOffer(board, 1)).toBe(true);
    expect(acceptsDrawOffer(board, 2)).toBe(false);
  });

  it('leaves the board as it found it', () => {
    const board = new Board('4k3/8/8/3p4/3P4/8/8/4K3 w - - 0 1');
    const fen = board.fen();
    acceptsDrawOffer(board);
    expect(board.fen()).toBe(fen);
  });
});
