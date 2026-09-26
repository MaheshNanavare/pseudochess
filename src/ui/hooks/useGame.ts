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
import { explainForcedCapture, type Attempt, type ForcedCaptureNote } from '../forcedCapture';
import { saveGame, type GameSettings } from '../storage';
import { AICancelledError, useAI } from './useAI';

export interface GameSnapshot {
  pieces: Piece[];
  turn: Color;
  legal: Move[];
  /** True when the side to move has at least one capture, so it must capture. */
  forced: boolean;
  /** Legal moves under normal chess rules; only differs from `legal` when a capture is forced. */
  normal: Move[];
  result: GameResult;
  history: Move[];
  inCheck: boolean;
  kingSquare: Square | undefined;
}

/** A forced-capture explanation on screen; the id restarts its animation when it is shown again. */
export interface Nudge {
  id: number;
  note: ForcedCaptureNote;
  /** The square the player tapped or dropped on, so the note can stay clear of it. */
  square: Square;
}

function takeSnapshot(board: Board): GameSnapshot {
  const legal = legalMoves(board);
  const turn = board.sideToMove();
  const pieces = board.pieces();
  const forced = legal.length > 0 && legal[0]!.captured !== undefined;
  return {
    pieces,
    turn,
    legal,
    forced,
    normal: forced ? board.allLegalMoves() : legal,
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
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const { thinking, requestMove, cancel } = useAI();

  // `version` is the change signal for the mutable board in boardRef.
  const snapshot = useMemo(() => takeSnapshot(boardRef.current), [version]);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const twoPlayer = settings.opponent === 'human';
  const isPlayerTurn = snapshot.result.status === 'ongoing' && (twoPlayer || snapshot.turn === settings.playerColor);

  // Remember the game so closing the app does not lose it.
  useEffect(() => {
    saveGame({ ...settings, moves: snapshot.history.map(toInput) });
  }, [snapshot, settings]);

  // AI reply whenever it is the AI's turn.
  useEffect(() => {
    if (twoPlayer || snapshot.result.status !== 'ongoing' || snapshot.turn === settings.playerColor) return;
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
  }, [twoPlayer, snapshot, settings, requestMove, cancel, bump]);

  /** Shows why an attempt is refused, if the forced-capture rule is the reason. */
  const explain = useCallback(
    (attempt: Attempt): boolean => {
      const note = explainForcedCapture(attempt, snapshot.legal, snapshot.normal, snapshot.pieces);
      if (note) setNudge((prev) => ({ id: (prev?.id ?? 0) + 1, note, square: attempt.to ?? attempt.from }));
      return note !== null;
    },
    [snapshot],
  );

  const dismissNudge = useCallback(() => setNudge(null), []);

  const play = useCallback(
    (move: MoveInput) => {
      boardRef.current.make(move);
      setSelected(null);
      setPendingPromotion(null);
      setNudge(null);
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
      if (movable.has(square) && square !== selected) {
        setSelected(square);
        setNudge(null);
        return;
      }
      // Tapping one of your own pieces is a pick-up; anything else puts the selected piece down.
      const own = snapshot.pieces.some((p) => p.square === square && p.color === snapshot.turn);
      const putDown = selected !== null && !own;
      const explained = explain(putDown ? { from: selected, to: square } : { from: square });
      // A refused put-down keeps the piece in hand, so the right capture is one tap away.
      if (!(explained && putDown)) setSelected(null);
    },
    [isPlayerTurn, pendingPromotion, targets, selected, movable, snapshot, explain, play],
  );

  /** Move by drag and drop. Returns false when the drop square is not a legal target. */
  const tryMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!isPlayerTurn || pendingPromotion) return false;
      const matches = snapshot.legal.filter((m) => m.from === from && m.to === to);
      if (matches.length === 0) {
        explain({ from, to });
        return false;
      }
      if (matches.length > 1) {
        setSelected(from);
        setPendingPromotion({ from, to });
      } else {
        play(toInput(matches[0]!));
      }
      return true;
    },
    [isPlayerTurn, pendingPromotion, snapshot, explain, play],
  );

  /** Picks up a piece when a drag starts. Returns false when that piece cannot move. */
  const select = useCallback(
    (square: Square): boolean => {
      if (!isPlayerTurn || pendingPromotion) return false;
      if (!movable.has(square)) {
        explain({ from: square });
        return false;
      }
      setSelected(square);
      setNudge(null);
      return true;
    },
    [isPlayerTurn, pendingPromotion, movable, explain],
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
      setNudge(null);
      bump();
    },
    [cancel, bump],
  );

  const setDifficulty = useCallback((difficulty: Difficulty) => {
    setSettings((s) => ({ ...s, difficulty }));
  }, []);

  const canUndo = twoPlayer ? snapshot.history.length > 0 : snapshot.history.some((m) => m.color === settings.playerColor);

  /** Take back the last move. Against the computer: the player's last move and the reply after it. */
  const undo = useCallback(() => {
    if (!canUndo) return;
    cancel();
    const board = boardRef.current;
    if (twoPlayer) board.undo();
    else {
      for (let m = board.undo(); m; m = board.undo()) {
        if (m.color === settings.playerColor) break;
      }
    }
    setSelected(null);
    setPendingPromotion(null);
    setNudge(null);
    bump();
  }, [canUndo, cancel, twoPlayer, settings.playerColor, bump]);

  const lastMove = snapshot.history.at(-1);

  return {
    snapshot,
    settings,
    twoPlayer,
    selected,
    targets,
    movable,
    lastMove,
    thinking,
    isPlayerTurn,
    pendingPromotion,
    canUndo,
    nudge,
    dismissNudge,
    onSquareClick,
    tryMove,
    select,
    choosePromotion,
    newGame,
    setDifficulty,
    undo,
  };
}
