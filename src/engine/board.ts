import { Chess, type Move as ChessJsMove } from 'chess.js';
import {
  START_FEN,
  type Color,
  type Move,
  type MoveInput,
  type Piece,
  type PromotionPiece,
  type Square,
} from './types';

function toMove(m: ChessJsMove): Move {
  const move: Move = {
    from: m.from as Square,
    to: m.to as Square,
    color: m.color,
    piece: m.piece,
    san: m.san,
  };
  if (m.captured) move.captured = m.captured;
  if (m.promotion) move.promotion = m.promotion as PromotionPiece;
  return move;
}

/**
 * Thin wrapper around chess.js. All other engine code must go through this
 * class so the move generator can be swapped without touching rules/search.
 */
export class Board {
  private chess: Chess;

  constructor(fen: string = START_FEN) {
    this.chess = new Chess(fen);
  }

  load(fen: string): void {
    this.chess.load(fen);
  }

  fen(): string {
    return this.chess.fen();
  }

  sideToMove(): Color {
    return this.chess.turn();
  }

  /** Every move that is legal under normal chess rules (no forced capture filter). */
  allLegalMoves(): Move[] {
    return this.chess.moves({ verbose: true }).map(toMove);
  }

  make(move: MoveInput): Move {
    return toMove(this.chess.move({ from: move.from, to: move.to, promotion: move.promotion }));
  }

  undo(): Move | null {
    const m = this.chess.undo();
    return m ? toMove(m) : null;
  }

  inCheck(): boolean {
    return this.chess.inCheck();
  }

  isThreefoldRepetition(): boolean {
    return this.chess.isThreefoldRepetition();
  }

  halfmoveClock(): number {
    return Number(this.chess.fen().split(' ')[4] ?? 0);
  }

  pieceAt(square: Square): Piece | undefined {
    const p = this.chess.get(square);
    return p ? { color: p.color, type: p.type, square } : undefined;
  }

  pieces(color?: Color): Piece[] {
    const out: Piece[] = [];
    for (const row of this.chess.board()) {
      for (const cell of row) {
        if (cell && (color === undefined || cell.color === color)) {
          out.push({ color: cell.color, type: cell.type, square: cell.square as Square });
        }
      }
    }
    return out;
  }

  isAttacked(square: Square, by: Color): boolean {
    return this.chess.isAttacked(square, by);
  }

  attackers(square: Square, by: Color): Square[] {
    return this.chess.attackers(square, by) as Square[];
  }

  history(): Move[] {
    return this.chess.history({ verbose: true }).map(toMove);
  }
}
