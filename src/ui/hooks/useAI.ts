import { useCallback, useEffect, useRef, useState } from 'react';
import type { Difficulty, MoveInput } from '../../engine/types';
import type { AIMove, AIRequest, AIResponse } from '../../worker/protocol';

interface Pending {
  id: number;
  resolve: (move: AIMove) => void;
  reject: (err: Error) => void;
}

export class AICancelledError extends Error {
  constructor() {
    super('AI request cancelled');
    this.name = 'AICancelledError';
  }
}

function createWorker(): Worker {
  return new Worker(new URL('../../worker/ai.worker.ts', import.meta.url), { type: 'module' });
}

/** Runs the engine in a Web Worker so the board never freezes. */
export function useAI() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const nextId = useRef(1);
  const [thinking, setThinking] = useState(false);

  const handleMessage = useCallback((event: MessageEvent<AIResponse>) => {
    const pending = pendingRef.current;
    const data = event.data;
    if (!pending || pending.id !== data.id) return; // stale reply
    pendingRef.current = null;
    setThinking(false);
    if (data.ok) pending.resolve(data);
    else pending.reject(new Error(data.error));
  }, []);

  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      workerRef.current = createWorker();
      workerRef.current.onmessage = handleMessage;
    }
    return workerRef.current;
  }, [handleMessage]);

  /** Stop any running search. The worker is recreated on the next request. */
  const cancel = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    setThinking(false);
    pending.reject(new AICancelledError());
  }, []);

  const requestMove = useCallback(
    (startFen: string, moves: MoveInput[], difficulty: Difficulty): Promise<AIMove> => {
      cancel();
      const id = nextId.current++;
      const request: AIRequest = { id, startFen, moves, difficulty };
      return new Promise<AIMove>((resolve, reject) => {
        pendingRef.current = { id, resolve, reject };
        setThinking(true);
        getWorker().postMessage(request);
      });
    },
    [cancel, getWorker],
  );

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  return { thinking, requestMove, cancel };
}
