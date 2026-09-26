import type { Difficulty } from '../engine/types';
import type { GameRecord } from './storage';

/** A finished game from the person's side. Two-player games have no single "you", so they are tallied by colour. */
export type Outcome = 'win' | 'loss' | 'draw';

export interface Tally {
  win: number;
  draw: number;
  loss: number;
}

export interface TwoPlayerTally {
  white: number;
  black: number;
  draw: number;
}

export interface Summary {
  total: number;
  /** Games against the computer, by level. */
  byLevel: Record<Difficulty, Tally>;
  twoPlayer: TwoPlayerTally;
}

export const LEVELS: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** How a game against the computer went for the person; null for two-player games. */
export function outcomeFor(record: GameRecord): Outcome | null {
  if (record.opponent === 'human') return null;
  if (record.result.status === 'draw') return 'draw';
  return record.result.winner === record.playerColor ? 'win' : 'loss';
}

export function summarize(history: GameRecord[]): Summary {
  const empty = (): Tally => ({ win: 0, draw: 0, loss: 0 });
  const summary: Summary = { total: history.length, byLevel: { easy: empty(), medium: empty(), hard: empty() }, twoPlayer: { white: 0, black: 0, draw: 0 } };
  for (const record of history) {
    const outcome = outcomeFor(record);
    if (outcome) summary.byLevel[record.difficulty][outcome]++;
    else if (record.result.status === 'draw') summary.twoPlayer.draw++;
    else summary.twoPlayer[record.result.winner === 'w' ? 'white' : 'black']++;
  }
  return summary;
}

/** Share of games won, as a whole percentage; null when there are none. */
export function winRate(tally: Tally): number | null {
  const games = tally.win + tally.draw + tally.loss;
  return games === 0 ? null : Math.round((tally.win / games) * 100);
}

/** Why a game ended, in a few words for the history list. */
export function reasonText(record: GameRecord): string {
  const r = record.result;
  if (r.status === 'draw') {
    return { stalemate: 'Stalemate', 'threefold-repetition': 'Repetition', 'fifty-move-rule': '50-move rule', 'bare-kings': 'Only kings left', agreement: 'Agreed draw' }[r.reason];
  }
  return { checkmated: 'King checkmated', 'bare-king': 'All pieces lost', resigned: 'Resigned' }[r.reason];
}

/**
 * Ways to win at this variant. They follow the engine's own strategy
 * (Docs/pseudochess-spec.md, section 3), so they are advice it would give.
 */
export const TIPS: readonly string[] = [
  'Give your pawns away first. They are slow and hard to put in danger, so leaving them until last makes the finish drag.',
  'Keep your queen away from enemy pieces. Whenever she can capture she must, and every capture lightens your opponent’s load, not yours.',
  'Long-range pieces are a liability. A rook or bishop on an open line can be forced into capture after capture.',
  'Before you move, look at what you will be able to take next turn. A careless move can hand you a forced capture you do not want.',
  'Put pieces where they can be taken. A piece sitting in front of an enemy pawn is a piece you are about to lose, which is what you want.',
  'Knights are easy to give away: jump them next to enemy pieces. They reach squares other pieces cannot, so the opponent often has to take.',
  'Do not checkmate your opponent. Delivering checkmate loses; getting your own king checkmated wins.',
  'Walk your king out late in the game. An exposed king is closer to being checkmated, which is a win for you.',
  'When your opponent is down to two or three pieces, stop threatening them. Capturing their last pieces hands them the win.',
  'Promote to a knight or a bishop. A new queen is one more long-range piece you will be forced to capture with.',
  'Force chains: offer a piece where taking it leaves the capturing piece exposed to one of yours. The opponent must take, and you set up the next gift.',
  'Count the rack under each board. It shows exactly how many pieces each side still has to lose.',
  'If you are behind, steer for a draw: repeating the position three times, or 50 moves with no capture and no pawn move, ends the game level.',
  'The gold outlines show which of your pieces must capture. When there is a choice, pick the capture that leaves your piece most exposed afterwards.',
];

/** A shuffled copy (Fisher-Yates). `random` is injectable for tests. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
