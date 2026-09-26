import { describe, expect, it } from 'vitest';
import type { Move } from '../../engine/types';
import { describeMove, describeResult } from '../text';

const capture: Move = { from: 'e4', to: 'd5', color: 'w', piece: 'p', captured: 'p', san: 'exd5' };

describe('describeMove', () => {
  it('speaks from the player’s side against the computer', () => {
    expect(describeMove(capture, 'w')).toBe('You: pawn e4 to d5, takes a pawn');
    expect(describeMove(capture, 'b')).toBe('Computer: pawn e4 to d5, takes your pawn');
  });

  it('names the colour in a two-player game', () => {
    expect(describeMove(capture, null)).toBe('White: pawn e4 to d5, takes a pawn');
  });
});

describe('describeResult', () => {
  it('is null while the game goes on', () => {
    expect(describeResult({ status: 'ongoing' }, null)).toBeNull();
  });

  it('says win or lose against the computer', () => {
    const result = { status: 'win', winner: 'b', reason: 'bare-king' } as const;
    expect(describeResult(result, 'b')?.title).toBe('You win');
    expect(describeResult(result, 'w')?.title).toBe('You lose');
  });

  it('names the winning colour in a two-player game', () => {
    expect(describeResult({ status: 'win', winner: 'b', reason: 'checkmated' }, null)).toEqual({
      outcome: 'win',
      title: 'Black wins',
      detail: "Black's king was checkmated.",
    });
    expect(describeResult({ status: 'win', winner: 'w', reason: 'bare-king' }, null)?.detail).toBe('White lost every piece except the king.');
  });

  it('reports draws the same way in both modes', () => {
    expect(describeResult({ status: 'draw', reason: 'stalemate' }, null)?.title).toBe('Draw');
  });

  it('says who agreed to a draw', () => {
    expect(describeResult({ status: 'draw', reason: 'agreement' }, 'w')?.detail).toBe('The computer accepted your draw offer.');
    expect(describeResult({ status: 'draw', reason: 'agreement' }, null)?.detail).toBe('Both players agreed to a draw.');
  });
});
