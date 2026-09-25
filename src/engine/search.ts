import type { Board } from './board';
import { DEFAULT_WEIGHTS, WIN_THRESHOLD, staticScore, terminalScore, type EvalWeights } from './evaluate';
import { filterForcedCaptures } from './rules';
import { opponentOf, type Difficulty, type Move } from './types';

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

interface RootScore {
  move: Move;
  score: number;
}

class Searcher {
  nodes = 0;
  private stopped = false;
  private timed = false;
  private readonly deadline: number;

  constructor(
    private readonly board: Board,
    private readonly opts: SearchOptions,
  ) {
    this.deadline = Date.now() + opts.timeLimitMs;
  }

  /** Enable the time check (off during depth 1, so depth 1 always completes). */
  setTimed(timed: boolean): void {
    this.timed = timed;
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  private tick(): void {
    this.nodes++;
    if (this.timed && (this.nodes & 127) === 0 && Date.now() > this.deadline) this.stopped = true;
  }

  /** Cheap ordering: shed high-cost pieces first, and quiet moves that walk into attack first. */
  orderMoves(moves: Move[]): Move[] {
    const cost = this.opts.weights.remainingCost;
    const opp = opponentOf(this.board.sideToMove());
    const keyed = moves.map((m) => {
      let key = cost[m.piece] * 10;
      if (m.captured === undefined && this.board.isAttacked(m.to, opp)) key += 100 + cost[m.piece] * 10;
      if (m.promotion) key -= cost[m.promotion];
      return { m, key };
    });
    keyed.sort((a, b) => b.key - a.key);
    return keyed.map((k) => k.m);
  }

  negamax(depth: number, alpha: number, beta: number, ply: number): number {
    this.tick();
    if (this.stopped) return 0;

    const all = this.board.allLegalMoves();
    const t = terminalScore(this.board, this.board.sideToMove(), ply, this.opts.weights, all);
    if (t !== null) return t;

    const moves = filterForcedCaptures(all);
    if (depth <= 0) return this.quiescenceWith(moves, alpha, beta, ply, 0);

    for (const move of this.orderMoves(moves)) {
      this.board.make(move);
      const score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      this.board.undo();
      if (this.stopped) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  private quiescence(alpha: number, beta: number, ply: number, qdepth: number): number {
    this.tick();
    if (this.stopped) return 0;

    const all = this.board.allLegalMoves();
    const t = terminalScore(this.board, this.board.sideToMove(), ply, this.opts.weights, all);
    if (t !== null) return t;
    return this.quiescenceWith(filterForcedCaptures(all), alpha, beta, ply, qdepth);
  }

  /** Follow forced capture chains to a quiet position. No stand-pat: captures are mandatory. */
  private quiescenceWith(moves: Move[], alpha: number, beta: number, ply: number, qdepth: number): number {
    const forced = moves.length > 0 && moves[0]!.captured !== undefined;
    if (!forced || qdepth >= this.opts.qMax) {
      return staticScore(this.board, this.board.sideToMove(), this.opts.weights);
    }
    for (const move of moves) {
      this.board.make(move);
      const score = -this.quiescence(-beta, -alpha, ply + 1, qdepth + 1);
      this.board.undo();
      if (this.stopped) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  /** Alpha-beta at the root: only the best move's score is exact. */
  searchRootBest(moves: Move[], depth: number): RootScore[] {
    let alpha = -INF;
    let best: RootScore | undefined;
    for (const move of moves) {
      this.board.make(move);
      const score = -this.negamax(depth - 1, -INF, -alpha, 1);
      this.board.undo();
      if (this.stopped) break;
      if (!best || score > best.score) best = { move, score };
      if (score > alpha) alpha = score;
    }
    return best ? [best] : [];
  }

  /** Full-window search of every root move so the top N can be ranked (easy mode). */
  searchRootAll(moves: Move[], depth: number): RootScore[] {
    const scores: RootScore[] = [];
    for (const move of moves) {
      this.board.make(move);
      const score = -this.negamax(depth - 1, -INF, INF, 1);
      this.board.undo();
      if (this.stopped) return [];
      scores.push({ move, score });
    }
    return scores.sort((a, b) => b.score - a.score);
  }
}

function pickFromTop(ranked: RootScore[], topN: number, random: () => number): RootScore {
  const best = ranked[0]!;
  if (topN <= 1 || ranked.length === 1) return best;
  // Never hand away a decided game at random when the best move is not lost.
  const pool = ranked
    .slice(0, topN)
    .filter((r) => best.score <= -WIN_THRESHOLD || r.score > -WIN_THRESHOLD);
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
  const start = Date.now();
  const searcher = new Searcher(board, opts);

  const legal = filterForcedCaptures(board.allLegalMoves());
  if (legal.length === 0) throw new Error('findBestMove called with no legal moves');

  let ordered = searcher.orderMoves(legal);
  let ranked: RootScore[] = [{ move: ordered[0]!, score: 0 }];
  let completedDepth = 0;

  if (legal.length > 1) {
    for (let depth = 1; depth <= opts.depth; depth++) {
      searcher.setTimed(depth > 1);
      const result = opts.topN > 1 ? searcher.searchRootAll(ordered, depth) : searcher.searchRootBest(ordered, depth);
      if (searcher.isStopped || result.length === 0) break;
      ranked = result;
      completedDepth = depth;
      // Search the previous best move first next time.
      const bestMove = result[0]!.move;
      ordered = [bestMove, ...ordered.filter((m) => m !== bestMove)];
      if (Math.abs(result[0]!.score) >= WIN_THRESHOLD) break;
    }
  }

  const choice = pickFromTop(ranked, opts.topN, opts.random);
  return {
    move: choice.move,
    score: choice.score,
    depth: completedDepth,
    nodes: searcher.nodes,
    timeMs: Date.now() - start,
  };
}
