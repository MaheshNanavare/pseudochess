import { useState } from 'react';
import type { Color, Difficulty } from '../../engine/types';
import { Button } from './Button';
import { Modal } from './Modal';
import { DifficultySelect } from './DifficultySelect';
import { resolveSide, SideSelect, type Side } from './SideSelect';

interface NewGameDialogProps {
  open: boolean;
  initialColor: Color;
  initialDifficulty: Difficulty;
  onCancel: () => void;
  onStart: (color: Color, difficulty: Difficulty) => void;
}

export function NewGameDialog({ open, initialColor, initialDifficulty, onCancel, onStart }: NewGameDialogProps) {
  const [side, setSide] = useState<Side>(initialColor);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);

  return (
    <Modal open={open} onClose={onCancel} labelledBy="new-game-title">
      <h2 id="new-game-title" className="text-2xl font-extrabold [font-stretch:85%]">New game</h2>
      <div className="mt-5 space-y-5">
        <SideSelect value={side} onChange={setSide} />
        <DifficultySelect value={difficulty} onChange={setDifficulty} />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={() => onStart(resolveSide(side), difficulty)}>Start game</Button>
      </div>
    </Modal>
  );
}
