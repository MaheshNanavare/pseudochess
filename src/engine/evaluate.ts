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
const targets = new Int32Array(128);
const exposed = new Uint8Array(128);

/**
 * One pass over the board building the attack map used by the exposure and
 * forced-capture terms: `exposed[sq]` = non-king piece on sq is attacked by
 * the enemy, `targets[sq]` = number of enemy non-king pieces the piece on sq attacks.
 */
function buildAttackMap(s: Int8Array): void {
  targets.fill(0);
  exposed.fill(0);
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = s[sq]!;
    if (!p) continue;
    const color = p & BLACK;
    const type = p & 7;
    let hits = 0;

    if (type === PAWN) {
      const fwd = color === WHITE ? 16 : -16;
      for (let k = -1; k <= 1; k += 2) {
        const t = sq + fwd + k;
        if (t & 0x88) continue;
        const q = s[t]!;
        if (q && (q & BLACK) !== color && (q & 7) !== KING) {
          hits++;
          exposed[t] = 1;
        }
      }
    } else if (type === KNIGHT || type === KING) {
      const offsets = type === KNIGHT ? KNIGHT_OFFSETS : KING_OFFSETS;
      for (const o of offsets) {
        const t = sq + o;
        if (t & 0x88) continue;
        const q = s[t]!;
        if (q && (q & BLACK) !== color && (q & 7) !== KING) {
          hits++;
          exposed[t] = 1;
        }
      }
    } else {
      const diag = type === BISHOP || type === QUEEN;
      const straight = type === ROOK || type === QUEEN;
      for (let i = 0; i < 8; i++) {
        if ((i < 4 && !diag) || (i >= 4 && !straight)) continue;
        const d = i < 4 ? BISHOP_DIRS[i]! : ROOK_DIRS[i - 4]!;
        for (let t = sq + d; !(t & 0x88); t += d) {
          const q = s[t]!;
          if (!q) continue;
          if ((q & BLACK) !== color && (q & 7) !== KING) {
            hits++;
            exposed[t] = 1;
          }
          break;
        }
      }
    }
    targets[sq] = hits;
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

    // Exposure: being capturable is good.
    if (type !== KING && exposed[sq]) good += w.exposed * cost[type]!;

    // Forced-capture risk: being able to capture is bad, worse near a bare-king opponent.
    const hits = targets[sq]!;
    if (hits) {
      let risk = hits * reach[type]! * w.forcedCapture;
      if ((isWhite ? blackLeft : whiteLeft) <= w.endgameThreshold) risk += hits * w.endgameDanger;
      good -= risk;
    }

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
