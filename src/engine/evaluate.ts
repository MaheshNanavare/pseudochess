import type { Board } from './board';
import { onlyKingLeft } from './rules';
import { opponentOf, type Color, type Move, type Piece, type PieceType, type Square } from './types';

/** All tunable weights live here (spec section 3.1). */
export interface EvalWeights {
  win: number;
  draw: number;
  /** Cost of a piece still being on my side. Higher = shed it sooner. */
  remainingCost: Record<PieceType, number>;
  /** Damage a piece can do to the opponent if it is forced to capture. */
  captureReach: Record<PieceType, number>;
  pawnAdvance: number;
  pawnAdvanceCap: number;
  exposed: number;
  forcedCapture: number;
  endgameDanger: number;
  /** Endgame danger applies when the opponent has this many non-king pieces or fewer. */
  endgameThreshold: number;
}

export const DEFAULT_WEIGHTS: EvalWeights = {
  win: 100000,
  draw: 0,
  remainingCost: { p: 8, n: 5, b: 5, r: 3, q: 1, k: 0 },
  captureReach: { p: 1, n: 2, b: 3, r: 4, q: 6, k: 1 },
  pawnAdvance: 1,
  pawnAdvanceCap: 4,
  exposed: 2,
  forcedCapture: 1,
  endgameDanger: 20,
  endgameThreshold: 2,
};

/** Scores at or beyond this magnitude are decided games. */
export const WIN_THRESHOLD = DEFAULT_WEIGHTS.win - 1000;

/**
 * Terminal states from `me`'s point of view, or null if the game goes on.
 * `legal` may be passed in to avoid generating moves twice.
 */
export function terminalScore(
  board: Board,
  me: Color,
  ply: number,
  weights: EvalWeights = DEFAULT_WEIGHTS,
  legal?: Move[],
): number | null {
  const opp = opponentOf(me);
  if (onlyKingLeft(board, me)) return weights.win - ply;
  if (onlyKingLeft(board, opp)) return -weights.win + ply;

  const side = board.sideToMove();
  const moves = legal ?? board.allLegalMoves();
  if (moves.length === 0) {
    if (board.inCheck()) return side === me ? weights.win - ply : -weights.win + ply;
    return weights.draw;
  }
  if (board.isThreefoldRepetition()) return weights.draw;
  if (board.halfmoveClock() >= 100) return weights.draw;
  return null;
}

interface AttackInfo {
  /** Non-king pieces that the opponent attacks. */
  exposed: Set<Square>;
  /** For each attacking square, how many enemy non-king pieces it attacks. */
  targets: Map<Square, number>;
}

/** One pass over the board, reused by exposure and forced-capture terms. */
function buildAttackInfo(board: Board, pieces: Piece[]): AttackInfo {
  const exposed = new Set<Square>();
  const targets = new Map<Square, number>();
  for (const piece of pieces) {
    if (piece.type === 'k') continue;
    const attackers = board.attackers(piece.square, opponentOf(piece.color));
    if (attackers.length === 0) continue;
    exposed.add(piece.square);
    for (const sq of attackers) targets.set(sq, (targets.get(sq) ?? 0) + 1);
  }
  return { exposed, targets };
}

function rankOf(square: Square): number {
  return Number(square[1]);
}

function materialGood(pieces: Piece[], w: EvalWeights): number {
  let total = 0;
  for (const p of pieces) total -= w.remainingCost[p.type];
  return total;
}

function pawnAdvanceGood(pieces: Piece[], side: Color, w: EvalWeights): number {
  let total = 0;
  for (const p of pieces) {
    if (p.type !== 'p') continue;
    const moved = side === 'w' ? rankOf(p.square) - 2 : 7 - rankOf(p.square);
    total += Math.min(moved, w.pawnAdvanceCap) * w.pawnAdvance;
  }
  return total;
}

function exposureGood(pieces: Piece[], info: AttackInfo, w: EvalWeights): number {
  let total = 0;
  for (const p of pieces) {
    if (p.type !== 'k' && info.exposed.has(p.square)) total += w.exposed * w.remainingCost[p.type];
  }
  return total;
}

function forcedCaptureGood(pieces: Piece[], oppLeft: number, info: AttackInfo, w: EvalWeights): number {
  let total = 0;
  for (const p of pieces) {
    const targets = info.targets.get(p.square) ?? 0;
    if (targets === 0) continue;
    let risk = targets * w.captureReach[p.type] * w.forcedCapture;
    if (oppLeft <= w.endgameThreshold) risk += targets * w.endgameDanger;
    total -= risk;
  }
  return total;
}

/** Static (non-terminal) score from `me`'s point of view. */
export function staticScore(board: Board, me: Color, weights: EvalWeights = DEFAULT_WEIGHTS): number {
  const opp = opponentOf(me);
  const all = board.pieces();
  const mine = all.filter((p) => p.color === me);
  const theirs = all.filter((p) => p.color === opp);
  const info = buildAttackInfo(board, all);
  const myLeft = mine.length - 1;
  const oppLeft = theirs.length - 1;

  return (
    materialGood(mine, weights) - materialGood(theirs, weights) +
    pawnAdvanceGood(mine, me, weights) - pawnAdvanceGood(theirs, opp, weights) +
    exposureGood(mine, info, weights) - exposureGood(theirs, info, weights) +
    forcedCaptureGood(mine, oppLeft, info, weights) - forcedCaptureGood(theirs, myLeft, info, weights)
  );
}

/** Full evaluation (spec section 3.2): terminal states override everything. */
export function evaluate(
  board: Board,
  me: Color,
  ply: number,
  weights: EvalWeights = DEFAULT_WEIGHTS,
  legal?: Move[],
): number {
  const t = terminalScore(board, me, ply, weights, legal);
  if (t !== null) return t;
  return staticScore(board, me, weights);
}
