import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
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
  hints: boolean;
  lastMove: Move | undefined;
  checkSquare: SquareName | undefined;
  interactive: boolean;
  onSquareClick: (square: SquareName) => void;
  onDragStart: (square: SquareName) => void;
  /** Returns false when the drop square is not a legal move. */
  onDrop: (from: SquareName, to: SquareName) => boolean;
}

interface Drag {
  from: SquareName;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
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
const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};
const DRAG_THRESHOLD_PX = 6;

export function Board(props: BoardProps) {
  const { pieces, history, orientation, selected, targets, movable, forced, hints, lastMove, checkSquare, interactive } = props;
  const { onSquareClick, onDragStart, onDrop } = props;
  const bySquare = useMemo(() => new Map(pieces.map((p) => [p.square, p])), [pieces]);
  const targetSet = useMemo(() => new Set(targets.map((m) => m.to)), [targets]);
  const ids = useMemo(() => trackPieceIds(history), [history]);

  const rootRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [focusSquare, setFocusSquare] = useState<SquareName>(orientation === 'w' ? 'e2' : 'e7');

  const cells: SquareName[] = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) cells.push(squareAt(col, row, orientation));

  /** The square under a viewport point, or null outside the board. */
  const squareFromPoint = (x: number, y: number): SquareName | null => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.floor(((x - rect.left) / rect.width) * 8);
    const row = Math.floor(((y - rect.top) / rect.height) * 8);
    return col >= 0 && col < 8 && row >= 0 && row < 8 ? squareAt(col, row, orientation) : null;
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.button !== 0) return;
    const square = (e.target as Element).closest('[data-square]')?.getAttribute('data-square') as SquareName | null;
    if (!square || !movable.has(square)) return;
    // No pointer capture yet: capturing now would retarget the click of a plain tap.
    setDrag({ from: square, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false });
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const moved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD_PX;
    if (moved && !drag.active) {
      rootRef.current?.setPointerCapture(e.pointerId);
      onDragStart(drag.from);
    }
    setDrag({ ...drag, x: e.clientX, y: e.clientY, active: drag.active || moved });
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.active) {
      suppressClick.current = true;
      const to = squareFromPoint(e.clientX, e.clientY);
      if (to && to !== drag.from) onDrop(drag.from, to);
    }
    setDrag(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ARROWS[e.key];
    if (!step) return;
    e.preventDefault();
    const { col, row } = place(focusSquare, orientation);
    const next = squareAt(Math.min(7, Math.max(0, col + step[0])), Math.min(7, Math.max(0, row + step[1])), orientation);
    setFocusSquare(next);
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-square="${next}"]`)?.focus();
  };

  const dragging = drag?.active ? drag : null;
  const rect = dragging ? rootRef.current?.getBoundingClientRect() : undefined;
  const draggedPiece = dragging ? bySquare.get(dragging.from) : undefined;

  return (
    <div
      ref={rootRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDrag(null)}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.stopPropagation();
        }
      }}
      className={`relative aspect-square w-full touch-none select-none ${dragging ? 'cursor-grabbing' : ''}`}
    >
      <div
        role="group"
        aria-label="Chess board. Use the arrow keys to move between squares and Enter to pick a piece or a destination."
        onKeyDown={handleKeyDown}
        className="grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-md"
      >
        {cells.map((name, i) => {
          const col = i % 8;
          const row = Math.floor(i / 8);
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
              focusable={focusSquare === name}
              fileLabel={row === 7 ? name[0]! : null}
              rankLabel={col === 0 ? name[1]! : null}
              onClick={onSquareClick}
              onFocus={setFocusSquare}
            />
          );
        })}
      </div>

      {/* Pieces: keyed by identity so moves slide. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
        {pieces.map((p) => {
          const { col, row } = place(p.square, orientation);
          const lifted = selected === p.square && !dragging;
          return (
            <div
              key={ids.get(p.square) ?? p.square}
              className={`piece absolute top-0 left-0 h-[12.5%] w-[12.5%] ${dragging?.from === p.square ? 'opacity-25' : ''}`}
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
          const target = hints && targetSet.has(name);
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

      {/* The piece under the pointer while dragging. */}
      {dragging && rect && draggedPiece && (
        <img
          aria-hidden="true"
          src={pieceSrc(draggedPiece.color, draggedPiece.type)}
          alt=""
          className="pointer-events-none absolute top-0 left-0 z-20 drop-shadow-[0_10px_10px_rgba(20,10,40,0.4)]"
          style={{
            width: rect.width / 8 * 1.12,
            height: rect.width / 8 * 1.12,
            transform: `translate(${dragging.x - rect.left - (rect.width / 8) * 0.56}px, ${dragging.y - rect.top - (rect.width / 8) * 0.56}px)`,
          }}
        />
      )}
    </div>
  );
}
