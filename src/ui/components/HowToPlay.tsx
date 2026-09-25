import { Modal } from './Modal';

interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

export function HowToPlay({ open, onClose }: HowToPlayProps) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="how-to-play-title">
      <h2 id="how-to-play-title" className="text-2xl font-bold">How to play</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
        <p>Normal chess board, pieces and moves. But the goal is turned upside down.</p>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">You win if</h3>
          <ul className="ml-5 list-disc">
            <li>your king gets checkmated, or</li>
            <li>you lose every piece except your king.</li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">You lose if</h3>
          <ul className="ml-5 list-disc">
            <li>you checkmate the other king, or</li>
            <li>the other side is left with only its king.</li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">Captures are forced</h3>
          <p>If you can capture, you must. If there are several captures, you pick one.</p>
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">Check still counts</h3>
          <p>When in check you must get out of check. If one way out is a capture, you must capture.</p>
        </div>
        <p>Pawns promote to a queen, rook, bishop or knight. Stalemate, threefold repetition and the 50-move rule are draws.</p>
      </div>
      <button type="button" onClick={onClose} className="mt-6 w-full rounded-lg bg-stone-900 py-2 font-semibold text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900">
        Got it
      </button>
    </Modal>
  );
}
