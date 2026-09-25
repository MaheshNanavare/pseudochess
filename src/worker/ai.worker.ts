/// <reference lib="webworker" />
import { Board } from '../engine/board';
import { findBestMove } from '../engine/search';
import type { AIRequest, AIResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<AIRequest>) => {
  const { id, startFen, moves, difficulty } = event.data;
  let response: AIResponse;
  try {
    const board = new Board(startFen);
    for (const m of moves) board.make(m);
    const result = findBestMove(board, difficulty);
    const { from, to, promotion } = result.move;
    response = {
      id,
      ok: true,
      move: promotion ? { from, to, promotion } : { from, to },
      score: result.score,
      depth: result.depth,
      nodes: result.nodes,
      timeMs: result.timeMs,
    };
  } catch (err) {
    response = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(response);
};
