import { useEffect, useRef } from 'react';
import type { Move } from '../../engine/types';

interface MoveHistoryProps {
  moves: Move[];
}

export function MoveHistory({ moves }: MoveHistoryProps) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [moves.length]);

  const rows: { n: number; white?: Move; black?: Move }[] = [];
  for (let i = 0; i < moves.length; i += 2) rows.push({ n: i / 2 + 1, white: moves[i], black: moves[i + 1] });

  const cell = (m: Move | undefined, isLast: boolean) => (
    <span className={`rounded px-1.5 py-0.5 ${isLast ? 'bg-jade/20 font-bold' : ''}`}>{m?.san ?? ''}</span>
  );

  return (
    <section aria-labelledby="moves-title" className="flex min-h-0 flex-col">
      <h2 id="moves-title" className="mb-2 text-sm font-semibold text-muted">
        Moves
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">White moves first. Drag a piece, or tap it and then a highlighted square.</p>
      ) : (
        <ol
          ref={listRef}
          className="grid max-h-36 grid-cols-[2.25rem_1fr_1fr] content-start gap-y-0.5 overflow-y-auto text-[15px] lg:max-h-none lg:flex-1"
        >
          {rows.map((row) => (
            <li key={row.n} className="contents">
              <span className="py-0.5 text-muted">{row.n}</span>
              {cell(row.white, moves.length === row.n * 2 - 1)}
              {cell(row.black, moves.length === row.n * 2)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
