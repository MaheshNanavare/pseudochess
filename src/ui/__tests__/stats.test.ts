import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../../engine/types';
import { outcomeFor, reasonText, shuffled, summarize, TIPS, winRate } from '../stats';
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
  it('shuffles into a different order without losing any', () => {
    const sequence = [0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8, 0.4, 0.6, 0.05, 0.95, 0.15, 0.85];
    let i = 0;
    const mixed = shuffled(TIPS, () => sequence[i++ % sequence.length]!);
    expect(mixed).not.toEqual(TIPS);
    expect([...mixed].sort()).toEqual([...TIPS].sort());
  });
});
