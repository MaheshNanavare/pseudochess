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

/**
 * What to do next, shown low over the end-of-game scene. The scene already
 * shows the result in large type, so here it is only read out to screen
 * readers (the scene itself is hidden from them).
 */
export function GameOverDialog({ result, open, onClose, onPlayAgain, onHome }: GameOverDialogProps) {
  return (
    <Modal open={open && result !== null} onClose={onClose} labelledBy="game-over-title" overScene>
      {result && (
        <>
          <h2 id="game-over-title" className="sr-only">
            {result.title}
          </h2>
          <p className="sr-only">{result.detail}</p>
          <div className="flex flex-wrap justify-center gap-2">
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
