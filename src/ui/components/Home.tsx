import { useEffect, useState, type ReactNode } from 'react';
import type { GameSettings } from '../storage';
import { COLOR_NAMES } from '../text';
import { Button } from './Button';
import { draftFrom, GameSetupFields, resolveSetup, type SetupDraft } from './GameSetup';
import { LandingBoard } from './LandingBoard';
import { Wordmark } from './Wordmark';

/** The landing animation plays once per launch; coming back to Home shows its final frame. */
let landingPlayed = false;

export interface GameInProgress extends GameSettings {
  moveNumber: number;
}

interface HomeProps {
  inProgress: GameInProgress | null;
  initial: GameSettings;
  onContinue: () => void;
  onStart: (settings: GameSettings) => void;
  onHelp: () => void;
  onSettings: () => void;
  onResults: () => void;
  /** Quick audio controls, in the top-right corner. */
  audio: ReactNode;
}

function describeInProgress(game: GameInProgress): string {
  if (game.opponent === 'human') return `Move ${game.moveNumber}, two players on this device`;
  return `Move ${game.moveNumber}, you are ${COLOR_NAMES[game.playerColor]}, computer on ${game.difficulty}`;
}

/** The screen the app opens on: what the game is, a way back into a saved game, and a new game. */
export function Home({ inProgress, initial, onContinue, onStart, onHelp, onSettings, onResults, audio }: HomeProps) {
  const [draft, setDraft] = useState<SetupDraft>(() => draftFrom(initial));
  const [animate] = useState(() => !landingPlayed);

  useEffect(() => {
    landingPlayed = true;
  }, []);

  return (
    <main className="relative mx-auto grid min-h-dvh max-w-6xl content-center gap-x-16 gap-y-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:py-10">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">{audio}</div>

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
            <span className="text-sm font-normal opacity-75">{describeInProgress(inProgress)}</span>
          </Button>
        )}

        <section aria-labelledby="home-new-game" className={inProgress ? 'mt-7' : ''}>
          <h2 id="home-new-game" className="text-xl font-extrabold [font-stretch:85%]">
            New game
          </h2>
          <div className="mt-4">
            <GameSetupFields value={draft} onChange={setDraft} />
          </div>
          <Button variant={inProgress ? 'quiet' : 'primary'} onClick={() => onStart(resolveSetup(draft))} className={`w-full ${draft.opponent === 'computer' ? 'mt-1' : 'mt-5'}`}>
            Start new game
          </Button>
        </section>

        <nav aria-label="More" className="mt-6 flex flex-wrap gap-1 border-t border-line pt-3">
          <Button variant="ghost" onClick={onHelp} className="-ml-2">
            How to play
          </Button>
          <Button variant="ghost" onClick={onResults}>
            Your results
          </Button>
          <Button variant="ghost" onClick={onSettings}>
            Settings
          </Button>
        </nav>
      </div>
    </main>
  );
}
