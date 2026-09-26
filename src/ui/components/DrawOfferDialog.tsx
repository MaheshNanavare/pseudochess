import type { Color } from '../../engine/types';
import { opponentOf } from '../../engine/types';
import { COLOR_NAMES } from '../text';
import { Button } from './Button';
import { Modal } from './Modal';

interface DrawOfferDialogProps {
  /** The colour that offered the draw; null when no offer is waiting. */
  offeredBy: Color | null;
  onAnswer: (accept: boolean) => void;
}

/** Two players: hands the device to the other player to accept or decline a draw. */
export function DrawOfferDialog({ offeredBy, onAnswer }: DrawOfferDialogProps) {
  return (
    <Modal open={offeredBy !== null} onClose={() => onAnswer(false)} labelledBy="draw-offer-title">
      {offeredBy && (
        <>
          <h2 id="draw-offer-title" className="text-2xl font-extrabold [font-stretch:85%]">
            {COLOR_NAMES[offeredBy]} offers a draw
          </h2>
          <p className="mt-2 text-lg leading-snug">{COLOR_NAMES[opponentOf(offeredBy)]}, do you accept? If you do, the game ends in a draw.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onAnswer(false)}>
              Decline
            </Button>
            <Button variant="primary" onClick={() => onAnswer(true)}>
              Accept draw
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
