import { useEffect } from 'react';
import type { Notice } from '../hooks/useGame';

/** How long a notice stays up unless the player dismisses it or plays on. */
const SHOW_MS = 7000;

const BADGE = {
  must: 'bg-must text-[#2b1a00]',
  info: 'bg-surface text-ink',
} as const;

const BORDER = {
  must: 'border-must',
  info: 'border-line',
} as const;

interface GameNoticeProps {
  notice: Notice | null;
  onDismiss: () => void;
}

/**
 * A card beside the board (under the status line), never on it: why a move
 * was refused by the forced-capture rule, or the answer to a draw offer.
 */
export function GameNotice({ notice, onDismiss }: GameNoticeProps) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, SHOW_MS);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;
  return (
    <div
      key={notice.id}
      role="alert"
      className={`relative animate-note rounded-xl border-2 bg-page p-4 pr-12 shadow-[0_12px_32px_-16px_rgba(20,10,40,0.45)] ${BORDER[notice.tone]}`}
    >
      <p>
        <span className={`inline-block rounded-md px-2 py-0.5 font-bold ${BADGE[notice.tone]}`}>{notice.title}</span>
      </p>
      <p className="mt-2 text-[15px] leading-snug">{notice.body}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full text-muted outline-none hover:bg-surface hover:text-ink focus-visible:ring-3 focus-visible:ring-jade"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M5 5l10 10M15 5 5 15" />
        </svg>
      </button>
    </div>
  );
}
