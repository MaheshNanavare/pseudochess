import { useEffect, useState } from 'react';
import type { Color } from './engine/types';
import { Board } from './ui/components/Board';
import { DifficultySelect } from './ui/components/DifficultySelect';
import { GameOverDialog } from './ui/components/GameOverDialog';
import { HowToPlay } from './ui/components/HowToPlay';
import { MoveHistory } from './ui/components/MoveHistory';
import { PromotionPicker } from './ui/components/PromotionPicker';
import { useGame } from './ui/hooks/useGame';
import { COLOR_NAMES, describeResult } from './ui/text';

const HELP_SEEN_KEY = 'pseudochess.helpSeen';

function readHelpSeen(): boolean {
  try {
    return localStorage.getItem(HELP_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHelpSeen(): void {
  try {
    localStorage.setItem(HELP_SEEN_KEY, '1');
  } catch {
    // storage unavailable: the help simply shows again next time
  }
}

export default function App() {
  const game = useGame({ playerColor: 'w', difficulty: 'medium' });
  const { snapshot, settings } = game;
  const [helpOpen, setHelpOpen] = useState(() => !readHelpSeen());
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const resultText = describeResult(snapshot.result, settings.playerColor);
  const gameOverOpen = resultText !== null && dismissedAt !== snapshot.history.length;

  useEffect(() => {
    if (resultText === null) setDismissedAt(null);
  }, [resultText]);

  const closeHelp = () => {
    writeHelpSeen();
    setHelpOpen(false);
  };

  const startGame = (playerColor: Color) => game.newGame({ playerColor });

  let status: string;
  if (resultText) status = `${resultText.title}. ${resultText.detail}`;
  else if (game.thinking || !game.isPlayerTurn) status = 'AI is thinking…';
  else if (snapshot.inCheck) status = 'You are in check.';
  else status = 'Your move.';

  return (
    <div className="min-h-dvh bg-stone-100 text-stone-900 dark:bg-stone-900 dark:text-stone-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <h1 className="text-2xl font-bold tracking-tight">PseudoChess</h1>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="How to play"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-200 text-lg font-bold hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700"
        >
          ?
        </button>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 pb-8 lg:flex-row lg:items-start">
        <div className="mx-auto w-full max-w-[560px] lg:mx-0">
          <Board
            pieces={snapshot.pieces}
            orientation={settings.playerColor}
            selected={game.selected}
            targets={game.targets}
            movable={game.movable}
            forced={snapshot.forced}
            lastMove={game.lastMove}
            checkSquare={snapshot.inCheck ? snapshot.kingSquare : undefined}
            onSquareClick={game.onSquareClick}
          />
        </div>

        <aside className="flex w-full flex-col gap-3 lg:max-w-sm">
          <div aria-live="polite" className="rounded-lg bg-white p-3 shadow-sm dark:bg-stone-800">
            <p className="font-medium">{status}</p>
            {game.isPlayerTurn && snapshot.forced && (
              <p className="mt-2 rounded-md bg-rose-100 px-2 py-1 text-sm font-semibold text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
                Capture is forced
              </p>
            )}
          </div>

          <DifficultySelect value={settings.difficulty} onChange={game.setDifficulty} />

          <div className="grid grid-cols-2 gap-2">
            {(['w', 'b'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => startGame(c)}
                className="rounded-lg bg-stone-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
              >
                New game as {COLOR_NAMES[c]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={game.undo}
            disabled={!game.canUndo}
            className="rounded-lg bg-stone-200 px-3 py-2.5 text-sm font-semibold hover:bg-stone-300 disabled:opacity-40 dark:bg-stone-800 dark:hover:bg-stone-700"
          >
            Undo
          </button>

          <MoveHistory moves={snapshot.history} />
        </aside>
      </main>

      <PromotionPicker open={game.pendingPromotion !== null} color={settings.playerColor} onChoose={game.choosePromotion} />
      <GameOverDialog
        result={resultText}
        open={gameOverOpen && !helpOpen}
        onClose={() => setDismissedAt(snapshot.history.length)}
        onNewGame={() => startGame(settings.playerColor)}
      />
      <HowToPlay open={helpOpen} onClose={closeHelp} />
    </div>
  );
}
