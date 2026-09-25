import type { Difficulty } from '../../engine/types';

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

interface DifficultySelectProps {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
}

export function DifficultySelect({ value, onChange }: DifficultySelectProps) {
  return (
    <fieldset className="flex rounded-lg bg-stone-200 p-1 dark:bg-stone-800">
      <legend className="sr-only">Difficulty</legend>
      {LEVELS.map((level) => (
        <label
          key={level}
          className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-sm capitalize has-focus-visible:ring-2 has-focus-visible:ring-sky-400 ${
            value === level ? 'bg-white font-semibold shadow dark:bg-stone-600' : 'text-stone-600 dark:text-stone-400'
          }`}
        >
          <input type="radio" name="difficulty" value={level} checked={value === level} onChange={() => onChange(level)} className="sr-only" />
          {level}
        </label>
      ))}
    </fieldset>
  );
}
