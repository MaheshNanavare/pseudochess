import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  wide?: boolean;
}

/** Native <dialog>: focus trapping, Escape to close and a backdrop for free. */
export function Modal({ open, onClose, labelledBy, children, wide = false }: ModalProps) {
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
      className={`m-auto max-h-[92dvh] ${wide ? 'w-[min(94vw,40rem)]' : 'w-[min(94vw,26rem)]'} overflow-y-auto rounded-xl border border-line bg-page p-0 text-ink shadow-[0_24px_64px_-24px_rgba(20,10,40,0.55)] backdrop:bg-[#140f1f]/60 backdrop:backdrop-blur-[2px] open:animate-pop`}
    >
      <div className="p-6 sm:p-7">{children}</div>
    </dialog>
  );
}
