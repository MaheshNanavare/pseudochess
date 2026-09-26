import type { Move, Piece, Square } from '../engine/types';
import { PIECE_NAMES } from './text';

/** A short explanation shown when a move is refused because a capture is forced. */
export interface ForcedCaptureNote {
  title: string;
  body: string;
}

/** What the player tried: picking up a piece, or also putting it down somewhere. */
export interface Attempt {
  from: Square;
  to?: Square;
}

function list(items: string[], last: 'and' | 'or'): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${last} ${items.at(-1)}`;
}

const pieceOn = (square: Square, pieces: Piece[]): string => {
  const piece = pieces.find((p) => p.square === square);
  return piece ? `${PIECE_NAMES[piece.type]} on ${square}` : square;
};

const unique = (squares: Square[]): Square[] => [...new Set(squares)];

/**
 * Explains why an attempt breaks the forced-capture rule, or returns null when
 * it does not (no capture is forced, the move is legal, or it would not be a
 * move in normal chess either, like tapping a far-away square to deselect).
 *
 * @param legal Legal moves under the variant rules (only captures when one exists).
 * @param normal Legal moves under normal chess rules, captures and quiet moves alike.
 */
export function explainForcedCapture(attempt: Attempt, legal: Move[], normal: Move[], pieces: Piece[]): ForcedCaptureNote | null {
  const forced = legal.length > 0 && legal[0]!.captured !== undefined;
  const piece = pieces.find((p) => p.square === attempt.from);
  if (!forced || !piece || piece.color !== legal[0]!.color) return null;

  const title = 'You must capture';
  const capturers = unique(legal.map((m) => m.from));

  if (!capturers.includes(attempt.from)) {
    const who = list(capturers.map((sq) => pieceOn(sq, pieces)), 'and');
    const which = capturers.length > 1 ? 'one of them' : 'it';
    return {
      title,
      body: `Your ${who} can take a piece, so you have to capture with ${which}. Your ${PIECE_NAMES[piece.type]} on ${attempt.from} has to wait.`,
    };
  }

  const to = attempt.to;
  if (!to || legal.some((m) => m.from === attempt.from && m.to === to)) return null;
  if (!normal.some((m) => m.from === attempt.from && m.to === to)) return null;

  const victims = unique(legal.filter((m) => m.from === attempt.from).map((m) => m.to));
  return {
    title,
    body: `Your ${pieceOn(attempt.from, pieces)} can take the ${list(victims.map((sq) => pieceOn(sq, pieces)), 'or')}, so it can't move to ${to} instead. Captures can't be skipped.`,
  };
}
