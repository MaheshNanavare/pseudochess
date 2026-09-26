import { useEffect, type CSSProperties } from 'react';
import type { Color, PieceType } from '../../engine/types';
import type { ResultText } from '../text';
import { pieceSrc } from './Piece';

/** How long the scene plays before the result dialog, unless tapped away. */
const SCENE_MS = 3000;

export interface SceneCast {
  /** Win: the pieces the winner gave away. Loss: the pieces the loser is stuck with. Draw: unused. */
  pieces: PieceType[];
  /** The colour of those pieces. */
  color: Color;
}

interface ResultSceneProps {
  result: ResultText;
  cast: SceneCast;
  onDone: () => void;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A repeatable spread in [0, 1) for piece i, so the scene looks scattered but never jumps between renders. */
const spread = (i: number, k: number) => ((i * k) % 97) / 97;

const TONE = {
  win: { title: 'text-jade scene-title-win', wash: 'from-jade/30' },
  loss: { title: 'text-rose scene-title-loss', wash: 'from-rose/30' },
  draw: { title: 'text-ink scene-title-draw', wash: 'from-sq-dark/30' },
} as const;

/**
 * The end of a game, acted out before the result dialog. A win lifts the
 * shed pieces away; a loss drops the pieces still held into a heap; a draw
 * balances the two kings on a beam. Tap, click or any key skips it; with
 * reduced motion it is skipped entirely.
 */
export function ResultScene({ result, cast, onDone }: ResultSceneProps) {
  const skip = reducedMotion();

  useEffect(() => {
    if (skip) {
      onDone();
      return;
    }
    const timer = setTimeout(onDone, SCENE_MS);
    const onKey = () => onDone();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [skip, onDone]);

  if (skip) return null;
  const tone = TONE[result.outcome];

  return (
    <div
      aria-hidden="true"
      onClick={onDone}
      className={`fixed inset-0 z-50 cursor-pointer overflow-hidden bg-page/85 backdrop-blur-[3px] ${result.outcome === 'loss' ? 'scene-loss' : 'scene'}`}
    >
      <div className={`absolute inset-0 bg-linear-to-t ${tone.wash} to-transparent ${result.outcome === 'loss' ? 'rotate-180' : ''}`} />

      {result.outcome === 'win' &&
        cast.pieces.map((type, i) => (
          <img
            key={i}
            src={pieceSrc(cast.color, type)}
            alt=""
            className="scene-piece scene-rise"
            style={
              {
                '--x': `${4 + spread(i, 53) * 88}%`,
                '--r': `${(spread(i, 31) - 0.5) * 80}deg`,
                '--s': `${0.75 + spread(i, 17) * 0.6}`,
                '--delay': `${120 + i * 85}ms`,
                '--dur': `${1700 + spread(i, 29) * 900}ms`,
              } as CSSProperties
            }
          />
        ))}

      {result.outcome === 'loss' &&
        cast.pieces.map((type, i) => (
          <img
            key={i}
            src={pieceSrc(cast.color, type)}
            alt=""
            className="scene-piece scene-drop"
            style={
              {
                // A heap: centred, wider at the bottom, later pieces landing on top.
                '--x': `${50 + (spread(i, 41) - 0.5) * (80 - Math.floor(i / 6) * 22) - 3}%`,
                '--bottom': `${2 + Math.floor(i / 6) * 5}%`,
                '--r': `${(spread(i, 23) - 0.5) * 70}deg`,
                '--s': `${0.9 + spread(i, 13) * 0.3}`,
                '--delay': `${i * 45}ms`,
              } as CSSProperties
            }
          />
        ))}

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <p
          className={`text-[clamp(4rem,17vw,11rem)] leading-[0.85] font-extrabold tracking-tight [font-stretch:75%] ${tone.title}`}
        >
          {result.title}
        </p>

        {result.outcome === 'draw' && (
          // Room above the beam for the kings standing on it.
          <div className="mt-24 flex flex-col items-center sm:mt-28">
            <div className="scene-beam relative h-2 w-[min(70vw,24rem)] rounded-full bg-ink">
              <img src={pieceSrc('w', 'k')} alt="" className="absolute bottom-full left-1 h-16 w-16 sm:h-20 sm:w-20" />
              <img src={pieceSrc('b', 'k')} alt="" className="absolute right-1 bottom-full h-16 w-16 sm:h-20 sm:w-20" />
            </div>
            {/* The fulcrum. */}
            <div className="h-0 w-0 border-x-[14px] border-b-[22px] border-x-transparent border-b-sq-dark" />
          </div>
        )}

        <p className="scene-detail mt-6 max-w-md text-lg leading-snug text-balance">{result.detail}</p>
      </div>
    </div>
  );
}
