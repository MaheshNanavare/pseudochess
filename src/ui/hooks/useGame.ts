import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../../engine/board';
import { acceptsDrawOffer } from '../../engine/draw';
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
import { explainForcedCapture, type Attempt } from '../forcedCapture';
import { saveGame, type GameSettings, type SavedGame } from '../storage';
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

/**
 * A short message beside the board. 'must' explains a move refused by the
 * forced-capture rule; 'info' is anything else. The id restarts its animation.
 */
export interface Notice {
  id: number;
  tone: 'must' | 'info';
  title: string;
  body: string;
}

export type DrawOfferOutcome = 'accepted' | 'declined' | 'asked';

const AGREED_DRAW: GameResult = { status: 'draw', reason: 'agreement' };

function takeSnapshot(board: Board, drawAgreed: boolean): GameSnapshot {
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
    result: drawAgreed ? AGREED_DRAW : getGameResult(board),
    history: board.history(),
    inCheck: board.inCheck(),
    kingSquare: pieces.find((p) => p.type === 'k' && p.color === turn)?.square,
  };
}

const toInput = ({ from, to, promotion }: Move): MoveInput => (promotion ? { from, to, promotion } : { from, to });

/** The AI never answers faster than this, so the player's own move can finish sliding. */
const MIN_THINK_MS = 450;
/** How long the only legal move shows as picked up before it is played for you. */
const AUTO_MOVE_MS = 650;
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

type SavedPlay = Pick<SavedGame, 'moves' | 'drawAgreed'>;

/**
 * @param autoMove Play the only legal move for the person to move. Pass false
 *   while the board is not on screen, so nothing is played unseen.
 */
