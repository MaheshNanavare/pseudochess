import type { Difficulty } from '../../engine/types';
import { Segmented } from './Segmented';

export const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  easy: 'Looks a few moves ahead and sometimes picks a weaker move.',
  medium: 'Looks four moves ahead and always plays its best move.',
  hard: 'Searches deeper, as far as it can in about two seconds.',
};

interface DifficultySelectProps {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
}

export function DifficultySelect({ value, onChange }: DifficultySelectProps) {
  return (
    <div>
      <Segmented<Difficulty>
        legend="Computer"
        name="difficulty"
        value={value}
        onChange={onChange}
        options={[
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' },
        ]}
      />
      <p className="mt-2 min-h-10 text-sm text-muted">{DIFFICULTY_TEXT[value]}</p>
    </div>
  );
}
