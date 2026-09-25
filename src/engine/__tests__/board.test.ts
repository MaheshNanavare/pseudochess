import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { Board, GEN_ALL } from '../board';
import type { MoveInput, PromotionPiece, Square } from '../types';

function perft(board: Board, depth: number): number {
  if (depth === 0) return 1;
  const moves = board.generateLegal(GEN_ALL);
  if (depth === 1) return moves.length;
  let total = 0;
  for (const m of moves) {
    board.makeMove(m);
    total += perft(board, depth - 1);
    board.unmakeMove();
  }
  return total;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FEN without the en passant field (chess.js and we may differ on when to print it). */
const fenCore = (fen: string): string => {
  const [placement, side, castling, , half, full] = fen.split(' ');
  return [placement, side, castling, half, full].join(' ');
};

describe('Board move generation (perft)', () => {
  // Reference counts from the Chess Programming Wiki perft results page.
  const cases: { name: string; fen: string; counts: number[] }[] = [
    { name: 'start', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', counts: [20, 400, 8902, 197281] },
    {
      name: 'kiwipete',
      fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
      counts: [48, 2039, 97862],
    },
    { name: 'position 3', fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', counts: [14, 191, 2812, 43238] },
    {
      name: 'position 4',
      fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
      counts: [6, 264, 9467],
    },
    {
      name: 'position 5',
      fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
      counts: [44, 1486, 62379],
    },
  ];

  for (const { name, fen, counts } of cases) {
    it(`matches reference perft for ${name}`, () => {
      const board = new Board(fen);
      counts.forEach((expected, i) => expect(perft(board, i + 1)).toBe(expected));
      expect(board.fen()).toBe(new Board(fen).fen());
    });
  }
});

describe('Board agrees with chess.js (differential)', () => {
  it('matches legal moves, SAN, check and FEN over random games', () => {
    const random = mulberry32(2024);
    for (let game = 0; game < 40; game++) {
      const board = new Board();
      const oracle = new Chess();
      for (let ply = 0; ply < 120 && !oracle.isGameOver(); ply++) {
        const ours = board
          .allLegalMoves()
          .map((m) => `${m.from}${m.to}${m.promotion ?? ''}:${m.san}`)
          .sort();
        const theirs = oracle
          .moves({ verbose: true })
          .map((m) => `${m.from}${m.to}${m.promotion ?? ''}:${m.san}`)
          .sort();
        expect(ours).toEqual(theirs);
        expect(board.inCheck()).toBe(oracle.inCheck());
        expect(board.isThreefoldRepetition()).toBe(oracle.isThreefoldRepetition());
        expect(fenCore(board.fen())).toBe(fenCore(oracle.fen()));

        const pick = oracle.moves({ verbose: true })[Math.floor(random() * theirs.length)]!;
        const input: MoveInput = { from: pick.from as Square, to: pick.to as Square };
        if (pick.promotion) input.promotion = pick.promotion as PromotionPiece;
        board.make(input);
        oracle.move(input);
      }
    }
  });

  it('counts repetitions of the current position', () => {
    const board = new Board();
    expect(board.repetitions(2)).toBe(false);
    for (const [from, to] of [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']] as const) board.make({ from, to });
    expect(board.repetitions(2)).toBe(true);
    expect(board.repetitions(3)).toBe(false);
  });

  it('undo restores the exact position and hash', () => {
    const board = new Board('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    const fen = board.fen();
    const { hashLo, hashHi } = board;
    for (const m of board.generateLegal()) {
      board.makeMove(m);
      board.unmakeMove();
      expect(board.fen()).toBe(fen);
      expect([board.hashLo, board.hashHi]).toEqual([hashLo, hashHi]);
    }
  });

  it('incremental hash equals a fresh hash of the same position', () => {
    const random = mulberry32(99);
    const board = new Board();
    for (let ply = 0; ply < 200; ply++) {
      const moves = board.generateLegal();
      if (moves.length === 0) break;
      board.makeMove(moves[Math.floor(random() * moves.length)]!);
      const fresh = new Board(board.fen());
      expect([board.hashLo, board.hashHi]).toEqual([fresh.hashLo, fresh.hashHi]);
    }
  });
});
