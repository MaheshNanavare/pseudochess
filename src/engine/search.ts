import { BLACK, mCaptured, mPiece, mTo, type Board } from './board';
import { DEFAULT_WEIGHTS, staticScore, weightTables, type EvalWeights } from './evaluate';
import type { Color, Difficulty, Move } from './types';

export interface SearchOptions {
  /** Maximum iterative-deepening depth. */
  depth: number;
  /** Soft time limit per move. Depth 1 always completes so a move is always ready. */
  timeLimitMs: number;
  /** 1 = play the best move; N > 1 = pick randomly among the top N. */
  topN: number;
  weights: EvalWeights;
  random: () => number;
  /** Safety cap on capture-chain length in quiescence. */
  qMax: number;
}

export interface SearchResult {
  move: Move;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
}

export const DIFFICULTY_SETTINGS: Record<Difficulty, Pick<SearchOptions, 'depth' | 'topN'>> = {
  easy: { depth: 3, topN: 3 },
  medium: { depth: 4, topN: 1 },
  hard: { depth: 5, topN: 1 },
};

export const DEFAULT_OPTIONS: SearchOptions = {
  depth: 4,
  timeLimitMs: 2000,
  topN: 1,
  weights: DEFAULT_WEIGHTS,
  random: Math.random,
  qMax: 8,
};

const INF = 1_000_000;
const MAX_PLY = 128;

/* ---------------------------------------------------------------------- */
/* Transposition table (shared across searches, cleared per move)          */
/* ---------------------------------------------------------------------- */

const TT_BITS = 19;
const TT_MASK = (1 << TT_BITS) - 1;
const EXACT = 1;
const LOWER = 2;
const UPPER = 3;

class TranspositionTable {
  readonly lo = new Int32Array(1 << TT_BITS);
  readonly hi = new Int32Array(1 << TT_BITS);
  readonly score = new Int32Array(1 << TT_BITS);
  readonly move = new Int32Array(1 << TT_BITS);
  readonly depth = new Int8Array(1 << TT_BITS);
  readonly flag = new Int8Array(1 << TT_BITS);

  clear(): void {
    this.flag.fill(0);
  }

  /** Index of the entry for this position, or -1 when not stored. */
  probe(lo: number, hi: number): number {
    const i = lo & TT_MASK;
    return this.flag[i] && this.lo[i] === lo && this.hi[i] === hi ? i : -1;
  }

  store(lo: number, hi: number, depth: number, flag: number, score: number, move: number): void {
    const i = lo & TT_MASK;
    // Depth-preferred replacement, but always replace entries of other positions.
    if (this.flag[i] && this.lo[i] === lo && this.hi[i] === hi && this.depth[i]! > depth) return;
    this.lo[i] = lo;
    this.hi[i] = hi;
    this.depth[i] = depth;
    this.flag[i] = flag;
    this.score[i] = score;
    this.move[i] = move;
  }
}

let sharedTT: TranspositionTable | null = null;

/* ---------------------------------------------------------------------- */
/* Searcher                                                                */
/* ---------------------------------------------------------------------- */

interface RootScore {
  move: number;
  score: number;
}

class Searcher {
  nodes = 0;
  stopped = false;
  private timed = false;
  private readonly deadline: number;
  private readonly tt: TranspositionTable;
  private readonly killers = new Int32Array(MAX_PLY * 2);
  private readonly history = new Int32Array(16 * 128);
  private readonly cost: Int32Array;
  private readonly winThreshold: number;

  constructor(
    private readonly board: Board,
    private readonly opts: SearchOptions,
  ) {
    this.deadline = performance.now() + opts.timeLimitMs;
    sharedTT ??= new TranspositionTable();
    this.tt = sharedTT;
    this.tt.clear();
    this.cost = weightTables(opts.weights).cost;
    this.winThreshold = opts.weights.win - 1000;
  }

  /** Enable the time check (off during depth 1, so depth 1 always completes). */
  setTimed(timed: boolean): void {
    this.timed = timed;
  }

  private tick(): void {
    this.nodes++;
    if (this.timed && (this.nodes & 1023) === 0 && performance.now() > this.deadline) this.stopped = true;
  }

  /* Mate scores are stored relative to the node so they stay valid at any ply. */
  private toTT(score: number, ply: number): number {
    if (score >= this.winThreshold) return score + ply;
    if (score <= -this.winThreshold) return score - ply;
    return score;
  }

  private fromTT(score: number, ply: number): number {
    if (score >= this.winThreshold) return score - ply;
    if (score <= -this.winThreshold) return score + ply;
    return score;
  }

