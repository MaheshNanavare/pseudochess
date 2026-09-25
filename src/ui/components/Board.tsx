import { useMemo } from 'react';
import type { Color, Move, Piece, Square as SquareName } from '../../engine/types';
import { Square } from './Square';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

interface BoardProps {
  pieces: Piece[];
  orientation: Color;
  selected: SquareName | null;
  targets: Move[];
  movable: Set<SquareName>;
  forced: boolean;
  lastMove: Move | undefined;
  checkSquare: SquareName | undefined;
  onSquareClick: (square: SquareName) => void;
}

export function Board({ pieces, orientation, selected, targets, movable, forced, lastMove, checkSquare, onSquareClick }: BoardProps) {
  const bySquare = useMemo(() => new Map(pieces.map((p) => [p.square, p])), [pieces]);
  const targetSet = useMemo(() => new Set(targets.map((m) => m.to)), [targets]);

  const ranks = orientation === 'w' ? RANKS : [...RANKS].reverse();
  const files = orientation === 'w' ? FILES : [...FILES].reverse();

  return (
    <div role="group" aria-label="Chess board" className="grid w-full grid-cols-8 overflow-hidden rounded-md shadow-xl select-none">
      {ranks.map((rank, r) =>
        files.map((file, f) => {
          const name = `${file}${rank}` as SquareName;
          const fileIndex = FILES.indexOf(file);
          const rankIndex = Number(rank) - 1;
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
              forced={forced}
              fileLabel={r === 7 ? file : null}
              rankLabel={f === 0 ? rank : null}
              onClick={onSquareClick}
            />
          );
        }),
      )}
    </div>
  );
}
