import type { Color, Difficulty, MoveInput } from '../engine/types';

/*
 * Local persistence. Every read and write is guarded: storage can be missing
 * or throw (private windows, blocked site data), and the app must still work.
 */

export type BoardTheme = 'dusk' | 'ocean' | 'forest' | 'desert' | 'arctic';

export interface Preferences {
  boardTheme: BoardTheme;
  sound: boolean;
  /** Show dots and corner marks on the squares a selected piece can reach. */
  hints: boolean;
}

export interface SavedGame {
  playerColor: Color;
  difficulty: Difficulty;
  moves: MoveInput[];
}

export const DEFAULT_PREFERENCES: Preferences = { boardTheme: 'dusk', sound: true, hints: true };

const PREFS_KEY = 'pseudochess.prefs';
const GAME_KEY = 'pseudochess.game';
const THEMES: BoardTheme[] = ['dusk', 'ocean', 'forest', 'desert', 'arctic'];

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: nothing is remembered, the game still works
  }
}

export function loadPreferences(): Preferences {
  const saved = read<Partial<Preferences>>(PREFS_KEY) ?? {};
  return {
    boardTheme: THEMES.includes(saved.boardTheme as BoardTheme) ? (saved.boardTheme as BoardTheme) : DEFAULT_PREFERENCES.boardTheme,
    sound: typeof saved.sound === 'boolean' ? saved.sound : DEFAULT_PREFERENCES.sound,
    hints: typeof saved.hints === 'boolean' ? saved.hints : DEFAULT_PREFERENCES.hints,
  };
}

export function savePreferences(prefs: Preferences): void {
  write(PREFS_KEY, prefs);
}

export function loadGame(): SavedGame | null {
  const saved = read<SavedGame>(GAME_KEY);
  if (!saved || !Array.isArray(saved.moves)) return null;
  if (saved.playerColor !== 'w' && saved.playerColor !== 'b') return null;
  if (!['easy', 'medium', 'hard'].includes(saved.difficulty)) return null;
  return saved;
}

export function saveGame(game: SavedGame): void {
  write(GAME_KEY, game);
}
