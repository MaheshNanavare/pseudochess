import type { Piece as PieceData, Square as SquareName } from '../../engine/types';
import { COLOR_NAMES, PIECE_NAMES } from '../text';
import { Piece } from './Piece';

export interface SquareProps {
  name: SquareName;
  piece: PieceData | undefined;
  dark: boolean;
  selected: boolean;
  isTarget: boolean;
  isLastMove: boolean;
  inCheck: boolean;
  movable: boolean;
  forced: boolean;
  fileLabel: string | null;
  rankLabel: string | null;
  onClick: (square: SquareName) => void;
}

export function Square(props: SquareProps) {
  const { name, piece, dark, selected, isTarget, isLastMove, inCheck, movable, forced, fileLabel, rankLabel, onClick } = props;

  const label = piece ? `${name}, ${COLOR_NAMES[piece.color]} ${PIECE_NAMES[piece.type]}` : `${name}, empty`;
  const base = dark ? 'bg-[#b58863]' : 'bg-[#f0d9b5]';
  const coordColor = dark ? 'text-[#f0d9b5]' : 'text-[#b58863]';

  return (
    <button
      type="button"
      aria-label={label + (isTarget ? ', move here' : '')}
      aria-pressed={selected}
      data-movable={movable}
      onClick={() => onClick(name)}
      className={`relative aspect-square ${base} outline-none focus-visible:z-10 focus-visible:ring-4 focus-visible:ring-sky-400 focus-visible:ring-inset`}
    >
      {isLastMove && <span className="absolute inset-0 bg-yellow-300/45" />}
      {selected && <span className="absolute inset-0 bg-emerald-400/55" />}
      {inCheck && <span className="absolute inset-0 bg-[radial-gradient(circle,rgba(239,68,68,0.9)_0%,rgba(239,68,68,0.4)_45%,transparent_70%)]" />}
      {forced && movable && !selected && <span className="absolute inset-0 ring-4 ring-inset ring-rose-500/70" />}
      {piece && <Piece color={piece.color} type={piece.type} className="absolute inset-0 h-full w-full p-[4%]" />}
      {isTarget && !piece && <span className="absolute top-1/2 left-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/25" />}
      {isTarget && piece && <span className="absolute inset-0 rounded-full ring-[5px] ring-inset ring-black/30" />}
      {rankLabel && <span className={`absolute top-0.5 left-1 text-[10px] font-bold sm:text-xs ${coordColor}`}>{rankLabel}</span>}
      {fileLabel && <span className={`absolute right-1 bottom-0 text-[10px] font-bold sm:text-xs ${coordColor}`}>{fileLabel}</span>}
    </button>
  );
}
