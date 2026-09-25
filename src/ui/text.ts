import type { Color, GameResult, PieceType } from '../engine/types';

export const PIECE_NAMES: Record<PieceType, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

export const COLOR_NAMES: Record<Color, string> = { w: 'White', b: 'Black' };

export interface ResultText {
  outcome: 'win' | 'loss' | 'draw';
  title: string;
  detail: string;
}

export function describeResult(result: GameResult, player: Color): ResultText | null {
  if (result.status === 'ongoing') return null;
  if (result.status === 'draw') {
    const detail = {
      stalemate: 'Stalemate: the side to move has no legal moves but is not in check.',
      'threefold-repetition': 'The same position appeared three times.',
      'fifty-move-rule': '50 moves each with no capture and no pawn move.',
      'bare-kings': 'Only the two kings are left.',
    }[result.reason];
    return { outcome: 'draw', title: 'Draw', detail };
  }
  const playerWon = result.winner === player;
  if (result.reason === 'checkmated') {
    return playerWon
      ? { outcome: 'win', title: 'You win', detail: 'Your king was checkmated.' }
      : { outcome: 'loss', title: 'You lose', detail: "You checkmated the AI's king." };
  }
  return playerWon
    ? { outcome: 'win', title: 'You win', detail: 'You lost every piece except your king.' }
    : { outcome: 'loss', title: 'You lose', detail: 'The AI has only its king left.' };
}
