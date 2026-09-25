/**
 * Weight tuning by self-play: each candidate plays the baseline over the same
 * paired openings. Results sorted by Elo (positive = candidate stronger).
 *
 *   npm run tune -- [pairs] [depth] [seed]
 */
import { DEFAULT_WEIGHTS, type EvalWeights } from '../src/engine/evaluate';
import type { SearchOptions } from '../src/engine/search';
import { match } from './selfplay';

const base = DEFAULT_WEIGHTS;
const cost = (patch: Partial<EvalWeights['remainingCost']>): EvalWeights => ({
  ...base,
  remainingCost: { ...base.remainingCost, ...patch },
});
const reach = (patch: Partial<EvalWeights['captureReach']>): EvalWeights => ({
  ...base,
  captureReach: { ...base.captureReach, ...patch },
});

/** Candidates: each changes one thing relative to the baseline. */
export const CANDIDATES: Record<string, Partial<SearchOptions>> = {
  'exposed=1': { weights: { ...base, exposed: 1 } },
  'exposed=3': { weights: { ...base, exposed: 3 } },
  'forcedCapture=2': { weights: { ...base, forcedCapture: 2 } },
  'forcedCapture=3': { weights: { ...base, forcedCapture: 3 } },
  'endgameDanger=10': { weights: { ...base, endgameDanger: 10 } },
  'endgameDanger=40': { weights: { ...base, endgameDanger: 40 } },
  'endgameThreshold=3': { weights: { ...base, endgameThreshold: 3 } },
  'pawnAdvance=0': { weights: { ...base, pawnAdvance: 0 } },
  'pawnAdvance=2': { weights: { ...base, pawnAdvance: 2 } },
  'cost q=3': { weights: cost({ q: 3 }) },
  'cost n,b=6': { weights: cost({ n: 6, b: 6 }) },
  'reach flat': { weights: reach({ p: 2, n: 2, b: 2, r: 2, q: 2, k: 2 }) },
  'reach q=10': { weights: reach({ q: 10 }) },
  'qMax=4': { qMax: 4 },
  'qMax=16': { qMax: 16 },
  'exposedDefended=1': { weights: { ...base, exposedDefended: 1 } },
  'exposedDefended=0': { weights: { ...base, exposedDefended: 0 } },
  'forcedCaptureDefended=0': { weights: { ...base, forcedCaptureDefended: 0 } },
  'blockedPawn=2': { weights: { ...base, blockedPawn: 2 } },
  'blockedPawn=4': { weights: { ...base, blockedPawn: 4 } },
  'blockedPawn=6': { weights: { ...base, blockedPawn: 6 } },
  twofold: { twofoldDraw: true },
  'depth=5': { depth: 5 },
  'depth=6': { depth: 6 },
};

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/tune.ts');
if (isMain) {
  const pairs = Number(process.argv[2] ?? 100);
  const depth = Number(process.argv[3] ?? 4);
  const seed = Number(process.argv[4] ?? 7);
  const only = process.argv[5]?.split('|');
  const baseline: Partial<SearchOptions> = { depth, timeLimitMs: 60_000 };
  const rows: { name: string; elo: number; margin: number; score: number }[] = [];

  for (const [name, patch] of Object.entries(CANDIDATES)) {
    if (only && !only.includes(name)) continue;
    const s = match({ ...baseline, ...patch }, baseline, pairs, seed);
    rows.push({ name, elo: s.elo, margin: s.eloMargin, score: s.score });
    console.log(`${name.padEnd(20)} ${(s.score * 100).toFixed(1).padStart(5)}%  Elo ${s.elo >= 0 ? '+' : ''}${s.elo.toFixed(0).padStart(4)} ± ${s.eloMargin.toFixed(0)}  (${s.winsA}/${s.draws}/${s.winsB}, ${s.seconds.toFixed(0)}s)`);
  }
  console.log('\nSorted:');
  for (const r of rows.sort((x, y) => y.elo - x.elo)) {
    console.log(`${r.name.padEnd(20)} Elo ${r.elo >= 0 ? '+' : ''}${r.elo.toFixed(0).padStart(4)} ± ${r.margin.toFixed(0)}`);
  }
}
