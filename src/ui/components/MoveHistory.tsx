import { useEffect, useRef } from 'react';
import type { Move } from '../../engine/types';

interface MoveHistoryProps {
  moves: Move[];
}

export function MoveHistory({ moves }: MoveHistoryProps) {
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [moves.length]);

  const rows: { n: number; white?: Move; black?: Move }[] = [];
  for (let i = 0; i < moves.length; i += 2) rows.push({ n: i / 2 + 1, white: moves[i], black: moves[i + 1] });

  return (
    <section aria-label="Move history" className="rounded-lg bg-stone-200/60 p-2 dark:bg-stone-800/60">
      {rows.length === 0 ? (
        <p className="p-1 text-sm text-stone-500">No moves yet.</p>
      ) : (
        <ol className="grid max-h-40 grid-cols-[2.5rem_1fr_1fr] gap-x-2 overflow-y-auto font-mono text-sm lg:max-h-72">
          {rows.map((row) => (
            <li key={row.n} ref={row.n === rows.length ? endRef : undefined} className="contents">
              <span className="text-stone-500">{row.n}.</span>
              <span className={row.white?.captured ? 'text-rose-700 dark:text-rose-300' : ''}>{row.white?.san}</span>
              <span className={row.black?.captured ? 'text-rose-700 dark:text-rose-300' : ''}>{row.black?.san ?? ''}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
