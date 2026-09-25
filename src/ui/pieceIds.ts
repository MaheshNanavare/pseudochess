import type { Move, Square } from '../engine/types';

const FILES = 'abcdefgh';

/**
 * Stable identity for every piece on the board (its starting square), found by
 * replaying the game from the start position. React keys pieces by this id,
 * so a moved piece slides instead of disappearing and reappearing.
 */
export function trackPieceIds(history: Move[]): Map<Square, string> {
  const ids = new Map<Square, string>();
  for (const file of FILES) {
    for (const rank of ['1', '2', '7', '8']) {
      const sq = `${file}${rank}` as Square;
      ids.set(sq, sq);
    }
  }

  for (const m of history) {
    const id = ids.get(m.from) ?? `${m.from}-${m.to}`;
    if (m.captured) {
      if (ids.has(m.to)) ids.delete(m.to);
      else ids.delete(`${m.to[0]}${m.from[1]}` as Square); // en passant
    }
    ids.delete(m.from);
    ids.set(m.to, id);

    const fileDelta = FILES.indexOf(m.to[0]!) - FILES.indexOf(m.from[0]!);
    if (m.piece === 'k' && Math.abs(fileDelta) === 2) {
      const rank = m.from[1]!;
      const rookFrom = `${fileDelta > 0 ? 'h' : 'a'}${rank}` as Square;
      const rookTo = `${fileDelta > 0 ? 'f' : 'd'}${rank}` as Square;
      const rookId = ids.get(rookFrom);
      if (rookId) {
        ids.delete(rookFrom);
        ids.set(rookTo, rookId);
      }
    }
  }
  return ids;
}