  /**
   * Move ordering for this variant. Captures: capture with a piece I want to
   * shed, onto a square where it can be recaptured, taking a piece the opponent
   * would rather keep. Quiet moves: killers, history, then moves into attack.
   */
  scoreMoves(moves: number[], ttMove: number, ply: number): Int32Array {
    const b = this.board;
    const them = b.stm ^ BLACK;
    const cost = this.cost;
    const scores = new Int32Array(moves.length);
    const k1 = this.killers[ply * 2];
    const k2 = this.killers[ply * 2 + 1];
    const side = (b.stm >> 3) * 7 * 128;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i]!;
      if (m === ttMove) {
        scores[i] = 1 << 30;
        continue;
      }
      const piece = mPiece(m);
      const cap = mCaptured(m);
      const into = b.attacked(mTo(m), them);
      if (cap) {
        scores[i] = 1_000_000 + cost[piece]! * 64 - cost[cap]! * 16 + (into ? cost[piece]! * 128 : 0);
      } else if (m === k1) {
        scores[i] = 900_000;
      } else if (m === k2) {
        scores[i] = 800_000;
      } else {
        scores[i] = Math.min(this.history[side + piece * 128 + mTo(m)]!, 500_000) + (into ? 100_000 + cost[piece]! * 1000 : 0);
      }
    }
    return scores;
  }

  /** Selection sort step: bring the best remaining move to index i. */
  private pick(moves: number[], scores: Int32Array, i: number): number {
    let best = i;
    for (let j = i + 1; j < moves.length; j++) if (scores[j]! > scores[best]!) best = j;
    if (best !== i) {
      const m = moves[i]!;
      moves[i] = moves[best]!;
      moves[best] = m;
      const s = scores[i]!;
      scores[i] = scores[best]!;
      scores[best] = s;
    }
    return moves[i]!;
  }

  negamax(depth: number, alpha: number, beta: number, ply: number): number {
    this.tick();
    if (this.stopped) return 0;
    const b = this.board;
    const w = this.opts.weights;

    // Terminal states (spec 3.3), from the side to move's point of view.
    if (b.nonKing[b.stm >> 3] === 0) return w.win - ply;
    if (b.nonKing[(b.stm ^ BLACK) >> 3] === 0) return -w.win + ply;
    if (b.isThreefoldRepetition()) return w.draw;
    const moves = b.forcedMoves();
    if (moves.length === 0) return b.isInCheck() ? w.win - ply : w.draw;
    if (b.halfmove >= 100) return w.draw;

    if (depth <= 0 || ply >= MAX_PLY - 1) return this.quiesceWith(moves, alpha, beta, ply, 0);

    const lo = b.hashLo;
    const hi = b.hashHi;
    let ttMove = 0;
    const entry = this.tt.probe(lo, hi);
    if (entry >= 0) {
      ttMove = this.tt.move[entry]!;
      if (this.tt.depth[entry]! >= depth) {
        const s = this.fromTT(this.tt.score[entry]!, ply);
        const flag = this.tt.flag[entry];
        if (flag === EXACT) return Math.max(alpha, Math.min(beta, s));
        if (flag === LOWER && s >= beta) return beta;
        if (flag === UPPER && s <= alpha) return alpha;
      }
    }

    const scores = this.scoreMoves(moves, ttMove, ply);
    const alphaOrig = alpha;
    let bestMove = 0;
    for (let i = 0; i < moves.length; i++) {
      const m = this.pick(moves, scores, i);
      b.makeMove(m);
      let score: number;
      if (i === 0) {
        score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      } else {
        // Principal variation search: null window first, re-search if it might be better.
        score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1);
        if (score > alpha && score < beta && !this.stopped) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      }
      b.unmakeMove();
      if (this.stopped) return 0;

      if (score >= beta) {
        this.tt.store(lo, hi, depth, LOWER, this.toTT(beta, ply), m);
        if (!mCaptured(m)) {
          if (this.killers[ply * 2] !== m) {
            this.killers[ply * 2 + 1] = this.killers[ply * 2]!;
            this.killers[ply * 2] = m;
          }
          this.history[(b.stm >> 3) * 7 * 128 + mPiece(m) * 128 + mTo(m)]! += depth * depth;
        }
        return beta;
      }
      if (score > alpha) {
        alpha = score;
        bestMove = m;
      }
    }
    this.tt.store(lo, hi, depth, alpha > alphaOrig ? EXACT : UPPER, this.toTT(alpha, ply), bestMove || moves[0]!);
    return alpha;
  }

  private quiesce(alpha: number, beta: number, ply: number, qdepth: number): number {
    this.tick();
    if (this.stopped) return 0;
    const b = this.board;
    const w = this.opts.weights;
    if (b.nonKing[b.stm >> 3] === 0) return w.win - ply;
    if (b.nonKing[(b.stm ^ BLACK) >> 3] === 0) return -w.win + ply;
    const moves = b.forcedMoves();
    if (moves.length === 0) return b.isInCheck() ? w.win - ply : w.draw;
    if (b.halfmove >= 100) return w.draw;
    return this.quiesceWith(moves, alpha, beta, ply, qdepth);
  }

  /** Follow forced capture chains to a quiet position. No stand-pat: captures are mandatory. */
  private quiesceWith(moves: number[], alpha: number, beta: number, ply: number, qdepth: number): number {
    const b = this.board;
    if (!mCaptured(moves[0]!) || qdepth >= this.opts.qMax || ply >= MAX_PLY - 1) {
      return staticScore(b, colorOf(b.stm), this.opts.weights);
    }
    const scores = this.scoreMoves(moves, 0, ply);
    for (let i = 0; i < moves.length; i++) {
      const m = this.pick(moves, scores, i);
      b.makeMove(m);
      const score = -this.quiesce(-beta, -alpha, ply + 1, qdepth + 1);
      b.unmakeMove();
      if (this.stopped) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  /** Alpha-beta at the root: only the best move's score is exact. */
  searchRootBest(moves: number[], depth: number): RootScore[] {
    const b = this.board;
    let alpha = -INF;
    let best: RootScore | undefined;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i]!;
      b.makeMove(m);
      let score: number;
      if (i === 0) {
        score = -this.negamax(depth - 1, -INF, INF, 1);
      } else {
        score = -this.negamax(depth - 1, -alpha - 1, -alpha, 1);
        if (score > alpha && !this.stopped) score = -this.negamax(depth - 1, -INF, -alpha, 1);
      }
      b.unmakeMove();
      if (this.stopped) break;
      if (!best || score > best.score) best = { move: m, score };
      if (score > alpha) alpha = score;
    }
    return best ? [best] : [];
  }

  /** Full-window search of every root move so the top N can be ranked (easy mode). */
  searchRootAll(moves: number[], depth: number): RootScore[] {
    const b = this.board;
    const scores: RootScore[] = [];
    for (const m of moves) {
      b.makeMove(m);
      const score = -this.negamax(depth - 1, -INF, INF, 1);
      b.unmakeMove();
      if (this.stopped) return [];
      scores.push({ move: m, score });
    }
    return scores.sort((a, c) => c.score - a.score);
  }
}

