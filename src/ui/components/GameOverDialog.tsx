import type { ResultText } from '../text';
import { Button } from './Button';
import { Modal } from './Modal';

interface GameOverDialogProps {
  result: ResultText | null;
  open: boolean;
  onClose: () => void;
  onPlayAgain: () => void;
  onHome: () => void;
}

const TONE = {
  win: 'text-jade',
  loss: 'text-rose',
  draw: 'text-muted',
} as const;

export function GameOverDialog({ result, open, onClose, onPlayAgain, onHome }: GameOverDialogProps) {
  return (
    <Modal open={open && result !== null} onClose={onClose} labelledBy="game-over-title">
      {result && (
        <>
          <h2 id="game-over-title" className={`text-5xl font-extrabold tracking-tight [font-stretch:75%] ${TONE[result.outcome]}`}>
            {result.title}
          </h2>
          <p className="mt-3 text-lg leading-snug">{result.detail}</p>
          <div className="mt-7 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              See the board
            </Button>
            <Button onClick={onHome}>Home</Button>
            <Button variant="primary" onClick={onPlayAgain} autoFocus>
              Play again
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
