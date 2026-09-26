import type { Color, Move, Piece, PieceType } from '../engine/types';

const ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p'];
const byValue = (a: PieceType, b: PieceType) => ORDER.indexOf(a) - ORDER.indexOf(b);

/** The pieces of `color` that were captured during the game: what that side managed to give away. */
export function shedPieces(history: Move[], color: Color): PieceType[] {
  return history.filter((m) => m.color !== color && m.captured !== undefined).map((m) => m.captured!).sort(byValue);
}

/** The pieces of `color` still on the board, apart from the king: what that side is stuck with. */
export function heldPieces(pieces: Piece[], color: Color): PieceType[] {
  return pieces.filter((p) => p.color === color && p.type !== 'k').map((p) => p.type).sort(byValue);
}

/**
 * Pads a short list by repeating it, so a scene always has enough pieces to
 * read as a moment (a quick checkmate may have shed only one or two).
 */
export function atLeast(types: PieceType[], count: number, fallback: PieceType): PieceType[] {
  const source = types.length > 0 ? types : [fallback];
  const out = [...types];
  for (let i = 0; out.length < count; i++) out.push(source[i % source.length]!);
  return out;
}
