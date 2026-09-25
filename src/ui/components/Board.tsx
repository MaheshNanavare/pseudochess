import { useMemo } from 'react';
import type { Color, Move, Piece as PieceData, Square as SquareName } from '../../engine/types';
import { trackPieceIds } from '../pieceIds';
import { pieceSrc } from './Piece';
import { Square } from './Square';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

interface BoardProps {
  pieces: PieceData[];
  history: Move[];
  orientation: Color;
  selected: SquareName | null;
  targets: Move[];
  movable: Set<SquareName>;
  forced: boolean;
  lastMove: Move | undefined;
  checkSquare: SquareName | undefined;
  interactive: boolean;
  onSquareClick: (square: SquareName) => void;
}

/** Column and row (0..7, top-left origin) of a square for the given orientation. */
function place(square: SquareName, orientation: Color): { col: number; row: number } {
  const file = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rank = Number(square[1]) - 1;
  return orientation === 'w' ? { col: file, row: 7 - rank } : { col: 7 - file, row: rank };
}

function squareAt(col: number, row: number, orientation: Color): SquareName {
  return (orientation === 'w' ? `${FILES[col]}${8 - row}` : `${FILES[7 - col]}${row + 1}`) as SquareName;
}

const CORNERS = 'M0 0H24L0 24Z M100 0V24L76 0Z M0 100V76L24 100Z M100 100H76L100 76Z';

export function Board(props: BoardProps) {
  const { pieces, history, orientation, selected, targets, movable, forced, lastMove, checkSquare, interactive, onSquareClick } = props;
  const bySquare = useMemo(() => new Map(pieces.map((p) => [p.square, p])), [pieces]);
  const targetSet = useMemo(() => new Set(targets.map((m) => m.to)), [targets]);
  const ids = useMemo(() => trackPieceIds(history), [history]);

  const cells: SquareName[] = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) cells.push(squareAt(col, row, orientation));

  return (
    <div className={`relative aspect-square w-full touch-manipulation select-none ${interactive ? '' : 'cursor-default'}`}>
      <div role="group" aria-label="Chess board" className="grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-md">
        {cells.map((name, i) => {
          const { col, row } = { col: i % 8, row: Math.floor(i / 8) };
          const fileIndex = FILES.indexOf(name[0] as (typeof FILES)[number]);
          const rankIndex = Number(name[1]) - 1;
          return (
            <Square
              key={name}
              name={name}
              piece={bySquare.get(name)}
              dark={(fileIndex + rankIndex) % 2 === 0}
              selected={selected === name}
              isTarget={targetSet.has(name)}
              isLastMove={lastMove?.from === name || lastMove?.to === name}
              inCheck={checkSquare === name}
              movable={movable.has(name)}
              fileLabel={row === 7 ? name[0]! : null}
              rankLabel={col === 0 ? name[1]! : null}
              onClick={onSquareClick}
            />
          );
        })}
      </div>

      {/* Pieces: keyed by identity so moves slide. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
        {pieces.map((p) => {
          const { col, row } = place(p.square, orientation);
          const lifted = selected === p.square;
          return (
            <div
              key={ids.get(p.square) ?? p.square}
              className="piece absolute top-0 left-0 h-[12.5%] w-[12.5%]"
              style={{ transform: `translate(${col * 100}%, ${row * 100}%)` }}
            >
              <img
                src={pieceSrc(p.color, p.type)}
                alt=""
                draggable={false}
                className={`h-full w-full p-[5%] transition-transform duration-150 ${lifted ? '-translate-y-[4%] scale-110 drop-shadow-[0_6px_6px_rgba(20,10,40,0.35)]' : ''}`}
              />
            </div>
          );
        })}
      </div>

      {/* Markers drawn over the pieces: forced capturers and move targets. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-8 grid-rows-8">
        {cells.map((name) => {
          const occupied = bySquare.has(name);
          const target = targetSet.has(name);
          const mustCapture = forced && movable.has(name) && selected !== name;
          return (
            <div key={name} className="relative">
              {mustCapture && <span className="absolute inset-[3px] rounded-[4px] ring-[3px] ring-must ring-inset" />}
              {target && !occupied && <span className="absolute top-1/2 left-1/2 h-[28%] w-[28%] -translate-1/2 animate-pop rounded-full bg-ink/30" />}
              {target && occupied && (
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-pop">
                  <path d={CORNERS} fill="var(--color-must)" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
