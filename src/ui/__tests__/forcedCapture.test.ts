import { describe, expect, it } from 'vitest';
import { Board } from '../../engine/board';
import { legalMoves } from '../../engine/rules';
import { explainForcedCapture, type Attempt } from '../forcedCapture';

/** Runs the explanation against a real position, the way the game hook does. */
function explain(fen: string, attempt: Attempt) {
  const board = new Board(fen);
  return explainForcedCapture(attempt, legalMoves(board), board.allLegalMoves(), board.pieces());
}

// 1.e4 d5: White's only legal move is exd5.
const ONE_CAPTURE = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
// White can take d5 with the e4 pawn or the c3 knight.
const TWO_CAPTURERS = '4k3/8/8/3p4/4P3/2N5/8/4K3 w - - 0 1';
// The d4 knight can take c6 or e6.
const TWO_VICTIMS = '4k3/8/2p1p3/8/3N4/8/8/4K3 w - - 0 1';

describe('explainForcedCapture', () => {
  it('stays quiet when no capture is forced', () => {
    expect(explain(new Board().fen(), { from: 'g1' })).toBeNull();
    expect(explain(new Board().fen(), { from: 'e2', to: 'e5' })).toBeNull();
  });

  it('explains picking up a piece that cannot capture', () => {
    const note = explain(ONE_CAPTURE, { from: 'g1' });
    expect(note?.title).toBe('You must capture');
    expect(note?.body).toBe('Your pawn on e4 can take a piece, so you have to capture with it. Your knight on g1 has to wait.');
  });

  it('names every piece that can capture', () => {
    const note = explain(TWO_CAPTURERS, { from: 'e1' });
    expect(note?.body).toMatch(/^Your (pawn on e4 and knight on c3|knight on c3 and pawn on e4) can take a piece/);
    expect(note?.body).toContain('capture with one of them');
    expect(note?.body).toContain('king on e1 has to wait');
  });

  it('says nothing when picking up a piece that can capture', () => {
    expect(explain(ONE_CAPTURE, { from: 'e4' })).toBeNull();
  });

  it('explains a quiet move by a piece that has a capture', () => {
    const note = explain(ONE_CAPTURE, { from: 'e4', to: 'e5' });
    expect(note?.body).toBe("Your pawn on e4 can take the pawn on d5, so it can't move to e5 instead. Captures can't be skipped.");
  });

  it('lists every capture that piece could make', () => {
    const note = explain(TWO_VICTIMS, { from: 'd4', to: 'b3' });
    expect(note?.body).toMatch(/can take the (pawn on c6 or pawn on e6|pawn on e6 or pawn on c6)/);
  });

  it('stays quiet for the capture itself', () => {
    expect(explain(ONE_CAPTURE, { from: 'e4', to: 'd5' })).toBeNull();
  });

  it('stays quiet for squares the piece could not reach in normal chess either', () => {
    expect(explain(ONE_CAPTURE, { from: 'e4', to: 'h8' })).toBeNull();
  });

  it("ignores the opponent's pieces and empty squares", () => {
    expect(explain(ONE_CAPTURE, { from: 'd5' })).toBeNull();
    expect(explain(ONE_CAPTURE, { from: 'e5' })).toBeNull();
  });
});
