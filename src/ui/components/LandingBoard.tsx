import type { CSSProperties } from 'react';
import type { Color, PieceType } from '../../engine/types';
import { Piece } from './Piece';

/*
 * The landing animation, one sequence played when the app opens: both armies
 * settle onto the board, then White's pieces are released upwards one by one
 * ("inverted gravity", as in the Store art) until only the king is left. In
 * PseudoChess a bare king wins, so the king gets the jade win mark.
 */

const BACK_RANK: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
const FILES = 'abcdefgh';

/** White's pieces leave from the edges inwards, closing in on the king. */
const RELEASE_ORDER = ['a2', 'h2', 'b2', 'g2', 'c2', 'f2', 'd2', 'e2', 'a1', 'h1', 'b1', 'g1', 'c1', 'f1', 'd1'];

// Timings in ms, one timeline for the whole sequence.
const SETTLE_START = 150;
const RELEASE_START = 1350;
const RELEASE_GAP = 80;
const WIN_MARK_AT = RELEASE_START + RELEASE_ORDER.length * RELEASE_GAP + 750;

function startingPiece(file: number, rank: number): { color: Color; type: PieceType } | null {
  if (rank === 1 || rank === 8) return { color: rank === 1 ? 'w' : 'b', type: BACK_RANK[file]! };
  if (rank === 2 || rank === 7) return { color: rank === 2 ? 'w' : 'b', type: 'p' };
  return null;
}

/** Back ranks settle first, file by file, so each army lands as a wave. */
function settleDelay(file: number, rank: number): number {
  const fromEdge = rank === 1 || rank === 8 ? 0 : 1;
  return SETTLE_START + fromEdge * 90 + file * 22;
}

/** An animation class with its start time, or nothing when the sequence is not playing. */
function timed(animate: boolean, className: string, ms: number): { className: string; style?: CSSProperties } {
  return animate ? { className, style: { animationDelay: `${ms}ms` } } : { className: '' };
}

interface LandingBoardProps {
  /** Play the sequence; otherwise show its final position straight away. */
  animate: boolean;
}

export function LandingBoard({ animate }: LandingBoardProps) {
  const squares = [];
  for (let rank = 8; rank >= 1; rank--) {
    for (let file = 0; file < 8; file++) {
      const name = `${FILES[file]}${rank}`;
      const piece = startingPiece(file, rank);
      const release = RELEASE_ORDER.indexOf(name);
      const winMark = timed(animate, 'animate-win-mark', WIN_MARK_AT);
      const settle = timed(animate, 'animate-settle', settleDelay(file, rank));
      const rise = timed(animate && release >= 0, 'animate-release', RELEASE_START + release * RELEASE_GAP);
      squares.push(
        <div key={name} className={`relative ${(file + rank) % 2 === 1 ? 'bg-sq-dark' : 'bg-sq-light'}`}>
          {name === 'e1' && (
            <span className={`absolute inset-[3px] rounded-[4px] ring-[3px] ring-jade ring-inset ${winMark.className}`} style={winMark.style} />
          )}
          {piece && (animate || release < 0) && (
            <div className={`relative h-full w-full ${settle.className}`} style={settle.style}>
              <Piece color={piece.color} type={piece.type} className={`relative z-10 h-full w-full p-[5%] ${rise.className}`} style={rise.style} />
            </div>
          )}
        </div>,
      );
    }
  }

  const caption = timed(animate, 'animate-caption', WIN_MARK_AT + 150);
  return (
    <figure>
      <div aria-hidden="true" className="grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-md">
        {squares}
      </div>
      <figcaption className={`mt-4 text-center text-[15px] text-muted ${caption.className}`} style={caption.style}>
        White has only its king left, so White wins.
      </figcaption>
    </figure>
  );
}
