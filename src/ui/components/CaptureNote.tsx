import { useEffect } from 'react';
import type { Color, Square } from '../../engine/types';
import type { Nudge } from '../hooks/useGame';

/** How long the note stays up unless the player dismisses it or plays on. */
const SHOW_MS = 6000;

interface CaptureNoteProps {
  nudge: Nudge | null;
  /** The board's orientation, to tell which half the tapped square is in. */
  orientation: Color;
  onDismiss: () => void;
}

/** True when the square is drawn in the top half of the board. */
function inTopHalf(square: Square, orientation: Color): boolean {
  const rank = Number(square[1]);
  return orientation === 'w' ? rank >= 5 : rank <= 4;
}

/**
 * Pops up over the board when a move is refused because a capture is forced,
 * saying which piece has to capture and why. It sits in the half of the board
 * away from where the player tapped, and taps go through it to the board, so
 * the right move is never hidden behind it.
 */
export function CaptureNote({ nudge, orientation, onDismiss }: CaptureNoteProps) {
  useEffect(() => {
    if (!nudge) return;
    const timer = setTimeout(onDismiss, SHOW_MS);
    return () => clearTimeout(timer);
  }, [nudge, onDismiss]);

  if (!nudge) return null;
  const placement = inTopHalf(nudge.square, orientation) ? 'items-end' : 'items-start';
  return (
    <div className={`pointer-events-none absolute inset-0 z-30 flex justify-center p-3 ${placement}`}>
      <div
        key={nudge.id}
        role="alert"
        className="relative w-full max-w-sm animate-note rounded-xl border-2 border-must bg-page/95 p-4 pr-12 shadow-[0_18px_48px_-16px_rgba(20,10,40,0.6)]"
      >
        <p>
          <span className="inline-block rounded-md bg-must px-2 py-0.5 font-bold text-[#2b1a00]">{nudge.note.title}</span>
        </p>
        <p className="mt-2 text-[15px] leading-snug">{nudge.note.body}</p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="pointer-events-auto absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full text-muted outline-none hover:bg-surface hover:text-ink focus-visible:ring-3 focus-visible:ring-jade"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M5 5l10 10M15 5 5 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
