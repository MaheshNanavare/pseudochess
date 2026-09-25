import { describe, expect, it } from 'vitest';
import { Board } from '../board';
import { getGameResult, legalMoves } from '../rules';
import type { Move, MoveInput, Square } from '../types';

const uci = (m: Move): string => `${m.from}${m.to}${m.promotion ?? ''}`;
const uciList = (moves: Move[]): string[] => moves.map(uci).sort();

function play(board: Board, ...moves: string[]): void {
  for (const m of moves) {
    const input: MoveInput = { from: m.slice(0, 2) as Square, to: m.slice(2, 4) as Square };
    board.make(input);
  }
}

describe('legalMoves (forced capture)', () => {
  it('returns all normal moves when no capture is available', () => {
    const moves = legalMoves(new Board());
    expect(moves).toHaveLength(20);
    expect(moves.every((m) => m.captured === undefined)).toBe(true);
  });

  it('returns only the capture when exactly one capture exists', () => {
    const board = new Board('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    expect(uciList(legalMoves(board))).toEqual(['e4d5']);
  });

  it('lets the player choose among several captures', () => {
    const board = new Board('rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3');
    expect(uciList(legalMoves(board))).toEqual(['e4d5', 'f3e5']);
  });

  it('ignores a capture that would leave the king in check (pinned piece)', () => {
    // The e2 knight is pinned by the e8 rook, so Nxd4 is illegal and forces nothing.
    const board = new Board('4r1k1/8/8/8/3p4/8/4N3/4K3 w - - 0 1');
    const moves = legalMoves(board);
    expect(moves.some((m) => m.captured !== undefined)).toBe(false);
    expect(uciList(moves)).toEqual(['e1d1', 'e1d2', 'e1f1', 'e1f2']);
  });

  it('in check, only capturing escapes are returned; captures that do not escape are illegal', () => {
    // Re5 checks the king. Bxe5 escapes; Bxa5 does not, so it is illegal.
    const board = new Board('4k3/8/8/p3r3/8/2B5/8/4K3 w - - 0 1');
    expect(uciList(legalMoves(board))).toEqual(['c3e5']);
  });

  it('treats en passant as a forced capture', () => {
    const board = new Board('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
    const moves = legalMoves(board);
    expect(uciList(moves)).toEqual(['e5d6']);
    expect(moves[0]!.captured).toBe('p');
  });

  it('lists each promotion-with-capture option as a separate move', () => {
    const board = new Board('r1n1k3/1P6/8/8/8/8/8/4K3 w - - 0 1');
    expect(uciList(legalMoves(board))).toEqual([
      'b7a8b', 'b7a8n', 'b7a8q', 'b7a8r',
      'b7c8b', 'b7c8n', 'b7c8q', 'b7c8r',
    ]);
  });

  it('applies to black as well', () => {
    const board = new Board('rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 2');
    expect(uciList(legalMoves(board))).toEqual(['e5d4']);
  });
});

describe('getGameResult (reverse win conditions)', () => {
  it('a checkmated white king WINS for white', () => {
    const board = new Board('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(getGameResult(board)).toEqual({ status: 'win', winner: 'w', reason: 'checkmated' });
  });

  it('a checkmated black king WINS for black', () => {
    const board = new Board('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4');
    expect(getGameResult(board)).toEqual({ status: 'win', winner: 'b', reason: 'checkmated' });
  });

  it('white left with only a king WINS', () => {
    const board = new Board('4k3/8/8/8/8/8/p7/4K3 b - - 0 1');
    expect(getGameResult(board)).toEqual({ status: 'win', winner: 'w', reason: 'bare-king' });
  });

  it('black left with only a king WINS', () => {
    const board = new Board('4k3/8/8/8/8/8/P7/4K3 w - - 0 1');
    expect(getGameResult(board)).toEqual({ status: 'win', winner: 'b', reason: 'bare-king' });
  });

  it('stalemate is a draw (white to move)', () => {
    const board = new Board('8/8/8/8/8/7p/5k1P/7K w - - 0 1');
    expect(getGameResult(board)).toEqual({ status: 'draw', reason: 'stalemate' });
  });

  it('stalemate is a draw (black to move)', () => {
    const board = new Board('7k/5K1p/7P/8/8/8/8/8 b - - 0 1');
    expect(getGameResult(board)).toEqual({ status: 'draw', reason: 'stalemate' });
  });

  it('threefold repetition is a draw (white to move)', () => {
    const board = new Board();
    play(board, 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1');
    expect(getGameResult(board).status).toBe('ongoing');
    play(board, 'f6g8');
    expect(getGameResult(board)).toEqual({ status: 'draw', reason: 'threefold-repetition' });
  });

  it('threefold repetition is a draw (black to move)', () => {
    const board = new Board();
    play(board, 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3');
    expect(getGameResult(board)).toEqual({ status: 'draw', reason: 'threefold-repetition' });
  });

  it('50-move rule is a draw for either side to move', () => {
    expect(getGameResult(new Board('4k3/4p3/8/8/8/8/4P3/4K3 w - - 100 80'))).toEqual({
      status: 'draw',
      reason: 'fifty-move-rule',
    });
    expect(getGameResult(new Board('4k3/4p3/8/8/8/8/4P3/4K3 b - - 100 80'))).toEqual({
      status: 'draw',
      reason: 'fifty-move-rule',
    });
  });

  it('a normal position is ongoing', () => {
    expect(getGameResult(new Board())).toEqual({ status: 'ongoing' });
  });
});