function colorOf(stm: number): Color {
  return stm === BLACK ? 'b' : 'w';
}

function pickFromTop(ranked: RootScore[], topN: number, random: () => number, winThreshold: number): RootScore {
  const best = ranked[0]!;
  if (topN <= 1 || ranked.length === 1) return best;
  // Never hand away a decided game at random when the best move is not lost.
  const pool = ranked.slice(0, topN).filter((r) => best.score <= -winThreshold || r.score > -winThreshold);
  return pool[Math.floor(random() * pool.length)] ?? best;
}

export function resolveOptions(difficulty: Difficulty | Partial<SearchOptions>): SearchOptions {
  if (typeof difficulty === 'string') return { ...DEFAULT_OPTIONS, ...DIFFICULTY_SETTINGS[difficulty] };
  return { ...DEFAULT_OPTIONS, ...difficulty };
}

/**
 * Pick the AI move for the side to move. Uses iterative deepening, so a
 * legal move is always returned even if the time limit cuts the search short.
 * The board is left exactly as it was given.
 */
export function findBestMove(board: Board, difficulty: Difficulty | Partial<SearchOptions>): SearchResult {
  const opts = resolveOptions(difficulty);
  const start = performance.now();
  const searcher = new Searcher(board, opts);
  const winThreshold = opts.weights.win - 1000;

  const legal = board.forcedMoves();
  if (legal.length === 0) throw new Error('findBestMove called with no legal moves');

  let ordered = [...legal];
  const initial = searcher.scoreMoves(ordered, 0, 0);
  ordered = ordered.map((m, i) => ({ m, s: initial[i]! })).sort((a, c) => c.s - a.s).map((x) => x.m);
  let ranked: RootScore[] = [{ move: ordered[0]!, score: 0 }];
  let completedDepth = 0;

  if (legal.length > 1) {
    for (let depth = 1; depth <= opts.depth; depth++) {
      searcher.setTimed(depth > 1);
      const result = opts.topN > 1 ? searcher.searchRootAll(ordered, depth) : searcher.searchRootBest(ordered, depth);
      if (searcher.stopped || result.length === 0) break;
      ranked = result;
      completedDepth = depth;
      // Search the previous best move first next time.
      const bestMove = result[0]!.move;
      ordered = [bestMove, ...ordered.filter((m) => m !== bestMove)];
      if (Math.abs(result[0]!.score) >= winThreshold) break;
    }
  }

  const choice = pickFromTop(ranked, opts.topN, opts.random, winThreshold);
  return {
    move: board.toMove(choice.move, legal),
    score: choice.score,
    depth: completedDepth,
    nodes: searcher.nodes,
    timeMs: Math.round(performance.now() - start),
  };
}
