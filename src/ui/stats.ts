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
 * Tips for this variant, shown one at a time on the results page, with the
 * opening, middlegame and endgame ones spread among the tactics. The phase
 * tips rest on engine self-play (thousands of games at depth 3 and 4):
 * - first moves: one-square pawn pushes scored 53% against 48% for two-square ones;
 * - 1.e3 a6?, a protected offer, scored 40% for Black;
 * - a side left holding the only queen in the endgame scored about 40%;
 * - every stalemate inspected left the stalemated side with only its king and
 *   blocked pawns, and most 50-move draws were pawn endings locked head-on;
 * - kings made 56% of endgame captures, and 41% of the captures that ended a game.
 * The ones that rest on a finer point of the rules are played out on real
 * positions in the tests, so they stay true if the rules change.
 */
export const TIPS: readonly string[] = [
  'Give away only unprotected pieces. If you guard the square, you must take back: a trade, not a gift.',
  'Opening: start with one-square pawn moves like e3. After a two-square push, their pawn can meet yours at once and you must capture.',
  'Forced to capture? Take with a piece they can take back, so you lose one in return.',
  'Middlegame: when no capture is forced, make an offer. A quiet move gives them a free turn to make you capture.',
  'Push a pawn so it and an enemy pawn attack each other. They move next, so they must take.',
  'Endgame: don’t let your last pawns get blocked. A blocked pawn can’t walk into a capture, so the game stalls into a draw.',
  'Knights are easy to give away: they reach squares other pieces cannot, so jump them next to enemy pieces.',
  'Opening: an early offer must be unprotected too. After 1.e3 a6?, Bxa6 forces you to take back.',
  'Chain your gifts: offer a piece where the taker lands attacking another of yours, so they must capture again.',
  'Middlegame: look behind a piece before moving it. Uncovering your own queen, rook or bishop onto theirs forces you to capture.',
  'Their king must capture too: put an unprotected piece next to it, and it has to take.',
  'Endgame: kings make most captures now. Keep yours away from their last pieces, or it will be forced to take them.',
  'Check with a piece they can capture, and they must take it: in check, only captures that end the check are allowed.',
  'Opening: plan to lose your queen early. Kept to the endgame, she is a burden they can feed piece after piece.',
  'En passant is forced too: push a pawn two squares to land beside an enemy pawn, and they must take it.',
  'Opening: develop pieces where their pawns can take them, the reverse of normal chess.',
  'Back-rank trap: with your king boxed in by its pawns, offer their rook a piece on your back rank. If it is their only capture, they must mate you.',
  'Promote to a piece that attacks none of theirs. A new queen they cannot take may force you to capture.',
];

/** The tip after `index`, back to the first after the last. */
export const nextTip = (index: number): number => (index + 1) % TIPS.length;
