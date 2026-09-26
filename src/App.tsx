import { useCallback, useEffect, useRef, useState } from 'react';
import { opponentOf, type Color } from './engine/types';
import { AudioToggles } from './ui/components/AudioToggles';
import { Board } from './ui/components/Board';
import { Button } from './ui/components/Button';
import { DrawOfferDialog } from './ui/components/DrawOfferDialog';
import { ExitGameDialog } from './ui/components/ExitGameDialog';
import { GameNotice } from './ui/components/GameNotice';
import { GameOverDialog } from './ui/components/GameOverDialog';
import { Home, type GameInProgress } from './ui/components/Home';
import { HowToPlay } from './ui/components/HowToPlay';
import { MoveHistory } from './ui/components/MoveHistory';
import { NewGameDialog } from './ui/components/NewGameDialog';
import { PlayerStrip } from './ui/components/PlayerStrip';
import { PromotionPicker } from './ui/components/PromotionPicker';
import { ResultScene, type SceneCast } from './ui/components/ResultScene';
import { SettingsDialog } from './ui/components/SettingsDialog';
import { StatsScreen } from './ui/components/StatsScreen';
import { StatusLine } from './ui/components/StatusLine';
import { Wordmark } from './ui/components/Wordmark';
import { useGame, type GameSnapshot } from './ui/hooks/useGame';
import { music } from './ui/music';
import { atLeast, heldPieces, shedPieces } from './ui/resultPieces';
import { playCapture, playMove, playSound } from './ui/sound';
import { loadGame, loadHistory, loadPreferences, savePreferences, type GameSettings, type Preferences } from './ui/storage';
import { COLOR_NAMES, describeMove, describeResult, type ResultText } from './ui/text';

const HELP_SEEN_KEY = 'pseudochess.helpSeen';

type Screen = 'home' | 'game' | 'stats';
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

/** Who the end scene shows: the winner's shed pieces rising, or your held pieces falling. */
function sceneCast(snapshot: GameSnapshot, result: ResultText, player: Color): SceneCast {
  if (snapshot.result.status !== 'win') return { color: player, pieces: [] };
  if (result.outcome === 'loss') return { color: player, pieces: atLeast(heldPieces(snapshot.pieces, player), 8, 'p') };
  const winner = snapshot.result.winner;
  return { color: winner, pieces: atLeast(shedPieces(snapshot.history, winner), 10, 'p') };
}

