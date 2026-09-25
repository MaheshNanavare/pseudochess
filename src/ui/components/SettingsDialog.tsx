import type { BoardTheme, Preferences } from '../storage';
import { Button } from './Button';
import { Modal } from './Modal';

const THEMES: { value: BoardTheme; name: string; light: string; dark: string }[] = [
  { value: 'dusk', name: 'Dusk', light: '#e3dcef', dark: '#8a7db5' },
  { value: 'ocean', name: 'Ocean', light: '#bfe3e4', dark: '#2d8b8b' },
  { value: 'forest', name: 'Forest', light: '#e4e6d4', dark: '#7d8471' },
  { value: 'desert', name: 'Desert', light: '#e8d5c4', dark: '#b87d6d' },
  { value: 'arctic', name: 'Arctic', light: '#d4e4f7', dark: '#4a6fa5' },
];

interface SettingsDialogProps {
  open: boolean;
  prefs: Preferences;
  onChange: (prefs: Preferences) => void;
  onClose: () => void;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-jade peer-focus-visible:ring-3 peer-focus-visible:ring-jade peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-page after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-page after:shadow after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

export function SettingsDialog({ open, prefs, onChange, onClose }: SettingsDialogProps) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="settings-title">
      <h2 id="settings-title" className="text-2xl font-extrabold [font-stretch:85%]">
        Settings
      </h2>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-semibold text-muted">Board</legend>
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map((t) => (
            <label key={t.value} className="group flex cursor-pointer flex-col items-center gap-1.5">
              <input
                type="radio"
                name="board-theme"
                value={t.value}
                checked={prefs.boardTheme === t.value}
                onChange={() => onChange({ ...prefs, boardTheme: t.value })}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="grid h-12 w-12 grid-cols-2 grid-rows-2 overflow-hidden rounded-md ring-offset-2 ring-offset-page peer-checked:ring-3 peer-checked:ring-ink peer-focus-visible:ring-3 peer-focus-visible:ring-jade"
              >
                <span style={{ background: t.light }} />
                <span style={{ background: t.dark }} />
                <span style={{ background: t.dark }} />
                <span style={{ background: t.light }} />
              </span>
              <span className="text-xs text-muted peer-checked:font-bold peer-checked:text-ink">{t.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 divide-y divide-line border-y border-line">
        <Toggle label="Sound effects" checked={prefs.sound} onChange={(sound) => onChange({ ...prefs, sound })} />
        <Toggle label="Show where a piece can move" checked={prefs.hints} onChange={(hints) => onChange({ ...prefs, hints })} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <a href="privacy.html" className="text-sm text-muted underline underline-offset-2 hover:text-ink">
          Privacy policy
        </a>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
