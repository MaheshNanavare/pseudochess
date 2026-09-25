import { useEffect, useState } from 'react';
import type { Color, Difficulty } from '../../engine/types';
import { COLOR_NAMES } from '../text';
import { Button } from './Button';
import { DifficultySelect } from './DifficultySelect';
import { LandingBoard } from './LandingBoard';
import { resolveSide, SideSelect, type Side } from './SideSelect';
import { Wordmark } from './Wordmark';

/** The landing animation plays once per launch; coming back to Home shows its final frame. */
let landingPlayed = false;

export interface GameInProgress {
  moveNumber: number;
  playerColor: Color;
  difficulty: Difficulty;
}

interface HomeProps {
  inProgress: GameInProgress | null;
  initialColor: Color;
  initialDifficulty: Difficulty;
  onContinue: () => void;
  onStart: (color: Color, difficulty: Difficulty) => void;
  onHelp: () => void;
  onSettings: () => void;
}

/** The screen the app opens on: what the game is, a way back into a saved game, and a new game. */
export function Home({ inProgress, initialColor, initialDifficulty, onContinue, onStart, onHelp, onSettings }: HomeProps) {
  const [side, setSide] = useState<Side>(initialColor);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [animate] = useState(() => !landingPlayed);

  useEffect(() => {
    landingPlayed = true;
  }, []);

  return (
    <main className="mx-auto grid min-h-dvh max-w-6xl content-center gap-x-16 gap-y-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:py-10">
      <div className="w-full max-w-[25rem] lg:self-end">
        <h1>
          <Wordmark size="lg" animate={animate} />
        </h1>
        <p className="mt-6 text-lg leading-snug text-balance">
          Chess, played to lose. Give away every piece, or get your own king checkmated, and you win.
        </p>
      </div>

      <div className="mx-auto w-full max-w-[24rem] sm:max-w-[28rem] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-[min(36rem,calc(100dvh-8rem))] lg:self-center">
        <LandingBoard animate={animate} />
      </div>

      <div className="w-full max-w-[25rem] lg:self-start">
        {inProgress && (
          <Button variant="primary" onClick={onContinue} className="h-auto w-full flex-col gap-0.5 py-3">
            Continue game
            <span className="text-sm font-normal opacity-75">
              Move {inProgress.moveNumber}, you are {COLOR_NAMES[inProgress.playerColor]}, computer on {inProgress.difficulty}
            </span>
          </Button>
        )}

        <section aria-labelledby="home-new-game" className={inProgress ? 'mt-7' : ''}>
          <h2 id="home-new-game" className="text-xl font-extrabold [font-stretch:85%]">
            New game
          </h2>
          <div className="mt-4 space-y-5">
            <SideSelect value={side} onChange={setSide} />
            <DifficultySelect value={difficulty} onChange={setDifficulty} />
          </div>
          <Button variant={inProgress ? 'quiet' : 'primary'} onClick={() => onStart(resolveSide(side), difficulty)} className="mt-1 w-full">
            Start new game
          </Button>
        </section>

        <nav aria-label="More" className="mt-6 flex gap-1 border-t border-line pt-3">
          <Button variant="ghost" onClick={onHelp} className="-ml-2">
            How to play
          </Button>
          <Button variant="ghost" onClick={onSettings}>
            Settings
          </Button>
        </nav>
      </div>
    </main>
  );
}
