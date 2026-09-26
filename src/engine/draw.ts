import { GEN_CAPTURES, GEN_QUIETS, type Board } from './board';

/** How many plies ahead no capture may be possible for the computer to agree to a draw. */
export const DRAW_QUIET_PLIES = 2;

/**
 * The computer's answer to a draw offer (spec section 2, "Draw offers"): yes
 * only when kings and pawns alone are left and no capture can come up in the
 * next `plies` plies, whatever either side plays. The board is left unchanged.
 */
export function acceptsDrawOffer(board: Board, plies: number = DRAW_QUIET_PLIES): boolean {
  if (board.pieces().some((p) => p.type !== 'k' && p.type !== 'p')) return false;
  return noCaptureWithin(board, plies);
}

function noCaptureWithin(board: Board, plies: number): boolean {
  if (plies <= 0) return true;
  if (board.generateLegal(GEN_CAPTURES).length > 0) return false;
  for (const move of board.generateLegal(GEN_QUIETS)) {
    board.makeMove(move);
    const quiet = noCaptureWithin(board, plies - 1);
    board.unmakeMove();
    if (!quiet) return false;
  }
  return true;
}
