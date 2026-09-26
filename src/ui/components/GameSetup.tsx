import type { Difficulty } from '../../engine/types';
import type { GameSettings, Opponent } from '../storage';
import { DifficultySelect } from './DifficultySelect';
import { Segmented } from './Segmented';
import { resolveSide, SideSelect, type Side } from './SideSelect';

/** The choices on a new-game form, before a random side is resolved. */
export interface SetupDraft {
  opponent: Opponent;
  side: Side;
  difficulty: Difficulty;
}

export function draftFrom(settings: GameSettings): SetupDraft {
  return { opponent: settings.opponent, side: settings.playerColor, difficulty: settings.difficulty };
}

/** Two players share one board with White at the bottom, so the side choice only applies against the computer. */
export function resolveSetup({ opponent, side, difficulty }: SetupDraft): GameSettings {
  return { opponent, playerColor: opponent === 'human' ? 'w' : resolveSide(side), difficulty };
}

interface GameSetupFieldsProps {
  value: SetupDraft;
  onChange: (value: SetupDraft) => void;
}

export function GameSetupFields({ value, onChange }: GameSetupFieldsProps) {
  return (
    <div className="space-y-5">
      <Segmented<Opponent>
        legend="Play against"
        name="opponent"
        value={value.opponent}
        onChange={(opponent) => onChange({ ...value, opponent })}
        options={[
          { value: 'computer', label: 'Computer' },
          { value: 'human', label: 'A friend' },
        ]}
      />
      {value.opponent === 'computer' ? (
        <>
          <SideSelect value={value.side} onChange={(side) => onChange({ ...value, side })} />
          <DifficultySelect value={value.difficulty} onChange={(difficulty) => onChange({ ...value, difficulty })} />
        </>
      ) : (
        <p className="text-sm text-muted">
          Take turns on this device. White moves first, from the bottom of the board. Each side still has to capture when it can.
        </p>
      )}
    </div>
  );
}
