/**
 * Engine benchmark: fixed-depth search on a few positions, printing time,
 * nodes and nodes/second. Run: npm run bench [-- maxSeconds depths]
 * e.g. npm run bench -- 30 3,4,5,6,7
 */
import { Board } from '../src/engine/board';
import { findBestMove } from '../src/engine/search';

const POSITIONS: { name: string; fen: string }[] = [
  { name: 'start', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  { name: 'italian', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' },
  { name: 'middlegame', fen: 'r2q1rk1/pp2bppp/2n1bn2/3p4/3P4/2NBBN2/PP3PPP/R2Q1RK1 w - - 0 10' },
  { name: 'sparse', fen: '4rrk1/pp3ppp/2n5/3p4/8/2P2N2/PP3PPP/R4RK1 w - - 0 18' },
];

const maxSeconds = Number(process.argv[2] ?? 30);
const depths = (process.argv[3] ?? '3,4,5').split(',').map(Number);

for (const depth of depths) {
  for (const { name, fen } of POSITIONS) {
    const r = findBestMove(new Board(fen), { depth, timeLimitMs: maxSeconds * 1000 });
    const done = r.depth === depth ? '' : ` (TIME LIMIT, reached depth ${r.depth})`;
    const nps = Math.round(r.nodes / Math.max(r.timeMs / 1000, 0.001));
    console.log(
      `depth ${depth}  ${name.padEnd(11)} ${String(r.timeMs).padStart(7)} ms  ${String(r.nodes).padStart(9)} nodes  ${String(nps).padStart(8)} n/s  best ${r.move.san}${done}`,
    );
  }
}
