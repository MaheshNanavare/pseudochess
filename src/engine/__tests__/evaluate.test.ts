import { describe, expect, it } from 'vitest';
import { Board } from '../board';
import { DEFAULT_WEIGHTS, evaluate } from '../evaluate';

const WIN = DEFAULT_WEIGHTS.win;
const evalFen = (fen: string, me: 'w' | 'b'): number => evaluate(new Board(fen), me, 0);

describe('evaluate', () => {
  it('is symmetric: eval(me) === -eval(opponent)', () => {
    const fens = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      '4k3/pp6/8/3q4/8/2N5/PP6/4K3 b - - 0 1',
    ];
    for (const fen of fens) {
      expect(evalFen(fen, 'w') + evalFen(fen, 'b')).toBe(0);
    }
  });

  it('scores fewer own pieces higher', () => {
    const more = evalFen('4k3/pp6/8/8/8/8/PP6/4K3 w - - 0 1', 'w');
    const fewer = evalFen('4k3/pp6/8/8/8/8/P7/4K3 w - - 0 1', 'w');
    expect(fewer).toBeGreaterThan(more);
  });

  it('scores an advanced pawn higher than an unmoved pawn', () => {
    const unmoved = evalFen('4k3/7p/8/8/8/8/P7/4K3 w - - 0 1', 'w');
    const advanced = evalFen('4k3/7p/8/8/P7/8/8/4K3 w - - 0 1', 'w');
    expect(advanced).toBeGreaterThan(unmoved);
  });

  it('values an exposed pawn more than an exposed queen', () => {
    // Knight on c6 attacks d4; knight on h6 attacks nothing.
    const pawnExposed = evalFen('k7/8/2n5/8/3P4/8/8/4K3 w - - 0 1', 'w');
    const pawnSafe = evalFen('k7/8/7n/8/3P4/8/8/4K3 w - - 0 1', 'w');
    const queenExposed = evalFen('k7/8/2n5/8/3Q4/8/8/4K3 w - - 0 1', 'w');
    const queenSafe = evalFen('k7/8/7n/8/3Q4/8/8/4K3 w - - 0 1', 'w');
    expect(pawnExposed - pawnSafe).toBeGreaterThan(queenExposed - queenSafe);
    expect(queenExposed - queenSafe).toBeGreaterThan(0);
  });

  it('scores a queen attacking several enemy pieces lower', () => {
    // Queen on d5 attacks b7, d7 and f7 in the first position; on g1 it attacks nothing.
    const attacking = evalFen('k7/1p1p1p2/8/3Q4/8/8/8/4K3 w - - 0 1', 'w');
    const quiet = evalFen('k7/1p1p1p2/8/8/8/8/8/4K1Q1 w - - 0 1', 'w');
    expect(attacking).toBeLessThan(quiet);
  });

  it('returns the win value when my king is checkmated, and the loss value for the mater', () => {
    const mated = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(evalFen(mated, 'w')).toBe(WIN);
    expect(evalFen(mated, 'b')).toBe(-WIN);
  });

  it('returns the win value for a bare king and prefers faster wins', () => {
    const board = new Board('4k3/8/8/8/8/8/P7/4K3 w - - 0 1');
    expect(evaluate(board, 'b', 0)).toBe(WIN);
    expect(evaluate(board, 'w', 0)).toBe(-WIN);
    expect(evaluate(board, 'b', 3)).toBe(WIN - 3);
  });

  it('can value a defended exposed piece less than an undefended one', () => {
    // Black knight c6 attacks the d4 pawn; in the second position the c3 pawn defends it.
    const weights = { ...DEFAULT_WEIGHTS, exposedDefended: 0 };
    const undefended = evaluate(new Board('k7/8/2n5/8/3P4/8/8/4K3 w - - 0 1'), 'w', 0, weights);
    const undefendedNoPawn = evaluate(new Board('k7/8/7n/8/3P4/8/8/4K3 w - - 0 1'), 'w', 0, weights);
    const defended = evaluate(new Board('k7/8/2n5/8/3P4/2P5/8/4K3 w - - 0 1'), 'w', 0, weights);
    const defendedSafe = evaluate(new Board('k7/8/7n/8/3P4/2P5/8/4K3 w - - 0 1'), 'w', 0, weights);
    expect(undefended - undefendedNoPawn).toBeGreaterThan(defended - defendedSafe);
    // With the spec defaults, defence makes no difference to the exposure bonus.
    const specDefended = evalFen('k7/8/2n5/8/3P4/2P5/8/4K3 w - - 0 1', 'w') - evalFen('k7/8/7n/8/3P4/2P5/8/4K3 w - - 0 1', 'w');
    const specUndefended = evalFen('k7/8/2n5/8/3P4/8/8/4K3 w - - 0 1', 'w') - evalFen('k7/8/7n/8/3P4/8/8/4K3 w - - 0 1', 'w');
    expect(specDefended).toBe(specUndefended);
  });

  it('penalises blocked pawns when blockedPawn is set', () => {
    const weights = { ...DEFAULT_WEIGHTS, blockedPawn: 5 };
    // A black knight on d4 blocks white's d3 pawn; on a4 it blocks nothing and attacks nothing.
    const blocked = evaluate(new Board('k7/8/8/8/3n4/3P4/8/4K3 w - - 0 1'), 'w', 0, weights);
    const free = evaluate(new Board('k7/8/8/8/n7/3P4/8/4K3 w - - 0 1'), 'w', 0, weights);
    expect(free - blocked).toBe(5);
    // Mutually blocked pawns penalise both sides equally.
    const mutual = evaluate(new Board('k7/8/8/8/3p4/3P4/8/4K3 w - - 0 1'), 'w', 0, weights);
    const neither = evaluate(new Board('k7/8/8/8/p7/3P4/8/4K3 w - - 0 1'), 'w', 0, weights);
    expect(mutual).toBe(neither);
  });

  it('scores draws as zero', () => {
    expect(evalFen('8/8/8/8/8/7p/5k1P/7K w - - 0 1', 'w')).toBe(0);
  });
});
