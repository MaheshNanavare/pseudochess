import { useEffect, useState } from 'react';
import { opponentOf, type Color, type Difficulty } from './engine/types';
import { Board } from './ui/components/Board';
import { Button } from './ui/components/Button';
import { GameOverDialog } from './ui/components/GameOverDialog';
import { HowToPlay } from './ui/components/HowToPlay';
import { MoveHistory } from './ui/components/MoveHistory';
import { NewGameDialog } from './ui/components/NewGameDialog';
import { PlayerStrip } from './ui/components/PlayerStrip';
import { PromotionPicker } from './ui/components/PromotionPicker';
import { StatusLine } from './ui/components/StatusLine';
import { Wordmark } from './ui/components/Wordmark';
import { useGame } from './ui/hooks/useGame';
import { describeResult } from './ui/text';

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
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const resultText = describeResult(snapshot.result, settings.playerColor);
  const gameOverOpen = resultText !== null && dismissedAt !== snapshot.history.length;

  useEffect(() => {
    if (resultText === null) setDismissedAt(null);
  }, [resultText]);

  const player = settings.playerColor;
  const ai = opponentOf(player);
  const aiToMove = snapshot.result.status === 'ongoing' && snapshot.turn === ai;

  const closeHelp = () => {
    writeHelpSeen();
    setHelpOpen(false);
  };

  const startGame = (playerColor: Color, difficulty: Difficulty) => {
    setNewGameOpen(false);
    game.newGame({ playerColor, difficulty });
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-4 pb-2 sm:px-6 lg:pt-6">
        <Wordmark />
        <nav aria-label="Game menu" className="flex items-center gap-1.5">
          <Button aria-label="How to play" onClick={() => setHelpOpen(true)} className="w-11 rounded-full px-0 text-lg">
            ?
          </Button>
          <Button variant="primary" onClick={() => setNewGameOpen(true)}>
            New game
          </Button>
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl gap-x-10 px-4 pb-8 sm:px-6 lg:grid-cols-[auto_minmax(16rem,21rem)] lg:justify-center">
        <section aria-label="Game" className="mx-auto w-full max-w-[36rem] lg:w-[min(40rem,calc(100dvh-14rem))] lg:max-w-none">
          <PlayerStrip
            name="Computer"
            detail={settings.difficulty[0]!.toUpperCase() + settings.difficulty.slice(1)}
            color={ai}
            pieces={snapshot.pieces.filter((p) => p.color === ai)}
            toMove={aiToMove}
            thinking={aiToMove}
          />
          <Board
            pieces={snapshot.pieces}
            history={snapshot.history}
            orientation={player}
            selected={game.selected}
            targets={game.targets}
            movable={game.movable}
            forced={snapshot.forced}
            lastMove={game.lastMove}
            checkSquare={snapshot.inCheck ? snapshot.kingSquare : undefined}
            interactive={game.isPlayerTurn}
            onSquareClick={game.onSquareClick}
          />
          <PlayerStrip
            name="You"
            color={player}
            pieces={snapshot.pieces.filter((p) => p.color === player)}
            toMove={game.isPlayerTurn}
          />
        </section>

        <aside className="mx-auto w-full max-w-[36rem] lg:relative lg:max-w-none">
          <div className="flex flex-col gap-5 pt-2 lg:absolute lg:inset-0 lg:pt-16 lg:pb-14">
            <StatusLine result={resultText} isPlayerTurn={game.isPlayerTurn} forced={snapshot.forced} inCheck={snapshot.inCheck} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={game.undo} disabled={!game.canUndo}>
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 4 3 8l4 4" />
                  <path d="M3 8h9a5 5 0 0 1 0 10H9" />
                </svg>
                Undo move
              </Button>
              {resultText && (
                <Button variant="primary" onClick={() => game.newGame()}>
                  Play again
                </Button>
              )}
            </div>
            <div className="border-t border-line pt-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              <MoveHistory moves={snapshot.history} />
            </div>
          </div>
        </aside>
      </main>

      <PromotionPicker open={game.pendingPromotion !== null} color={player} onChoose={game.choosePromotion} />
      <NewGameDialog
        key={newGameOpen ? 'open' : 'closed'}
        open={newGameOpen}
        initialColor={player}
        initialDifficulty={settings.difficulty}
        onCancel={() => setNewGameOpen(false)}
        onStart={startGame}
      />
      <GameOverDialog
        result={resultText}
        open={gameOverOpen && !helpOpen}
        onClose={() => setDismissedAt(snapshot.history.length)}
        onPlayAgain={() => game.newGame()}
      />
      <HowToPlay open={helpOpen} onClose={closeHelp} />
    </div>
  );
}
