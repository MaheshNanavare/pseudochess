import type { Color, PromotionPiece } from '../../engine/types';
import { PIECE_NAMES } from '../text';
import { Modal } from './Modal';
import { Piece } from './Piece';

const OPTIONS: PromotionPiece[] = ['q', 'r', 'b', 'n'];

interface PromotionPickerProps {
  open: boolean;
  color: Color;
  onChoose: (piece: PromotionPiece | null) => void;
}

export function PromotionPicker({ open, color, onChoose }: PromotionPickerProps) {
  return (
    <Modal open={open} onClose={() => onChoose(null)} labelledBy="promotion-title">
      <h2 id="promotion-title" className="text-lg font-semibold">Promote pawn to</h2>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {OPTIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChoose(p)}
            className="flex flex-col items-center rounded-xl bg-stone-200 p-2 hover:bg-stone-300 focus-visible:ring-4 focus-visible:ring-sky-400 focus-visible:outline-none dark:bg-stone-700 dark:hover:bg-stone-600"
          >
            <Piece color={color} type={p} className="h-14 w-14" />
            <span className="text-sm capitalize">{PIECE_NAMES[p]}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
