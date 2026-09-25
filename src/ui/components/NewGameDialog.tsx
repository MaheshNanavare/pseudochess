import { useState } from 'react';
import type { Color, Difficulty } from '../../engine/types';
import { Button } from './Button';
import { Modal } from './Modal';
import { pieceSrc } from './Piece';
import { DifficultySelect } from './DifficultySelect';
import { Segmented } from './Segmented';

type Side = Color | 'random';

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

  const start = () => {
    const color: Color = side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : side;
    onStart(color, difficulty);
  };

  return (
    <Modal open={open} onClose={onCancel} labelledBy="new-game-title">
      <h2 id="new-game-title" className="text-2xl font-extrabold [font-stretch:85%]">New game</h2>
      <div className="mt-5 space-y-5">
        <Segmented<Side>
          legend="Play as"
          name="side"
          value={side}
          onChange={setSide}
          options={[
            { value: 'w', label: <><img src={pieceSrc('w', 'k')} alt="" className="h-6 w-6" />White</> },
            { value: 'b', label: <><img src={pieceSrc('b', 'k')} alt="" className="h-6 w-6" />Black</> },
            { value: 'random', label: 'Random' },
          ]}
        />
        <DifficultySelect value={difficulty} onChange={setDifficulty} />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={start}>Start game</Button>
      </div>
    </Modal>
  );
}
