import type { Color, PieceType } from '../../engine/types';

interface PieceProps {
  color: Color;
  type: PieceType;
  className?: string;
}

export function pieceSrc(color: Color, type: PieceType): string {
  return `${import.meta.env.BASE_URL}pieces/${color}${type.toUpperCase()}.svg`;
}

export function Piece({ color, type, className = '' }: PieceProps) {
  return (
    <img
      src={pieceSrc(color, type)}
      alt=""
      draggable={false}
      className={`pointer-events-none select-none ${className}`}
    />
  );
}
