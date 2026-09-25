import type { Difficulty, MoveInput } from '../engine/types';

export interface AIRequest {
  id: number;
  startFen: string;
  /** Moves played since startFen, so the worker keeps repetition history. */
  moves: MoveInput[];
  difficulty: Difficulty;
}

export interface AIMove {
  move: MoveInput;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
}

export type AIResponse = ({ id: number; ok: true } & AIMove) | { id: number; ok: false; error: string };
