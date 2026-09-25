import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../../engine/board';
import { getGameResult, legalMoves } from '../../engine/rules';
import {
  START_FEN,
  type Color,
  type Difficulty,
  type GameResult,
  type Move,
  type MoveInput,
  type Piece,
  type PromotionPiece,
  type Square,
} from '../../engine/types';
import { saveGame } from '../storage';
import { AICancelledError, useAI } from './useAI';

export interface GameSettings {
  playerColor: Color;
  difficulty: Difficulty;
}

export interface GameSnapshot {
  pieces: Piece[];
  turn: Color;
  legal: Move[];
  /** True when the side to move has at least one capture, so it must capture. */
  forced: boolean;
  result: GameResult;
  history: Move[];
  inCheck: boolean;
  kingSquare: Square | undefined;
}

function takeSnapshot(board: Board): GameSnapshot {
  const legal = legalMoves(board);
  const turn = board.sideToMove();
  const pieces = board.pieces();
  return {
    pieces,
    turn,
    legal,
    forced: legal.length > 0 && legal[0]!.captured !== undefined,
    result: getGameResult(board),
    history: board.history(),
    inCheck: board.inCheck(),
    kingSquare: pieces.find((p) => p.type === 'k' && p.color === turn)?.square,
  };
}

const toInput = ({ from, to, promotion }: Move): MoveInput => (promotion ? { from, to, promotion } : { from, to });

/** The AI never answers faster than this, so the player's own move can finish sliding. */
const MIN_THINK_MS = 450;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Replays saved moves; anything unexpected in storage just starts a fresh game. */
function restoreBoard(moves: MoveInput[]): Board {
  const board = new Board();
  try {
    for (const m of moves) board.make(m);
    return board;
  } catch {
    return new Board();
  }
}

export function useGame(initial: GameSettings, savedMoves: MoveInput[] = []) {
  const [restored] = useState(() => restoreBoard(savedMoves));
  const boardRef = useRef<Board>(restored);
  const [version, setVersion] = useState(0);
  const [settings, setSettings] = useState<GameSettings>(initial);
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const { thinking, requestMove, cancel } = useAI();

  // `version` is the change signal for the mutable board in boardRef.
  const snapshot = useMemo(() => takeSnapshot(boardRef.current), [version]);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const isPlayerTurn = snapshot.result.status === 'ongoing' && snapshot.turn === settings.playerColor;

  // Remember the game so closing the app does not lose it.
  useEffect(() => {
    saveGame({ ...settings, moves: snapshot.history.map(toInput) });
  }, [snapshot, settings]);

  // AI reply whenever it is the AI's turn.
  useEffect(() => {
    if (snapshot.result.status !== 'ongoing' || snapshot.turn === settings.playerColor) return;
    let active = true;
    Promise.all([requestMove(START_FEN, snapshot.history.map(toInput), settings.difficulty), wait(MIN_THINK_MS)])
      .then(([reply]) => {
        if (!active) return;
        boardRef.current.make(reply.move);
        bump();
      })
      .catch((err: unknown) => {
        if (!(err instanceof AICancelledError)) console.error(err);
      });
    return () => {
      active = false;
      cancel();
    };
  }, [snapshot, settings, requestMove, cancel, bump]);

  const play = useCallback(
    (move: MoveInput) => {
      boardRef.current.make(move);
      setSelected(null);
      setPendingPromotion(null);
      bump();
    },
    [bump],
  );

  const targets = useMemo(
    () => (selected ? snapshot.legal.filter((m) => m.from === selected) : []),
    [selected, snapshot],
  );

  const movable = useMemo(
    () => (isPlayerTurn ? new Set(snapshot.legal.map((m) => m.from)) : new Set<Square>()),
    [isPlayerTurn, snapshot],
  );

  const onSquareClick = useCallback(
    (square: Square) => {
      if (!isPlayerTurn || pendingPromotion) return;
      const matches = targets.filter((m) => m.to === square);
      if (selected && matches.length > 0) {
        if (matches.length > 1) setPendingPromotion({ from: selected, to: square });
        else play(toInput(matches[0]!));
        return;
      }
      if (movable.has(square) && square !== selected) setSelected(square);
      else setSelected(null);
    },
    [isPlayerTurn, pendingPromotion, targets, selected, movable, play],
  );

  /** Move by drag and drop. Returns false when the drop square is not a legal target. */
  const tryMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!isPlayerTurn || pendingPromotion) return false;
      const matches = snapshot.legal.filter((m) => m.from === from && m.to === to);
      if (matches.length === 0) return false;
      if (matches.length > 1) {
        setSelected(from);
        setPendingPromotion({ from, to });
      } else {
        play(toInput(matches[0]!));
      }
      return true;
    },
    [isPlayerTurn, pendingPromotion, snapshot, play],
  );

  /** Select a piece that can move (used when a drag starts). */
  const select = useCallback(
    (square: Square) => {
      if (isPlayerTurn && !pendingPromotion && movable.has(square)) setSelected(square);
    },
    [isPlayerTurn, pendingPromotion, movable],
  );

  const choosePromotion = useCallback(
    (piece: PromotionPiece | null) => {
      if (pendingPromotion && piece) play({ ...pendingPromotion, promotion: piece });
      else setPendingPromotion(null);
    },
    [pendingPromotion, play],
  );

  const newGame = useCallback(
    (next: Partial<GameSettings> = {}) => {
      cancel();
      boardRef.current = new Board();
      setSettings((s) => ({ ...s, ...next }));
      setSelected(null);
      setPendingPromotion(null);
      bump();
    },
    [cancel, bump],
  );

  const setDifficulty = useCallback((difficulty: Difficulty) => {
    setSettings((s) => ({ ...s, difficulty }));
  }, []);

  const canUndo = snapshot.history.some((m) => m.color === settings.playerColor);

  /** Take back the player's last move (and the AI reply after it, if any). */
  const undo = useCallback(() => {
    if (!canUndo) return;
    cancel();
    const board = boardRef.current;
    for (let m = board.undo(); m; m = board.undo()) {
      if (m.color === settings.playerColor) break;
    }
    setSelected(null);
    setPendingPromotion(null);
    bump();
  }, [canUndo, cancel, settings.playerColor, bump]);

  const lastMove = snapshot.history.at(-1);

  return {
    snapshot,
    settings,
    selected,
    targets,
    movable,
    lastMove,
    thinking,
    isPlayerTurn,
    pendingPromotion,
    canUndo,
    onSquareClick,
    tryMove,
    select,
    choosePromotion,
    newGame,
    setDifficulty,
    undo,
  };
}
