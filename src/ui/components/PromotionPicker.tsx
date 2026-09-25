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
      <h2 id="promotion-title" className="text-2xl font-extrabold [font-stretch:85%]">
        Promote pawn to
      </h2>
      <p className="mt-1 text-sm text-muted">A new piece is one more thing to lose. Short-range pieces are easier to give away.</p>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {OPTIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChoose(p)}
            className="flex flex-col items-center rounded-lg bg-surface pt-2 pb-2.5 transition-colors outline-none hover:bg-line focus-visible:ring-3 focus-visible:ring-jade"
          >
            <Piece color={color} type={p} className="h-14 w-14" />
            <span className="text-sm font-semibold capitalize">{PIECE_NAMES[p]}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
