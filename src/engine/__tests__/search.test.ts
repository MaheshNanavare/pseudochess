import { describe, expect, it } from 'vitest';
import { Board } from '../board';
import { DEFAULT_WEIGHTS } from '../evaluate';
import { getGameResult, legalMoves } from '../rules';
import { findBestMove } from '../search';

const uci = (m: { from: string; to: string; promotion?: string }): string => `${m.from}${m.to}${m.promotion ?? ''}`;

/** Deterministic PRNG so random playouts are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('findBestMove', () => {
  it('plays a move that gets its own king checkmated', () => {
    // Re1 forces Rxe1#, and being mated wins.
    const board = new Board('4r1k1/5ppp/8/8/8/8/6PP/R6K w - - 0 1');
    const result = findBestMove(board, { depth: 3, timeLimitMs: 10_000 });
    expect(uci(result.move)).toBe('a1e1');
    expect(result.score).toBeGreaterThan(DEFAULT_WEIGHTS.win - 10);
  });

  it('avoids checkmating the opponent when another move exists', () => {
    const board = new Board('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
    const result = findBestMove(board, { depth: 3, timeLimitMs: 10_000 });
    expect(uci(result.move)).not.toBe('a1a8');
  });

  it('avoids a move that forces it to capture the opponent\'s last piece', () => {
    // Rh7 attacks a7; black just waits and white must take its last piece.
    const board = new Board('k7/p7/8/8/8/8/8/2K4R w - - 0 1');
    const result = findBestMove(board, { depth: 3, timeLimitMs: 10_000 });
    expect(uci(result.move)).not.toBe('h1h7');
    expect(result.score).toBeGreaterThan(-DEFAULT_WEIGHTS.win + 100);
  });

  it('sheds its last piece when the opponent is forced to take it', () => {
    // Rd4 must be captured by the e5 pawn, leaving white a bare king.
    const board = new Board('k7/8/8/4p3/8/8/8/K2R4 w - - 0 1');
    const result = findBestMove(board, { depth: 3, timeLimitMs: 10_000 });
    expect(uci(result.move)).toBe('d1d4');
    expect(result.score).toBe(DEFAULT_WEIGHTS.win - 2);
  });

  it('does not modify the board it searches', () => {
    const board = new Board('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
    const before = board.fen();
    findBestMove(board, { depth: 2, timeLimitMs: 10_000 });
    expect(board.fen()).toBe(before);
  });

  it('always returns a legal (forced-capture respecting) move', () => {
    const random = mulberry32(7);
    for (let game = 0; game < 3; game++) {
      const board = new Board();
      for (let ply = 0; ply < 16 && getGameResult(board).status === 'ongoing'; ply++) {
        const legal = legalMoves(board).map(uci);
        const result = findBestMove(board, { depth: 1, timeLimitMs: 1_000, topN: 3, random });
        expect(legal).toContain(uci(result.move));
        // Advance with a random legal move to reach varied positions.
        board.make(legalMoves(board)[Math.floor(random() * legal.length)]!);
      }
    }
  });

  it('hard always completes at least the spec depth 5, then deepens within its time budget', () => {
    const board = new Board('r2q1rk1/pp2bppp/2n1bn2/3p4/3P4/2NBBN2/PP3PPP/R2Q1RK1 w - - 0 10');
    const result = findBestMove(board, 'hard');
    expect(result.depth).toBeGreaterThanOrEqual(5);
    expect(result.timeMs).toBeLessThan(4000);
  });

  it('breaks ties between equal moves differently with different random streams', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      seen.add(uci(findBestMove(new Board(), { depth: 2, random: mulberry32(seed) }).move));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('easy mode varies its moves, stays legal and never picks a lost move when a better one exists', () => {
    const board = new Board();
    const legal = legalMoves(board).map(uci);
    const seen = new Set<string>();
    const random = mulberry32(3);
    for (let i = 0; i < 6; i++) {
      const result = findBestMove(board, { depth: 2, topN: 3, timeLimitMs: 5_000, random });
      expect(legal).toContain(uci(result.move));
      expect(result.score).toBeGreaterThan(-DEFAULT_WEIGHTS.win + 1000);
      seen.add(uci(result.move));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('easy mode never picks a move it sees as lost', () => {
    // Rd4 wins at once (exd4 is forced), while rook moves that attack e5, such as
    // Re1, lose: black waits and white must take its last pawn. Easy may choose
    // any of its top 3 moves, but never a lost one.
    const board = new Board('k7/8/8/4p3/8/8/8/K2R4 w - - 0 1');
    for (let seed = 1; seed <= 5; seed++) {
      const result = findBestMove(board, { depth: 3, topN: 3, timeLimitMs: 5_000, random: mulberry32(seed) });
      expect(result.score).toBeGreaterThan(-DEFAULT_WEIGHTS.win + 1000);
    }
  });
});
