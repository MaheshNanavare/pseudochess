export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${File}${Rank}`;

export interface Piece {
  color: Color;
  type: PieceType;
  square: Square;
}

/** What a caller needs to specify to play a move. */
export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

/** A fully described legal move. */
export interface Move extends MoveInput {
  color: Color;
  piece: PieceType;
  captured?: PieceType;
  san: string;
}

export type WinReason = 'checkmated' | 'bare-king';
/** 'agreement' never comes from the position: the players (or the computer) agreed to it. */
export type DrawReason = 'stalemate' | 'threefold-repetition' | 'fifty-move-rule' | 'bare-kings' | 'agreement';

export type GameResult =
  | { status: 'ongoing' }
  | { status: 'win'; winner: Color; reason: WinReason }
  | { status: 'draw'; reason: DrawReason };

export type Difficulty = 'easy' | 'medium' | 'hard';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function opponentOf(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}
