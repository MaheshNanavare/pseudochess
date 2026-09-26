import type { Preferences } from '../storage';

interface ToggleProps {
  on: boolean;
  label: string;
  onToggle: () => void;
  icon: 'music' | 'sound';
}

const ICONS = {
  // A beamed pair of notes.
  music: (
    <>
      <path d="M7.5 15V5.5l9-2V13" />
      <circle cx="5.5" cy="15" r="2" />
      <circle cx="14.5" cy="13" r="2" />
    </>
  ),
  // A speaker with sound waves.
  sound: (
    <>
      <path d="M3 8h3l4-3.5v11L6 12H3z" />
      <path d="M13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5a7 7 0 0 1 0 10" />
    </>
  ),
};

/** A round on/off button; muted shows the icon struck through. */
function AudioToggle({ on, label, onToggle, icon }: ToggleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={`${on ? 'Mute' : 'Unmute'} ${label.toLowerCase()}`}
      onClick={onToggle}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-jade focus-visible:ring-offset-2 focus-visible:ring-offset-page ${
        on ? 'bg-surface text-ink hover:bg-line' : 'bg-transparent text-muted ring-1 ring-line hover:text-ink'
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[icon]}
        {!on && <path d="M3 3l14 14" strokeWidth="2" />}
      </svg>
    </button>
  );
}

interface AudioTogglesProps {
  prefs: Preferences;
  onChange: (prefs: Preferences) => void;
  /** Sound effects (piece moves and captures) only play on the game screen. */
  showSound: boolean;
  className?: string;
}

/** Quick mute buttons for the music and, in a game, the sound effects. */
export function AudioToggles({ prefs, onChange, showSound, className = '' }: AudioTogglesProps) {
  return (
    <div role="group" aria-label="Audio" className={`flex gap-1.5 ${className}`}>
      <AudioToggle icon="music" label="Music" on={prefs.music} onToggle={() => onChange({ ...prefs, music: !prefs.music })} />
      {showSound && <AudioToggle icon="sound" label="Sound effects" on={prefs.sound} onToggle={() => onChange({ ...prefs, sound: !prefs.sound })} />}
    </div>
  );
}
