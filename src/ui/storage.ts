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

/** Who plays the other side: the engine, or a second person on the same device. */
export type Opponent = 'computer' | 'human';

export interface GameSettings {
  opponent: Opponent;
  /** The side at the bottom of the board. Against the computer, the side the person plays. */
  playerColor: Color;
  difficulty: Difficulty;
}

export interface SavedGame extends GameSettings {
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
  // Games saved before two-player mode were all against the computer.
  return { ...saved, opponent: saved.opponent === 'human' ? 'human' : 'computer' };
}

export function saveGame(game: SavedGame): void {
  write(GAME_KEY, game);
}
