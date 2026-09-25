import type { Color } from '../../engine/types';
import { pieceSrc } from './Piece';
import { Segmented } from './Segmented';

export type Side = Color | 'random';

/** The colour to play: White, Black, or a coin toss. */
export function resolveSide(side: Side): Color {
  return side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : side;
}

interface SideSelectProps {
  value: Side;
  onChange: (value: Side) => void;
}

export function SideSelect({ value, onChange }: SideSelectProps) {
  return (
    <Segmented<Side>
      legend="Play as"
      name="side"
      value={value}
      onChange={onChange}
      options={[
        { value: 'w', label: <><img src={pieceSrc('w', 'k')} alt="" className="h-6 w-6" />White</> },
        { value: 'b', label: <><img src={pieceSrc('b', 'k')} alt="" className="h-6 w-6" />Black</> },
        { value: 'random', label: 'Random' },
      ]}
    />
  );
}
