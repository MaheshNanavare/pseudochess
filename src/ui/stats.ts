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
 * Tactics for this variant, shown one at a time on the results page, most
 * widely useful first. The ones that rest on a finer point of the rules
 * (en passant, king captures, check, checkmate winning) are played out on
 * real positions in the tests, so they stay true if the rules change.
 */
export const TIPS: readonly string[] = [
  'Only give away pieces that none of yours protect. If one of your pieces covers the square, you will be forced to take back, and your gift becomes a trade.',
  'Forced to capture? Pick the capture that lands your piece where they can take it back. They must recapture, so you lose a piece in return for the one you took.',
  'Push a pawn to where it and an enemy pawn attack each other. It looks like a threat, but they move next, so they are the ones forced to capture.',
  'Knights are easy to give away: jump them next to enemy pieces. They reach squares other pieces cannot, so the opponent often has to take.',
  'Chain your gifts: give a piece away where the capturing piece will land attacking another of yours. They have to capture again next turn, so one offer loses you two pieces.',
  'Their king has to capture too. Put a piece next to it that none of yours protect, and the king must take it. It cannot take a protected one, as that would walk into check.',
  'To get rid of one particular piece, such as your queen, give check with it from a square they can capture. In check, the only captures allowed are ones that end the check, so they have to take it.',
  'En passant is a capture, so it is forced too. Push a pawn two squares so it lands right beside an enemy pawn, and they have to take it en passant.',
  'Back-rank trap: with your king boxed in behind its pawns, leave a piece on your back rank where their rook or queen can take it. If that is their only capture, taking it is forced, and it checkmates you: you win.',
  'When you promote, choose the piece that attacks none of theirs. A new queen often hits several pieces at once, and if they cannot take her straight away, you will be the one forced to capture.',
];

/** The tip after `index`, back to the first after the last. */
export const nextTip = (index: number): number => (index + 1) % TIPS.length;
