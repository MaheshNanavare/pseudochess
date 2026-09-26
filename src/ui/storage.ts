import type { Color, Difficulty, MoveInput } from '../engine/types';

/*
 * Local persistence. Every read and write is guarded: storage can be missing
 * or throw (private windows, blocked site data), and the app must still work.
 */

export type BoardTheme = 'dusk' | 'ocean' | 'forest' | 'desert' | 'arctic';

export interface Preferences {
  boardTheme: BoardTheme;
  sound: boolean;
  /** Background music on the home and game screens. */
  music: boolean;
  /** Show dots and corner marks on the squares a selected piece can reach. */
  hints: boolean;
  /** Play the move for you when it is the only legal one. */
  autoMove: boolean;
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
  /** The game ended in a draw by agreement after these moves. */
  drawAgreed: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { boardTheme: 'dusk', sound: true, music: true, hints: true, autoMove: false };

const PREFS_KEY = 'pseudochess.prefs';
const GAME_KEY = 'pseudochess.game';
const THEMES: BoardTheme[] = ['dusk', 'ocean', 'forest', 'desert', 'arctic'];
const FLAGS = ['sound', 'music', 'hints', 'autoMove'] as const;

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
  const prefs: Preferences = {
    ...DEFAULT_PREFERENCES,
    boardTheme: THEMES.includes(saved.boardTheme as BoardTheme) ? (saved.boardTheme as BoardTheme) : DEFAULT_PREFERENCES.boardTheme,
  };
  for (const flag of FLAGS) if (typeof saved[flag] === 'boolean') prefs[flag] = saved[flag];
  return prefs;
}

export function savePreferences(prefs: Preferences): void {
  write(PREFS_KEY, prefs);
}

export function loadGame(): SavedGame | null {
  const saved = read<Partial<SavedGame>>(GAME_KEY);
  if (!saved || !Array.isArray(saved.moves)) return null;
  if (saved.playerColor !== 'w' && saved.playerColor !== 'b') return null;
  if (!saved.difficulty || !['easy', 'medium', 'hard'].includes(saved.difficulty)) return null;
  return {
    moves: saved.moves,
    playerColor: saved.playerColor,
    difficulty: saved.difficulty,
    // Games saved before two-player mode and draw offers existed were ongoing computer games.
    opponent: saved.opponent === 'human' ? 'human' : 'computer',
    drawAgreed: saved.drawAgreed === true,
  };
}

export function saveGame(game: SavedGame): void {
  write(GAME_KEY, game);
}
