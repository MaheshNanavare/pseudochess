import type { ResultText } from '../text';

interface StatusLineProps {
  result: ResultText | null;
  isPlayerTurn: boolean;
  forced: boolean;
  inCheck: boolean;
}

const RESULT_TONE = { win: 'text-jade', loss: 'text-rose', draw: '' } as const;

/** One sentence that always says what happens next. Announced to screen readers. */
export function StatusLine({ result, isPlayerTurn, forced, inCheck }: StatusLineProps) {
  let body;
  if (result) {
    body = (
      <p>
        <strong className={RESULT_TONE[result.outcome]}>{result.title}.</strong> {result.detail}
      </p>
    );
  } else if (!isPlayerTurn) {
    body = (
      <p className="text-muted">
        Computer is thinking<span className="animate-think">…</span>
      </p>
    );
  } else if (forced) {
    body = (
      <p>
        <span className="mr-2 inline-block rounded-md bg-must px-2 py-0.5 font-bold text-[#2b1a00]">You must capture</span>
        {inCheck ? 'You are in check, and a capture gets you out.' : 'Pick one of the gold-outlined pieces.'}
      </p>
    );
  } else if (inCheck) {
    body = (
      <p>
        <strong className="text-rose">You are in check.</strong> Move out of it.
      </p>
    );
  } else {
    body = <p>Your move.</p>;
  }

  return (
    <div id="status" aria-live="polite" className="min-h-12 text-[17px] leading-snug">
      {body}
    </div>
  );
}
