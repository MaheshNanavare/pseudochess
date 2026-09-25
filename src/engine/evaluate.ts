import {
  BISHOP_DIRS,
  BLACK,
  KING,
  KING_OFFSETS,
  KNIGHT,
  KNIGHT_OFFSETS,
  PAWN,
  ROOK_DIRS,
  BISHOP,
  ROOK,
  QUEEN,
  WHITE,
  type Board,
} from './board';
import { opponentOf, type Color, type PieceType } from './types';

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
  /** Exposure bonus when the exposed piece is also defended (a capture leads to a forced recapture). */
  exposedDefended: number;
  forcedCapture: number;
  /** Forced-capture risk per attacked enemy piece that is defended (my capturer gets recaptured). */
  forcedCaptureDefended: number;
  /** Penalty per own pawn blocked by the piece directly in front of it. */
  blockedPawn: number;
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
  exposedDefended: 2,
  forcedCapture: 1,
  forcedCaptureDefended: 1,
  blockedPawn: 0,
  endgameDanger: 20,
  endgameThreshold: 2,
};

/** Scores at or beyond this magnitude are decided games. */
export const WIN_THRESHOLD = DEFAULT_WEIGHTS.win - 1000;

/** Per-type weight tables indexed by piece type code (1..6). */
interface Tables {
  cost: Int32Array;
  reach: Int32Array;
}
const tableCache = new WeakMap<EvalWeights, Tables>();
const TYPE_ORDER: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];

export function weightTables(w: EvalWeights): Tables {
  let t = tableCache.get(w);
  if (!t) {
    const cost = new Int32Array(7);
    const reach = new Int32Array(7);
    TYPE_ORDER.forEach((type, i) => {
      cost[i + 1] = w.remainingCost[type];
      reach[i + 1] = w.captureReach[type];
    });
    t = { cost, reach };
    tableCache.set(w, t);
  }
  return t;
}

/**
 * Terminal states from `me`'s point of view, or null if the game goes on.
 * `legalCount` (forced-capture legal move count) may be passed to avoid
 * generating moves twice.
 */
export function terminalScore(
  board: Board,
  me: Color,
  ply: number,
  weights: EvalWeights = DEFAULT_WEIGHTS,
  legalCount?: number,
): number | null {
  if (board.nonKingCount(me) === 0) return weights.win - ply;
  if (board.nonKingCount(opponentOf(me)) === 0) return -weights.win + ply;

  const count = legalCount ?? board.forcedMoves().length;
  if (count === 0) {
    if (board.inCheck()) return board.sideToMove() === me ? weights.win - ply : -weights.win + ply;
    return weights.draw;
  }
  if (board.isThreefoldRepetition()) return weights.draw;
  if (board.halfmoveClock() >= 100) return weights.draw;
  return null;
}

// Scratch buffers reused by every call (evaluation runs many thousands of times per move).
const exposed = new Uint8Array(128);
const defended = new Uint8Array(128);
const targetsFree = new Int32Array(128);
const targetsDefended = new Int32Array(128);
const pairFrom = new Int16Array(1024);
const pairTo = new Int16Array(1024);

/**
 * One pass over the board building the attack map used by the exposure and
 * forced-capture terms: `exposed[sq]` = the non-king piece on sq is attacked
 * by the enemy, `defended[sq]` = it is protected by its own side, and
 * `targetsFree/targetsDefended[sq]` = how many undefended/defended enemy
 * non-king pieces the piece on sq attacks.
 */
