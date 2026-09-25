/**
 * Self-play: two engine configurations play each other from randomised
 * openings, alternating colours. Prints wins/losses/draws and how games ended.
 *
 *   npm run selfplay -- [games] [depth] [configA] [configB] [seed]
 *   e.g. npm run selfplay -- 50 4 default pawn10
 */
import { Board } from '../src/engine/board';
import { DEFAULT_WEIGHTS, type EvalWeights } from '../src/engine/evaluate';
import { getGameResult, legalMoves } from '../src/engine/rules';
import { findBestMove, type SearchOptions } from '../src/engine/search';
import type { Color, GameResult } from '../src/engine/types';

const CONFIGS: Record<string, EvalWeights> = {
  default: DEFAULT_WEIGHTS,
  pawn10: { ...DEFAULT_WEIGHTS, remainingCost: { ...DEFAULT_WEIGHTS.remainingCost, p: 10 } },
};

function mulberry32(seed: number): () => number {
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

export function playGame(
  white: Partial<SearchOptions>,
  black: Partial<SearchOptions>,
  openingPlies: number,
  random: () => number,
  maxPlies = 400,
): GameRecord {
  const board = new Board();
  let plies = 0;
  for (; plies < maxPlies; plies++) {
    const result = getGameResult(board);
    if (result.status !== 'ongoing') return { result, plies, capped: false };
    if (plies < openingPlies) {
      const moves = legalMoves(board);
      board.make(moves[Math.floor(random() * moves.length)]!);
      continue;
    }
    const opts = board.sideToMove() === 'w' ? white : black;
    board.make(findBestMove(board, opts).move);
  }
  return { result: getGameResult(board), plies, capped: true };
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/selfplay.ts');
if (isMain) {
  const games = Number(process.argv[2] ?? 20);
  const depth = Number(process.argv[3] ?? 3);
  const nameA = process.argv[4] ?? 'default';
  const nameB = process.argv[5] ?? 'default';
  const seed = Number(process.argv[6] ?? 1);
  const a = CONFIGS[nameA];
  const b = CONFIGS[nameB];
  if (!a || !b) throw new Error(`Unknown config. Available: ${Object.keys(CONFIGS).join(', ')}`);

  const random = mulberry32(seed);
  const tally = { a: 0, b: 0, draw: 0 };
  const reasons = new Map<string, number>();
  let totalPlies = 0;
  const started = Date.now();

  for (let g = 0; g < games; g++) {
    const aColor: Color = g % 2 === 0 ? 'w' : 'b';
    const optsA: Partial<SearchOptions> = { depth, weights: a, timeLimitMs: 60_000 };
    const optsB: Partial<SearchOptions> = { depth, weights: b, timeLimitMs: 60_000 };
    const { result, plies, capped } = playGame(aColor === 'w' ? optsA : optsB, aColor === 'w' ? optsB : optsA, 4, random);
    totalPlies += plies;
    const reason = capped || result.status === 'ongoing' ? 'max-plies' : result.reason;
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    if (result.status === 'win') {
      if (result.winner === aColor) tally.a++;
      else tally.b++;
    } else {
      tally.draw++;
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`${games} games at depth ${depth} (${secs}s, avg ${(totalPlies / games).toFixed(0)} plies)`);
  console.log(`  ${nameA}: ${tally.a} wins   ${nameB}: ${tally.b} wins   draws: ${tally.draw}`);
  console.log(`  score for ${nameA}: ${((tally.a + tally.draw / 2) / games * 100).toFixed(1)}%`);
  console.log(`  endings: ${[...reasons].map(([r, n]) => `${r} ${n}`).join(', ')}`);
}
