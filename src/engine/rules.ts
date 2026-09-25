import type { Board } from './board';
import type { Color, GameResult, Move } from './types';

/**
 * Forced-capture legality (spec section 1): if any legal move captures,
 * only captures may be played. Each promotion option is a separate move.
 */
export function legalMoves(board: Board): Move[] {
  return filterForcedCaptures(board.allLegalMoves());
}

export function filterForcedCaptures(moves: Move[]): Move[] {
  const captures = moves.filter((m) => m.captured !== undefined);
  return captures.length > 0 ? captures : moves;
}

export function hasForcedCapture(board: Board): boolean {
  return board.allLegalMoves().some((m) => m.captured !== undefined);
}

export function onlyKingLeft(board: Board, color: Color): boolean {
  return board.pieces(color).every((p) => p.type === 'k');
}

/**
 * Reverse win conditions: a side that is checkmated WINS, and a side left
 * with only its king WINS. Stalemate, threefold repetition and the 50-move
 * rule are draws. chess.js game-over logic is deliberately not used.
 */
export function getGameResult(board: Board): GameResult {
  const whiteBare = onlyKingLeft(board, 'w');
  const blackBare = onlyKingLeft(board, 'b');
  if (whiteBare && blackBare) return { status: 'draw', reason: 'bare-kings' };
  if (whiteBare) return { status: 'win', winner: 'w', reason: 'bare-king' };
  if (blackBare) return { status: 'win', winner: 'b', reason: 'bare-king' };

  const side = board.sideToMove();
  if (board.allLegalMoves().length === 0) {
    return board.inCheck()
      ? { status: 'win', winner: side, reason: 'checkmated' }
      : { status: 'draw', reason: 'stalemate' };
  }
  if (board.isThreefoldRepetition()) return { status: 'draw', reason: 'threefold-repetition' };
  if (board.halfmoveClock() >= 100) return { status: 'draw', reason: 'fifty-move-rule' };
  return { status: 'ongoing' };
}
