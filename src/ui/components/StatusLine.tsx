import type { ResultText } from '../text';

interface StatusLineProps {
  result: ResultText | null;
  /** The computer is choosing its move. */
  waiting: boolean;
  /** Who is to move in a two-player game ("White" or "Black"); null against the computer, where it is "you". */
  mover: string | null;
  forced: boolean;
  inCheck: boolean;
}

const RESULT_TONE = { win: 'text-jade', loss: 'text-rose', draw: '' } as const;

/** One sentence that always says what happens next. Announced to screen readers. */
export function StatusLine({ result, waiting, mover, forced, inCheck }: StatusLineProps) {
  let body;
  if (result) {
    body = (
      <p>
        <strong className={RESULT_TONE[result.outcome]}>{result.title}.</strong> {result.detail}
      </p>
    );
  } else if (waiting) {
    body = (
      <p className="text-muted">
        Computer is thinking<span className="animate-think">…</span>
      </p>
    );
  } else if (forced) {
    body = (
      <p>
        <span className="mr-2 inline-block rounded-md bg-must px-2 py-0.5 font-bold text-[#2b1a00]">{mover ?? 'You'} must capture</span>
        {inCheck ? `${mover ? `${mover} is` : 'You are'} in check, and a capture gets out of it.` : 'Pick one of the gold-outlined pieces.'}
      </p>
    );
  } else if (inCheck) {
    body = (
      <p>
        <strong className="text-rose">{mover ? `${mover} is` : 'You are'} in check.</strong> Move out of it.
      </p>
    );
  } else {
    body = <p>{mover ? `${mover} to move.` : 'Your move.'}</p>;
  }

  return (
    <div id="status" aria-live="polite" className="min-h-12 text-[17px] leading-snug">
      {body}
    </div>
  );
}
