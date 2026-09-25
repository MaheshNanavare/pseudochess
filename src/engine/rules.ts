import { GEN_CAPTURES, type Board } from './board';
import type { Color, GameResult, Move } from './types';

/**
 * Forced-capture legality (spec section 1): if any legal move captures,
 * only captures may be played. Each promotion option is a separate move.
 */
export function legalMoves(board: Board): Move[] {
  const codes = board.forcedMoves();
  // When captures are forced every rival move to the same square is also a
  // capture, so the filtered list is enough for SAN disambiguation.
  return codes.map((m) => board.toMove(m, codes));
}

export function hasForcedCapture(board: Board): boolean {
  return board.generateLegal(GEN_CAPTURES).length > 0;
}

export function onlyKingLeft(board: Board, color: Color): boolean {
  return board.nonKingCount(color) === 0;
}

/**
 * Reverse win conditions: a side that is checkmated WINS, and a side left
 * with only its king WINS. Stalemate, threefold repetition and the 50-move
 * rule are draws.
 */
export function getGameResult(board: Board): GameResult {
  const whiteBare = onlyKingLeft(board, 'w');
  const blackBare = onlyKingLeft(board, 'b');
  if (whiteBare && blackBare) return { status: 'draw', reason: 'bare-kings' };
  if (whiteBare) return { status: 'win', winner: 'w', reason: 'bare-king' };
  if (blackBare) return { status: 'win', winner: 'b', reason: 'bare-king' };

  if (board.forcedMoves().length === 0) {
    return board.inCheck()
      ? { status: 'win', winner: board.sideToMove(), reason: 'checkmated' }
      : { status: 'draw', reason: 'stalemate' };
  }
  if (board.isThreefoldRepetition()) return { status: 'draw', reason: 'threefold-repetition' };
  if (board.halfmoveClock() >= 100) return { status: 'draw', reason: 'fifty-move-rule' };
  return { status: 'ongoing' };
}
