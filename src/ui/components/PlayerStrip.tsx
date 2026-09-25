import type { Color, Piece as PieceData, PieceType } from '../../engine/types';
import { PIECE_NAMES } from '../text';
import { pieceSrc } from './Piece';

const ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p'];

interface PlayerStripProps {
  name: string;
  detail?: string;
  color: Color;
  /** All pieces of this colour currently on the board. */
  pieces: PieceData[];
  toMove: boolean;
  thinking?: boolean;
}

/**
 * One side of the game: who they are, whose turn it is, and the rack of
 * pieces they still have to lose. The rack emptying is progress towards winning.
 */
export function PlayerStrip({ name, detail, color, pieces, toMove, thinking = false }: PlayerStripProps) {
  const burden = pieces.filter((p) => p.type !== 'k').sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  const left = burden.length;
  const summary = ORDER.map((t) => {
    const n = burden.filter((p) => p.type === t).length;
    return n ? `${n} ${PIECE_NAMES[t]}${n > 1 ? 's' : ''}` : null;
  })
    .filter(Boolean)
    .join(', ');

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${toMove ? 'bg-jade' : 'bg-line'} ${thinking ? 'animate-think' : ''}`}
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-tight font-bold">
            {name}
            {detail && <span className="ml-1.5 font-normal text-muted">{detail}</span>}
          </p>
          <ul aria-label={`${name}: ${left ? summary : 'only the king'} left`} className={`mt-1 flex min-h-6 w-fit flex-wrap items-center gap-x-px rounded-md px-1 py-0.5 ${left ? 'bg-sq-light' : ''}`}>
            {burden.map((p, i) => (
              // Keyed by type and rank within the rack, so a piece moving on the board does not re-mount its icon.
              <li key={`${p.type}${i - burden.findIndex((q) => q.type === p.type)}`} className="h-5 w-5 animate-pop">
                <img src={pieceSrc(color, p.type)} alt="" className="h-full w-full" />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="shrink-0 text-right leading-none" aria-hidden="true">
        <span className="block text-2xl font-extrabold [font-stretch:80%]">{left}</span>
        <span className="text-xs text-muted">to lose</span>
      </p>
    </div>
  );
}
