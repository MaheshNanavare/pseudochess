import { useState } from 'react';
import type { GameSettings } from '../storage';
import { Button } from './Button';
import { draftFrom, GameSetupFields, resolveSetup, type SetupDraft } from './GameSetup';
import { Modal } from './Modal';

interface NewGameDialogProps {
  open: boolean;
  initial: GameSettings;
  onCancel: () => void;
  onStart: (settings: GameSettings) => void;
}

export function NewGameDialog({ open, initial, onCancel, onStart }: NewGameDialogProps) {
  const [draft, setDraft] = useState<SetupDraft>(() => draftFrom(initial));

  return (
    <Modal open={open} onClose={onCancel} labelledBy="new-game-title">
      <h2 id="new-game-title" className="text-2xl font-extrabold [font-stretch:85%]">New game</h2>
      <div className="mt-5">
        <GameSetupFields value={draft} onChange={setDraft} />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={() => onStart(resolveSetup(draft))}>Start game</Button>
      </div>
    </Modal>
  );
}
