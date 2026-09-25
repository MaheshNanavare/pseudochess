import { Button } from './Button';
import { Modal } from './Modal';

interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

export function HowToPlay({ open, onClose }: HowToPlayProps) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="how-to-play-title" wide>
      <h2 id="how-to-play-title" className="text-3xl font-extrabold tracking-tight [font-stretch:80%]">
        How to play
      </h2>
      <p className="mt-2 max-w-prose text-[17px] leading-relaxed">
        Same board, same pieces, same moves as chess. The goal is turned upside down: get rid of your army.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border-l-4 border-jade bg-surface p-4">
          <h3 className="font-bold">You win when</h3>
          <ul className="mt-1.5 space-y-1 leading-snug">
            <li>your king gets checkmated, or</li>
            <li>you have lost every piece except your king.</li>
          </ul>
        </section>
        <section className="rounded-lg border-l-4 border-rose bg-surface p-4">
          <h3 className="font-bold">You lose when</h3>
          <ul className="mt-1.5 space-y-1 leading-snug">
            <li>you checkmate the other king, or</li>
            <li>the other side has only its king left.</li>
          </ul>
        </section>
      </div>

      <div className="mt-5 space-y-3 leading-relaxed">
        <p>
          <strong>If you can capture, you must.</strong> When several captures are possible, you choose which. Pieces that can
          capture are outlined in gold.
        </p>
        <p>
          <strong>Check works as usual.</strong> You must get out of check, and if one way out is a capture, you must take it.
        </p>
        <p className="text-muted">
          Pawns promote to a queen, rook, bishop or knight. Stalemate, threefold repetition and the 50-move rule are draws.
        </p>
      </div>

      <Button variant="primary" onClick={onClose} className="mt-6 w-full">
        Start playing
      </Button>
    </Modal>
  );
}
