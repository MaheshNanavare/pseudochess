import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  wide?: boolean;
  /** Sits low on the screen with a clear backdrop, so a scene behind it stays in view. */
  overScene?: boolean;
}

const PLACEMENT = {
  centre: 'm-auto backdrop:bg-[#140f1f]/60 backdrop:backdrop-blur-[2px]',
  // Just clear of the heap of pieces at the foot of the loss scene.
  low: 'mx-auto mt-auto mb-[max(1.5rem,21dvh)] max-w-[94vw] backdrop:bg-transparent',
} as const;

function width(wide: boolean, overScene: boolean): string {
  if (overScene) return 'w-fit';
  return wide ? 'w-[min(94vw,40rem)]' : 'w-[min(94vw,26rem)]';
}

/** Native <dialog>: focus trapping, Escape to close and a backdrop for free. */
export function Modal({ open, onClose, labelledBy, children, wide = false, overScene = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`${PLACEMENT[overScene ? 'low' : 'centre']} max-h-[92dvh] ${width(wide, overScene)} overflow-y-auto rounded-xl border border-line bg-page p-0 text-ink shadow-[0_24px_64px_-24px_rgba(20,10,40,0.55)] open:animate-pop`}
    >
      <div className={overScene ? 'p-3 sm:p-4' : 'p-6 sm:p-7'}>{children}</div>
    </dialog>
  );
}
