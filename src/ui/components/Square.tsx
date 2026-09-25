import type { Piece as PieceData, Square as SquareName } from '../../engine/types';
import { COLOR_NAMES, PIECE_NAMES } from '../text';

export interface SquareProps {
  name: SquareName;
  piece: PieceData | undefined;
  dark: boolean;
  selected: boolean;
  isTarget: boolean;
  isLastMove: boolean;
  inCheck: boolean;
  movable: boolean;
  /** The one square in the board's tab order (roving tabindex). */
  focusable: boolean;
  fileLabel: string | null;
  rankLabel: string | null;
  onClick: (square: SquareName) => void;
  onFocus: (square: SquareName) => void;
}

/** The interactive, accessible layer of one square. Pieces are drawn above it by Board. */
export function Square(props: SquareProps) {
  const { name, piece, dark, selected, isTarget, isLastMove, inCheck, movable, focusable, fileLabel, rankLabel, onClick, onFocus } = props;

  let label = piece ? `${name}, ${COLOR_NAMES[piece.color]} ${PIECE_NAMES[piece.type]}` : `${name}, empty`;
  if (isTarget) label += piece ? ', capture here' : ', move here';

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      data-movable={movable}
      data-square={name}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onClick(name)}
      onFocus={() => onFocus(name)}
      className={`relative ${dark ? 'bg-sq-dark' : 'bg-sq-light'} ${movable || isTarget ? 'cursor-pointer' : 'cursor-default'} outline-none focus-visible:z-10 focus-visible:ring-4 focus-visible:ring-ink focus-visible:ring-inset`}
    >
      {isLastMove && <span className={`absolute inset-0 ${dark ? 'bg-white/25' : 'bg-sq-dark/35'}`} />}
      {selected && <span className="absolute inset-0 bg-jade/55" />}
      {inCheck && <span className="absolute inset-0 bg-[radial-gradient(circle,var(--color-rose)_0%,color-mix(in_oklab,var(--color-rose)_45%,transparent)_45%,transparent_72%)]" />}
      {rankLabel && (
        <span className={`absolute top-[3%] left-[5%] text-[clamp(8px,1.6vmin,12px)] leading-none font-semibold ${dark ? 'text-coord-dark' : 'text-coord-light'}`}>
          {rankLabel}
        </span>
      )}
      {fileLabel && (
        <span className={`absolute right-[5%] bottom-[3%] text-[clamp(8px,1.6vmin,12px)] leading-none font-semibold ${dark ? 'text-coord-dark' : 'text-coord-light'}`}>
          {fileLabel}
        </span>
      )}
    </button>
  );
}
