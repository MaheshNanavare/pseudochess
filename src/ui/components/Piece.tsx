import type { CSSProperties } from 'react';
import type { Color, PieceType } from '../../engine/types';

interface PieceProps {
  color: Color;
  type: PieceType;
  className?: string;
  style?: CSSProperties;
}

export function pieceSrc(color: Color, type: PieceType): string {
  return `${import.meta.env.BASE_URL}pieces/${color}${type.toUpperCase()}.svg`;
}

export function Piece({ color, type, className = '', style }: PieceProps) {
  return (
    <img
      src={pieceSrc(color, type)}
      alt=""
      draggable={false}
      style={style}
      className={`pointer-events-none select-none ${className}`}
    />
  );
}
