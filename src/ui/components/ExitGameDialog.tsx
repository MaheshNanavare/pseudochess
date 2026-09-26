import { Button } from './Button';
import { Modal } from './Modal';

interface ExitGameDialogProps {
  open: boolean;
  /** Two players: who would be resigning ("White"); null against the computer, where it is you. */
  mover: string | null;
  onKeep: () => void;
  onResign: () => void;
  onCancel: () => void;
}

/** Leaving a game in progress: keep it to continue later, or resign it (recorded as a loss). */
export function ExitGameDialog({ open, mover, onKeep, onResign, onCancel }: ExitGameDialogProps) {
  const resignText = mover ? `Resigning ends the game as a win for the other side.` : 'Resigning ends the game and counts as a loss in your results.';
  return (
    <Modal open={open} onClose={onCancel} labelledBy="exit-title">
      <h2 id="exit-title" className="text-2xl font-extrabold [font-stretch:85%]">
        Leave this game?
      </h2>
      <p className="mt-2 leading-snug">Keep it and you can continue from the home screen. {resignText}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onResign} className="text-rose">
          {mover ? `Resign as ${mover}` : 'Resign'}
        </Button>
        <Button variant="primary" onClick={onKeep} autoFocus>
          Keep and go home
        </Button>
      </div>
    </Modal>
  );
}
