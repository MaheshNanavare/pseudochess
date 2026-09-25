import type { ResultText } from '../text';
import { Modal } from './Modal';

interface GameOverDialogProps {
  result: ResultText | null;
  open: boolean;
  onClose: () => void;
  onNewGame: () => void;
}

const TONE = {
  win: 'text-emerald-600 dark:text-emerald-400',
  loss: 'text-rose-600 dark:text-rose-400',
  draw: 'text-amber-600 dark:text-amber-400',
} as const;

export function GameOverDialog({ result, open, onClose, onNewGame }: GameOverDialogProps) {
  return (
    <Modal open={open && result !== null} onClose={onClose} labelledBy="game-over-title">
      {result && (
        <>
          <h2 id="game-over-title" className={`text-3xl font-bold ${TONE[result.outcome]}`}>{result.title}</h2>
          <p className="mt-2 text-stone-700 dark:text-stone-300">{result.detail}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 hover:bg-stone-200 dark:hover:bg-stone-700">
              View board
            </button>
            <button type="button" onClick={onNewGame} className="rounded-lg bg-stone-900 px-4 py-2 font-semibold text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900">
              New game
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
