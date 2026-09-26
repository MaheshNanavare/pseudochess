import { describe, expect, it } from 'vitest';
import { Board, getGameResult, legalMoves, type Difficulty, type Square } from '../../engine';
import { nextTip, outcomeFor, reasonText, summarize, TIPS, winRate } from '../stats';
import { addRecord, HISTORY_LIMIT, type FinishedResult, type GameRecord, type Opponent } from '../storage';

let n = 0;
function record(result: FinishedResult, opts: { opponent?: Opponent; difficulty?: Difficulty; playerColor?: 'w' | 'b' } = {}): GameRecord {
  n++;
  return { id: `g${n}`, endedAt: n, opponent: opts.opponent ?? 'computer', difficulty: opts.difficulty ?? 'medium', playerColor: opts.playerColor ?? 'w', result, plies: 40 };
}

const whiteWins: FinishedResult = { status: 'win', winner: 'w', reason: 'bare-king' };
const blackWins: FinishedResult = { status: 'win', winner: 'b', reason: 'checkmated' };
const draw: FinishedResult = { status: 'draw', reason: 'stalemate' };

describe('outcomeFor', () => {
  it('reads the result from the person’s side against the computer', () => {
    expect(outcomeFor(record(whiteWins, { playerColor: 'w' }))).toBe('win');
    expect(outcomeFor(record(whiteWins, { playerColor: 'b' }))).toBe('loss');
    expect(outcomeFor(record(draw))).toBe('draw');
  });

  it('has no single side for two-player games', () => {
    expect(outcomeFor(record(whiteWins, { opponent: 'human' }))).toBeNull();
  });
});

describe('summarize', () => {
  it('tallies computer games by level and two-player games by colour', () => {
    const history = [
      record(whiteWins, { difficulty: 'easy' }),
      record(blackWins, { difficulty: 'easy' }),
      record(draw, { difficulty: 'hard' }),
      record(blackWins, { opponent: 'human' }),
      record(draw, { opponent: 'human' }),
    ];
    const s = summarize(history);
    expect(s.total).toBe(5);
    expect(s.byLevel.easy).toEqual({ win: 1, draw: 0, loss: 1 });
    expect(s.byLevel.medium).toEqual({ win: 0, draw: 0, loss: 0 });
    expect(s.byLevel.hard).toEqual({ win: 0, draw: 1, loss: 0 });
    expect(s.twoPlayer).toEqual({ white: 0, black: 1, draw: 1 });
  });
});

describe('winRate', () => {
  it('is a whole percentage, or null with no games', () => {
    expect(winRate({ win: 1, draw: 1, loss: 1 })).toBe(33);
    expect(winRate({ win: 0, draw: 0, loss: 0 })).toBeNull();
  });
});

describe('reasonText', () => {
  it('names why a game ended', () => {
    expect(reasonText(record({ status: 'win', winner: 'b', reason: 'resigned' }))).toBe('Resigned');
    expect(reasonText(record({ status: 'draw', reason: 'agreement' }))).toBe('Agreed draw');
  });
});

describe('addRecord', () => {
  it('puts the newest game first', () => {
    const a = record(whiteWins);
    const b = record(draw);
    expect(addRecord(addRecord([], a), b).map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it('records a game once: its first result stands', () => {
    const first = record(whiteWins);
    const again = { ...first, result: draw };
    expect(addRecord([first], again)).toEqual([first]);
  });

  it(`keeps only the latest ${HISTORY_LIMIT} games`, () => {
    let history: GameRecord[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) history = addRecord(history, record(draw));
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history.at(-1)!.id).toBe(`g${n - HISTORY_LIMIT + 1}`);
  });
});

describe('tips', () => {
  it('has ten different tips, stepped through in a loop', () => {
    expect(TIPS).toHaveLength(10);
    expect(new Set(TIPS).size).toBe(TIPS.length);
    expect(nextTip(0)).toBe(1);
    expect(nextTip(TIPS.length - 1)).toBe(0);
  });
});

/** The tips that rest on a finer point of the rules, played out by the engine. */
describe('tips hold under the rules', () => {
  const sans = (board: Board): string[] => legalMoves(board).map((m) => m.san).sort();
  const play = (board: Board, uci: string): void => {
    board.make({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square });
  };

  it('back-rank trap: their only capture checkmates you, and you win', () => {
    const board = new Board('4r1k1/5ppp/8/8/8/3N4/5PPP/6K1 w - - 0 1');
    play(board, 'd3e1');
    expect(sans(board)).toEqual(['Rxe1#']);
    play(board, 'e8e1');
    expect(getGameResult(board)).toEqual({ status: 'win', winner: 'w', reason: 'checkmated' });
  });

  it('en passant is a forced capture', () => {
    const board = new Board('4k3/8/8/8/3p4/8/4P2P/4K3 w - - 0 1');
    play(board, 'e2e4');
    expect(sans(board)).toEqual(['dxe3']);
  });

  it('their king must take an unprotected piece next to it, but cannot take a protected one', () => {
    expect(sans(new Board('4k3/3N3p/8/8/8/8/7P/4K3 b - - 0 1'))).toEqual(['Kxd7']);
    // The b5 bishop protects d7.
    const guarded = legalMoves(new Board('4k3/3N3p/8/1B6/8/8/7P/4K3 b - - 0 1'));
    expect(guarded.some((m) => m.captured !== undefined)).toBe(false);
  });

  it('in check, the only captures allowed are ones that end the check', () => {
    // axb4 is on offer, but the e5 rook gives check, so dxe5 is the only move.
    expect(sans(new Board('4k3/8/3p4/p3R3/1P6/8/8/4K3 b - - 0 1'))).toEqual(['dxe5']);
  });
});