export default function App() {
  const [saved] = useState(loadGame);
  const [screen, setScreen] = useState<Screen>('home');
  const [help, setHelp] = useState<HelpMode | null>(null);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  /** Counts visits to the results page, so its tips reshuffle every time. */
  const [statsVisit, setStatsVisit] = useState(0);
  // The only legal move is played for you only while you can see the board.
  const boardInView = screen === 'game' && help === null && !newGameOpen && !settingsOpen;
  const game = useGame(
    {
      opponent: saved?.opponent ?? 'computer',
      playerColor: saved?.playerColor ?? 'w',
      difficulty: saved?.difficulty ?? 'medium',
    },
    saved,
    prefs.autoMove && boardInView,
  );
  const { snapshot, settings } = game;

  const player = settings.playerColor;
  // Two people on one device are both "you", so they are named by colour instead.
  const perspective = game.twoPlayer ? null : player;
  const resultText = describeResult(snapshot.result, perspective);
  const gameOverOpen = resultText !== null && dismissedAt !== snapshot.history.length;

  // The end-of-game scene plays on its own for a moment, then the result dialog opens over it;
  // both close together.
  const resultKey = resultText ? `${snapshot.history.length}:${resultText.title}` : null;
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const sceneOpen = gameOverOpen && help === null;
  const revealed = resultKey === revealedFor;
  const reveal = useCallback(() => setRevealedFor(resultKey), [resultKey]);

  useEffect(() => {
    if (resultText === null) setDismissedAt(null);
  }, [resultText]);

  useEffect(() => {
    savePreferences(prefs);
    if (prefs.boardTheme === 'dusk') delete document.documentElement.dataset.board;
    else document.documentElement.dataset.board = prefs.boardTheme;
  }, [prefs]);

  useEffect(() => music.setEnabled(prefs.music), [prefs.music]);
  useEffect(() => music.setTrack(screen === 'game' ? 'game' : 'home'), [screen]);

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
    else if (last.captured) playCapture(last.captured);
    else playMove();
  }, [snapshot, resultText, prefs.sound, screen]);

  const top = opponentOf(player);
  const ongoing = snapshot.result.status === 'ongoing';
  const toMove = (color: Color) => ongoing && snapshot.turn === color;

  const inProgress: GameInProgress | null =
    snapshot.history.length > 0 && ongoing ? { ...settings, moveNumber: Math.floor(snapshot.history.length / 2) + 1 } : null;

  const closeHelp = () => {
    writeHelpSeen();
    setHelp(null);
  };

  /** Opens the board; the very first time, the rules come up before the first move. */
  const enterGame = () => {
    setScreen('game');
    if (!readHelpSeen()) setHelp('intro');
  };

  const startGame = (next: GameSettings) => {
    setNewGameOpen(false);
    game.newGame(next);
    enterGame();
  };

  // A draw by agreement adds no move, so its sound is played here rather than by the move sounds above.
  const offerDraw = () => {
    if (game.offerDraw() === 'accepted' && prefs.sound) playSound('draw');
  };

  const answerDraw = (accept: boolean) => {
    game.answerDraw(accept);
    if (accept && prefs.sound) playSound('draw');
  };

  const openStats = () => {
    setHistory(loadHistory());
    setStatsVisit((v) => v + 1);
    setScreen('stats');
  };

  const goHome = () => {
    setExitOpen(false);
    setScreen('home');
  };

  /** Leaving from the game screen: a game in progress asks whether to keep or resign it. */
  const exitGame = () => {
    if (ongoing && snapshot.history.length > 0) setExitOpen(true);
    else goHome();
  };

  const resignAndLeave = () => {
    game.resign();
    goHome();
  };

  /** From the result dialog: close it for good and go home. */
  const homeFromResult = () => {
    setDismissedAt(snapshot.history.length);
    goHome();
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
          initial={settings}
          onContinue={enterGame}
          onStart={startGame}
          onHelp={() => setHelp('asked')}
          onSettings={() => setSettingsOpen(true)}
          onResults={openStats}
          audio={<AudioToggles prefs={prefs} onChange={setPrefs} showSound={false} />}
        />
        {dialogs}
      </>
    );
  }

  if (screen === 'stats') {
    return (
      <StatsScreen
        key={statsVisit}
        history={history}
        onHome={() => setScreen('home')}
        audio={<AudioToggles prefs={prefs} onChange={setPrefs} showSound={false} />}
      />
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
            name={game.twoPlayer ? COLOR_NAMES[top] : 'Computer'}
            detail={game.twoPlayer ? undefined : settings.difficulty[0]!.toUpperCase() + settings.difficulty.slice(1)}
            color={top}
            pieces={snapshot.pieces.filter((p) => p.color === top)}
            toMove={toMove(top)}
            thinking={!game.twoPlayer && toMove(top)}
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
            interactive={game.isPlayerTurn && !game.autoMoving}
            nudging={game.notice?.tone === 'must'}
            onSquareClick={game.onSquareClick}
            onDragStart={game.select}
            onDrop={game.tryMove}
          />
          <PlayerStrip
            name={game.twoPlayer ? COLOR_NAMES[player] : 'You'}
            color={player}
            pieces={snapshot.pieces.filter((p) => p.color === player)}
            toMove={toMove(player)}
          />
        </section>

        <aside className="mx-auto w-full max-w-[36rem] lg:relative lg:max-w-none">
          <div className="flex flex-col gap-5 pt-2 lg:absolute lg:inset-0 lg:pt-16 lg:pb-14">
            <StatusLine
              result={resultText}
              waiting={!game.isPlayerTurn}
              mover={game.twoPlayer ? COLOR_NAMES[snapshot.turn] : null}
              forced={snapshot.forced}
              inCheck={snapshot.inCheck}
              autoMoving={game.autoMoving}
              drawOffer={game.drawOffer ? COLOR_NAMES[game.drawOffer] : null}
            />
            <GameNotice notice={game.notice} onDismiss={game.dismissNotice} />
            <p aria-live="polite" className="sr-only">
              {game.lastMove ? describeMove(game.lastMove, perspective) : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={game.undo} disabled={!game.canUndo}>
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 4 3 8l4 4" />
                  <path d="M3 8h9a5 5 0 0 1 0 10H9" />
                </svg>
                Undo move
              </Button>
              <AudioToggles prefs={prefs} onChange={setPrefs} showSound className="order-last ml-auto" />
              {ongoing && (
                <Button onClick={offerDraw} disabled={!game.canOfferDraw}>
                  <span aria-hidden="true" className="text-base leading-none font-extrabold">½</span>
                  Offer draw
                </Button>
              )}
              {resultText && (
                <Button variant="primary" onClick={() => game.newGame()}>
                  Play again
                </Button>
              )}
              <Button onClick={exitGame}>
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 4H4v12h4" />
                  <path d="M12 6l4 4-4 4M16 10H8" />
                </svg>
                Exit game
              </Button>
            </div>
            <div className="border-t border-line pt-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              <MoveHistory moves={snapshot.history} />
            </div>
          </div>
        </aside>
      </main>

      <PromotionPicker open={game.pendingPromotion !== null} color={snapshot.turn} onChoose={game.choosePromotion} />
      <DrawOfferDialog offeredBy={game.drawOffer} onAnswer={answerDraw} />
      <ExitGameDialog
        open={exitOpen}
        mover={game.twoPlayer ? COLOR_NAMES[snapshot.turn] : null}
        onKeep={goHome}
        onResign={resignAndLeave}
        onCancel={() => setExitOpen(false)}
      />
      <NewGameDialog
        key={newGameOpen ? 'open' : 'closed'}
        open={newGameOpen}
        initial={settings}
        onCancel={() => setNewGameOpen(false)}
        onStart={startGame}
      />
      {sceneOpen && resultText && (
        <ResultScene result={resultText} cast={sceneCast(snapshot, resultText, player)} revealed={revealed} onReveal={reveal} />
      )}
      <GameOverDialog
        result={resultText}
        open={sceneOpen && revealed}
        onClose={() => setDismissedAt(snapshot.history.length)}
        onPlayAgain={() => game.newGame()}
        onHome={homeFromResult}
      />
      {dialogs}
    </div>
  );
}