export function useGame(initial: GameSettings, saved: SavedPlay | null, autoMove: boolean) {
  const [restored] = useState(() => restoreBoard(saved?.moves ?? []));
  const boardRef = useRef<Board>(restored);
  const [version, setVersion] = useState(0);
  const [settings, setSettings] = useState<GameSettings>(initial);
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [drawAgreed, setDrawAgreed] = useState(saved?.drawAgreed === true && saved.moves.length > 0);
  /** Two players: the colour whose draw offer is waiting for an answer. */
  const [drawOffer, setDrawOffer] = useState<Color | null>(null);
  /** History length at the last declined offer; no new offer until a move is played. */
  const [declinedAt, setDeclinedAt] = useState<number | null>(null);
  /** History length right after an undo; the only-move autoplay waits, or undo could never step back past it. */
  const [undoneAt, setUndoneAt] = useState<number | null>(null);
  const { thinking, requestMove, cancel } = useAI();

  // `version` is the change signal for the mutable board in boardRef.
  const snapshot = useMemo(() => takeSnapshot(boardRef.current, drawAgreed), [version, drawAgreed]);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const twoPlayer = settings.opponent === 'human';
  const ongoing = snapshot.result.status === 'ongoing';
  const isPlayerTurn = ongoing && drawOffer === null && (twoPlayer || snapshot.turn === settings.playerColor);

  // Remember the game so closing the app does not lose it.
  useEffect(() => {
    saveGame({ ...settings, moves: snapshot.history.map(toInput), drawAgreed });
  }, [snapshot, settings, drawAgreed]);

  // AI reply whenever it is the AI's turn.
  useEffect(() => {
    if (twoPlayer || !ongoing || snapshot.turn === settings.playerColor) return;
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
  }, [twoPlayer, ongoing, snapshot, settings, requestMove, cancel, bump]);

  const showNotice = useCallback((tone: Notice['tone'], title: string, body: string) => {
    setNotice((prev) => ({ id: (prev?.id ?? 0) + 1, tone, title, body }));
  }, []);

  /** Shows why an attempt is refused, if the forced-capture rule is the reason. */
  const explain = useCallback(
    (attempt: Attempt): boolean => {
      const note = explainForcedCapture(attempt, snapshot.legal, snapshot.normal, snapshot.pieces);
      if (note) showNotice('must', note.title, note.body);
      return note !== null;
    },
    [snapshot, showNotice],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);

  /** Clears everything tied to the position that is about to change. */
  const resetTransient = useCallback(() => {
    setSelected(null);
    setPendingPromotion(null);
    setNotice(null);
    setDrawOffer(null);
  }, []);

  const play = useCallback(
    (move: MoveInput) => {
      boardRef.current.make(move);
      resetTransient();
      bump();
    },
    [resetTransient, bump],
  );

  const targets = useMemo(
    () => (selected ? snapshot.legal.filter((m) => m.from === selected) : []),
    [selected, snapshot],
  );

  const movable = useMemo(
    () => (isPlayerTurn ? new Set(snapshot.legal.map((m) => m.from)) : new Set<Square>()),
    [isPlayerTurn, snapshot],
  );

  // The only legal move: show it picked up for a moment, then play it.
  const onlyMove = snapshot.legal.length === 1 ? snapshot.legal[0]! : null;
  const autoMoving = autoMove && isPlayerTurn && onlyMove !== null && !pendingPromotion && undoneAt !== snapshot.history.length;
  useEffect(() => {
    if (!autoMoving || !onlyMove) return;
    setSelected(onlyMove.from);
    const timer = setTimeout(() => play(toInput(onlyMove)), AUTO_MOVE_MS);
    return () => clearTimeout(timer);
  }, [autoMoving, onlyMove, play]);

  const onSquareClick = useCallback(
    (square: Square) => {
      if (!isPlayerTurn || pendingPromotion || autoMoving) return;
      const matches = targets.filter((m) => m.to === square);
      if (selected && matches.length > 0) {
        if (matches.length > 1) setPendingPromotion({ from: selected, to: square });
        else play(toInput(matches[0]!));
        return;
      }
      if (movable.has(square) && square !== selected) {
        setSelected(square);
        setNotice(null);
        return;
      }
      // Tapping one of your own pieces is a pick-up; anything else puts the selected piece down.
      const own = snapshot.pieces.some((p) => p.square === square && p.color === snapshot.turn);
      const putDown = selected !== null && !own;
      const explained = explain(putDown ? { from: selected, to: square } : { from: square });
      // A refused put-down keeps the piece in hand, so the right capture is one tap away.
      if (!(explained && putDown)) setSelected(null);
    },
    [isPlayerTurn, pendingPromotion, autoMoving, targets, selected, movable, snapshot, explain, play],
  );

  /** Move by drag and drop. Returns false when the drop square is not a legal target. */
  const tryMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!isPlayerTurn || pendingPromotion || autoMoving) return false;
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
    [isPlayerTurn, pendingPromotion, autoMoving, snapshot, explain, play],
  );

  /** Picks up a piece when a drag starts. Returns false when that piece cannot move. */
  const select = useCallback(
    (square: Square): boolean => {
      if (!isPlayerTurn || pendingPromotion || autoMoving) return false;
      if (!movable.has(square)) {
        explain({ from: square });
        return false;
      }
      setSelected(square);
      setNotice(null);
      return true;
    },
    [isPlayerTurn, pendingPromotion, autoMoving, movable, explain],
  );

  const choosePromotion = useCallback(
    (piece: PromotionPiece | null) => {
      if (pendingPromotion && piece) play({ ...pendingPromotion, promotion: piece });
      else setPendingPromotion(null);
    },
    [pendingPromotion, play],
  );

  const canOfferDraw = isPlayerTurn && !autoMoving && declinedAt !== snapshot.history.length;

  /**
   * Offers a draw on your turn. The computer answers at once (engine rule);
   * in a two-player game the offer waits for answerDraw.
   */
  const offerDraw = useCallback((): DrawOfferOutcome | null => {
    if (!canOfferDraw) return null;
    resetTransient();
    if (twoPlayer) {
      setDrawOffer(snapshot.turn);
      return 'asked';
    }
    if (acceptsDrawOffer(boardRef.current)) {
      setDrawAgreed(true);
      return 'accepted';
    }
    setDeclinedAt(snapshot.history.length);
    showNotice(
      'info',
      'Draw declined',
      'The computer only agrees to a draw when just kings and pawns are left and no capture can come up in the next two moves.',
    );
    return 'declined';
  }, [canOfferDraw, twoPlayer, snapshot, resetTransient, showNotice]);

  /** The other player's answer to a two-player draw offer. */
  const answerDraw = useCallback(
    (accept: boolean) => {
      if (drawOffer === null) return;
      setDrawOffer(null);
      if (accept) setDrawAgreed(true);
      else setDeclinedAt(snapshot.history.length);
    },
    [drawOffer, snapshot],
  );

  const newGame = useCallback(
    (next: Partial<GameSettings> = {}) => {
      cancel();
      boardRef.current = new Board();
      setSettings((s) => ({ ...s, ...next }));
      setDrawAgreed(false);
      setDeclinedAt(null);
      setUndoneAt(null);
      resetTransient();
      bump();
    },
    [cancel, resetTransient, bump],
  );

  const setDifficulty = useCallback((difficulty: Difficulty) => {
    setSettings((s) => ({ ...s, difficulty }));
  }, []);

  const canUndo = twoPlayer ? snapshot.history.length > 0 : snapshot.history.some((m) => m.color === settings.playerColor);

  /** Take back the last move (and a draw agreed after it). Against the computer: the player's last move and the reply after it. */
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
    setDrawAgreed(false);
    setUndoneAt(board.history().length);
    resetTransient();
    bump();
  }, [canUndo, cancel, twoPlayer, settings.playerColor, resetTransient, bump]);

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
    autoMoving,
    pendingPromotion,
    canUndo,
    notice,
    dismissNotice,
    canOfferDraw,
    drawOffer,
    offerDraw,
    answerDraw,
    onSquareClick,
    tryMove,
    select,
    choosePromotion,
    newGame,
    setDifficulty,
    undo,
  };
}
