/**
 * Self-play: two engine configurations play each other. Each random opening
 * is played twice with colours swapped, which cancels most opening luck.
 *
 *   npm run selfplay -- [pairs] [depth] [configA] [configB] [seed]
 *   e.g. npm run selfplay -- 50 4 default pawn10
 */
import { Board } from '../src/engine/board';
import { DEFAULT_WEIGHTS, type EvalWeights } from '../src/engine/evaluate';
import { getGameResult, legalMoves } from '../src/engine/rules';
import { findBestMove, type SearchOptions } from '../src/engine/search';
import type { GameResult, MoveInput } from '../src/engine/types';

export const CONFIGS: Record<string, EvalWeights> = {
  default: DEFAULT_WEIGHTS,
  pawn10: { ...DEFAULT_WEIGHTS, remainingCost: { ...DEFAULT_WEIGHTS.remainingCost, p: 10 } },
};

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GameRecord {
  result: GameResult;
  plies: number;
  /** True when the game hit maxPlies without a result. */
  capped: boolean;
}

/** A random but still-ongoing opening of `plies` forced-capture-legal moves. */
export function randomOpening(plies: number, random: () => number): MoveInput[] {
  for (;;) {
    const board = new Board();
    const moves: MoveInput[] = [];
    while (moves.length < plies && getGameResult(board).status === 'ongoing') {
      const legal = legalMoves(board);
      const m = legal[Math.floor(random() * legal.length)]!;
      board.make(m);
      moves.push(m);
    }
    if (getGameResult(board).status === 'ongoing') return moves;
  }
}

export function playGame(
  white: Partial<SearchOptions>,
  black: Partial<SearchOptions>,
  opening: MoveInput[],
  maxPlies = 400,
): GameRecord {
  const board = new Board();
  for (const m of opening) board.make(m);
  for (let plies = opening.length; plies < maxPlies; plies++) {
    const result = getGameResult(board);
    if (result.status !== 'ongoing') return { result, plies, capped: false };
    const opts = board.sideToMove() === 'w' ? white : black;
    board.make(findBestMove(board, opts).move);
  }
  return { result: getGameResult(board), plies: maxPlies, capped: true };
}

export interface MatchStats {
  games: number;
  winsA: number;
  winsB: number;
  draws: number;
  /** Score of A in [0, 1]: wins + draws / 2. */
  score: number;
  /** Elo difference implied by the score (positive = A stronger). */
  elo: number;
  /** Approximate 95% margin on the Elo estimate. */
  eloMargin: number;
  avgPlies: number;
  endings: Map<string, number>;
  seconds: number;
}

function eloFromScore(p: number): number {
  const clamped = Math.min(Math.max(p, 0.001), 0.999);
  return -400 * Math.log10(1 / clamped - 1);
}

export function match(a: Partial<SearchOptions>, b: Partial<SearchOptions>, pairs: number, seed: number): MatchStats {
  const random = mulberry32(seed);
  const started = Date.now();
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let plies = 0;
  const endings = new Map<string, number>();
  const points: number[] = [];

  for (let p = 0; p < pairs; p++) {
    const opening = randomOpening(4, random);
    for (const aIsWhite of [true, false]) {
      // Seeded tie-breaking keeps matches reproducible.
      const seeded = { random: mulberry32(seed * 7919 + p * 2 + (aIsWhite ? 0 : 1)) };
      const pa = { ...seeded, ...a };
      const pb = { ...seeded, ...b };
      const g = aIsWhite ? playGame(pa, pb, opening) : playGame(pb, pa, opening);
      plies += g.plies;
      const reason = g.capped || g.result.status === 'ongoing' ? 'max-plies' : g.result.reason;
      endings.set(reason, (endings.get(reason) ?? 0) + 1);
      if (g.result.status === 'win') {
        const aWon = (g.result.winner === 'w') === aIsWhite;
        if (aWon) winsA++;
        else winsB++;
        points.push(aWon ? 1 : 0);
      } else {
        draws++;
        points.push(0.5);
      }
    }
  }

  const games = points.length;
  const score = (winsA + draws / 2) / games;
  const variance = points.reduce((acc, x) => acc + (x - score) ** 2, 0) / games;
  const se = Math.sqrt(variance / games);
  const elo = eloFromScore(score);
  const eloMargin = (eloFromScore(Math.min(score + 1.96 * se, 0.999)) - eloFromScore(Math.max(score - 1.96 * se, 0.001))) / 2;
  return { games, winsA, winsB, draws, score, elo, eloMargin, avgPlies: plies / games, endings, seconds: (Date.now() - started) / 1000 };
}

export function formatStats(nameA: string, nameB: string, s: MatchStats): string {
  const endings = [...s.endings].map(([r, n]) => `${r} ${n}`).join(', ');
  return [
    `${nameA} vs ${nameB}: ${s.games} games (${s.seconds.toFixed(1)}s, avg ${s.avgPlies.toFixed(0)} plies)`,
    `  ${nameA} ${s.winsA} wins, ${nameB} ${s.winsB} wins, ${s.draws} draws`,
    `  score ${(s.score * 100).toFixed(1)}%  Elo ${s.elo >= 0 ? '+' : ''}${s.elo.toFixed(0)} ± ${s.eloMargin.toFixed(0)}`,
    `  endings: ${endings}`,
  ].join('\n');
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/selfplay.ts');
if (isMain) {
  const pairs = Number(process.argv[2] ?? 25);
  const depth = Number(process.argv[3] ?? 4);
  const nameA = process.argv[4] ?? 'default';
  const nameB = process.argv[5] ?? 'pawn10';
  const seed = Number(process.argv[6] ?? 1);
  const a = CONFIGS[nameA];
  const b = CONFIGS[nameB];
  if (!a || !b) throw new Error(`Unknown config. Available: ${Object.keys(CONFIGS).join(', ')}`);
  const stats = match({ depth, weights: a, timeLimitMs: 60_000 }, { depth, weights: b, timeLimitMs: 60_000 }, pairs, seed);
  console.log(formatStats(nameA, nameB, stats));
}