function buildAttackMap(s: Int8Array): void {
  exposed.fill(0);
  defended.fill(0);
  targetsFree.fill(0);
  targetsDefended.fill(0);
  let pairs = 0;

  const touch = (from: number, t: number, color: number): void => {
    const q = s[t]!;
    if (!q || (q & 7) === KING) return;
    if ((q & BLACK) === color) {
      defended[t] = 1;
    } else {
      exposed[t] = 1;
      pairFrom[pairs] = from;
      pairTo[pairs] = t;
      pairs++;
    }
  };

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = s[sq]!;
    if (!p) continue;
    const color = p & BLACK;
    const type = p & 7;

    if (type === PAWN) {
      const fwd = color === WHITE ? 16 : -16;
      if (!((sq + fwd - 1) & 0x88)) touch(sq, sq + fwd - 1, color);
      if (!((sq + fwd + 1) & 0x88)) touch(sq, sq + fwd + 1, color);
    } else if (type === KNIGHT || type === KING) {
      const offsets = type === KNIGHT ? KNIGHT_OFFSETS : KING_OFFSETS;
      for (const o of offsets) {
        if (!((sq + o) & 0x88)) touch(sq, sq + o, color);
      }
    } else {
      const diag = type === BISHOP || type === QUEEN;
      const straight = type === ROOK || type === QUEEN;
      for (let i = 0; i < 8; i++) {
        if ((i < 4 && !diag) || (i >= 4 && !straight)) continue;
        const d = i < 4 ? BISHOP_DIRS[i]! : ROOK_DIRS[i - 4]!;
        for (let t = sq + d; !(t & 0x88); t += d) {
          if (!s[t]) continue;
          touch(sq, t, color);
          break;
        }
      }
    }
  }

  for (let i = 0; i < pairs; i++) {
    if (defended[pairTo[i]!]) targetsDefended[pairFrom[i]!]!++;
    else targetsFree[pairFrom[i]!]!++;
  }
}

/** Static (non-terminal) score from `me`'s point of view (spec 3.4 to 3.7). */
export function staticScore(board: Board, me: Color, w: EvalWeights = DEFAULT_WEIGHTS): number {
  const { cost, reach } = weightTables(w);
  const s = board.squares;
  buildAttackMap(s);
  const whiteLeft = board.nonKing[0]!;
  const blackLeft = board.nonKing[1]!;

  let white = 0;
  let black = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = s[sq]!;
    if (!p) continue;
    const isWhite = (p & BLACK) === WHITE;
    const type = p & 7;

    // Material: every piece still on the board costs its owner.
    let good = -cost[type]!;

    // Pawn progress, capped so the engine does not race to promote.
    if (type === PAWN) {
      const moved = isWhite ? (sq >> 4) - 1 : 6 - (sq >> 4);
      good += Math.min(moved, w.pawnAdvanceCap) * w.pawnAdvance;
    }

    // Exposure: being capturable is good (less so if a capture forces my recapture).
    if (type !== KING && exposed[sq]) good += (defended[sq] ? w.exposedDefended : w.exposed) * cost[type]!;

    // Forced-capture risk: being able to capture is bad, worse near a bare-king opponent.
    const free = targetsFree[sq]!;
    const guarded = targetsDefended[sq]!;
    if (free || guarded) {
      let risk = reach[type]! * (free * w.forcedCapture + guarded * w.forcedCaptureDefended);
      if ((isWhite ? blackLeft : whiteLeft) <= w.endgameThreshold) risk += (free + guarded) * w.endgameDanger;
      good -= risk;
    }

    // Blocked pawns cannot walk into danger, so they are the hardest pieces to shed.
    if (type === PAWN && w.blockedPawn && s[sq + (isWhite ? 16 : -16)]) good -= w.blockedPawn;

    if (isWhite) white += good;
    else black += good;
  }
  return me === 'w' ? white - black : black - white;
}

/** Full evaluation (spec section 3.2): terminal states override everything. */
export function evaluate(
  board: Board,
  me: Color,
  ply: number,
  weights: EvalWeights = DEFAULT_WEIGHTS,
  legalCount?: number,
): number {
  const t = terminalScore(board, me, ply, weights, legalCount);
  if (t !== null) return t;
  return staticScore(board, me, weights);
}
