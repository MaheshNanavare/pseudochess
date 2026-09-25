import { useEffect, useRef, useState } from 'react';
import { opponentOf, type Color, type Difficulty } from './engine/types';
import { Board } from './ui/components/Board';
import { Button } from './ui/components/Button';
import { GameOverDialog } from './ui/components/GameOverDialog';
import { Home, type GameInProgress } from './ui/components/Home';
import { HowToPlay } from './ui/components/HowToPlay';
import { MoveHistory } from './ui/components/MoveHistory';
import { NewGameDialog } from './ui/components/NewGameDialog';
import { PlayerStrip } from './ui/components/PlayerStrip';
import { PromotionPicker } from './ui/components/PromotionPicker';
import { SettingsDialog } from './ui/components/SettingsDialog';
import { StatusLine } from './ui/components/StatusLine';
import { Wordmark } from './ui/components/Wordmark';
import { useGame } from './ui/hooks/useGame';
import { playSound } from './ui/sound';
import { loadGame, loadPreferences, savePreferences, type Preferences } from './ui/storage';
import { describeMove, describeResult } from './ui/text';

const HELP_SEEN_KEY = 'pseudochess.helpSeen';

type Screen = 'home' | 'game';
/** Why the rules are showing: automatically before a first game, or because the player asked. */
type HelpMode = 'intro' | 'asked';

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
  const [saved] = useState(loadGame);
  const game = useGame({ playerColor: saved?.playerColor ?? 'w', difficulty: saved?.difficulty ?? 'medium' }, saved?.moves);
  const { snapshot, settings } = game;
  const [screen, setScreen] = useState<Screen>('home');
  const [help, setHelp] = useState<HelpMode | null>(null);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const resultText = describeResult(snapshot.result, settings.playerColor);
  const gameOverOpen = resultText !== null && dismissedAt !== snapshot.history.length;

  useEffect(() => {
    if (resultText === null) setDismissedAt(null);
  }, [resultText]);

  useEffect(() => {
    savePreferences(prefs);
    if (prefs.boardTheme === 'dusk') delete document.documentElement.dataset.board;
    else document.documentElement.dataset.board = prefs.boardTheme;
  }, [prefs]);

  // Sounds for new moves and for the end of the game (not for undo or loading a saved game).
  const heardMoves = useRef(snapshot.history.length);
  useEffect(() => {
    const count = snapshot.history.length;
    const grew = count > heardMoves.current;
    heardMoves.current = count;
    if (!grew || !prefs.sound || screen !== 'game') return;
    const last = snapshot.history[count - 1]!;
    if (resultText) playSound(resultText.outcome === 'win' ? 'win' : resultText.outcome === 'loss' ? 'loss' : 'draw');
    else if (last.san.endsWith('+')) playSound('check');
    else playSound(last.captured ? 'capture' : 'move');
  }, [snapshot, resultText, prefs.sound, screen]);

  const player = settings.playerColor;
  const ai = opponentOf(player);
  const aiToMove = snapshot.result.status === 'ongoing' && snapshot.turn === ai;

  const inProgress: GameInProgress | null =
    snapshot.history.length > 0 && snapshot.result.status === 'ongoing'
      ? { moveNumber: Math.floor(snapshot.history.length / 2) + 1, playerColor: player, difficulty: settings.difficulty }
      : null;

  const closeHelp = () => {
    writeHelpSeen();
    setHelp(null);
  };

  /** Opens the board; the very first time, the rules come up before the first move. */
  const enterGame = () => {
    setScreen('game');
    if (!readHelpSeen()) setHelp('intro');
  };

  const startGame = (playerColor: Color, difficulty: Difficulty) => {
    setNewGameOpen(false);
    game.newGame({ playerColor, difficulty });
    enterGame();
  };

  const dialogs = (
    <>
      <HowToPlay open={help !== null} onClose={closeHelp} actionLabel={help === 'intro' ? 'Start playing' : 'Close'} />
      <SettingsDialog open={settingsOpen} prefs={prefs} onChange={setPrefs} onClose={() => setSettingsOpen(false)} />
    </>
  );

  if (screen === 'home') {
    return (
      <>
        <Home
          inProgress={inProgress}
          initialColor={player}
          initialDifficulty={settings.difficulty}
          onContinue={enterGame}
          onStart={startGame}
          onHelp={() => setHelp('asked')}
          onSettings={() => setSettingsOpen(true)}
        />
        {dialogs}
      </>
    );
  }

  return (
    <div className="min-h-dvh animate-enter">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-4 pb-2 sm:px-6 lg:pt-6">
        <Wordmark />
        <nav aria-label="Game menu" className="flex items-center gap-1.5">
          <Button aria-label="Home" onClick={() => setScreen('home')} className="w-11 rounded-full px-0">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5 10 3.5l7 6" />
              <path d="M5 8v8.5h10V8" />
            </svg>
          </Button>
          <Button aria-label="How to play" onClick={() => setHelp('asked')} className="w-11 rounded-full px-0 text-lg">
            ?
          </Button>
          <Button aria-label="Settings" onClick={() => setSettingsOpen(true)} className="w-11 rounded-full px-0">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 6h9M16 6h1M3 14h1M8 14h9" />
              <circle cx="14" cy="6" r="2" />
              <circle cx="6" cy="14" r="2" />
            </svg>
          </Button>
          <Button variant="primary" onClick={() => setNewGameOpen(true)}>
            New game
          </Button>
        </nav>
      </header>

      <main className="mx-auto grid max-w-7xl gap-x-10 px-4 pb-8 sm:px-6 lg:grid-cols-[auto_minmax(16rem,21rem)] lg:justify-center">
        <section aria-label="Game" className="mx-auto w-full max-w-[36rem] lg:w-[min(40rem,calc(100dvh-14rem))] lg:max-w-none xl:w-[min(54rem,calc(100dvh-14rem))]">
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
            hints={prefs.hints}
            lastMove={game.lastMove}
            checkSquare={snapshot.inCheck ? snapshot.kingSquare : undefined}
            interactive={game.isPlayerTurn}
            onSquareClick={game.onSquareClick}
            onDragStart={game.select}
            onDrop={game.tryMove}
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
            <p aria-live="polite" className="sr-only">
              {game.lastMove ? describeMove(game.lastMove, player) : ''}
            </p>
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
        open={gameOverOpen && help === null}
        onClose={() => setDismissedAt(snapshot.history.length)}
        onPlayAgain={() => game.newGame()}
      />
      {dialogs}
    </div>
  );
}
