import { useEffect, useState, type ReactNode } from 'react';
import type { Difficulty } from '../../engine/types';
import { LEVELS, nextTip, outcomeFor, reasonText, summarize, TIPS, winRate, type Tally } from '../stats';
import { HISTORY_LIMIT, loadTipIndex, saveTipIndex, type GameRecord } from '../storage';
import { COLOR_NAMES } from '../text';
import { Button } from './Button';
import { Wordmark } from './Wordmark';

const LEVEL_NAMES: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const SEGMENTS = [
  { key: 'win', label: 'won', fill: 'bg-jade' },
  { key: 'draw', label: 'drawn', fill: 'bg-stat-draw' },
  { key: 'loss', label: 'lost', fill: 'bg-stat-loss' },
] as const;

const OUTCOME_TEXT = {
  win: { word: 'Win', tone: 'text-jade' },
  loss: { word: 'Loss', tone: 'text-rose' },
  draw: { word: 'Draw', tone: 'text-muted' },
} as const;

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Won, drawn and lost as one bar, with 2 px gaps between the parts; counts are spelled out beside it. */
function TallyBar({ tally }: { tally: Tally }) {
  const games = tally.win + tally.draw + tally.loss;
  if (games === 0) return <div className="h-3 rounded-full bg-surface" />;
  return (
    <div className="flex h-3 gap-0.5">
      {SEGMENTS.filter((s) => tally[s.key] > 0).map((s) => (
        <div
          key={s.key}
          title={`${tally[s.key]} of ${games} ${s.label}`}
          className={`h-full rounded-[4px] ${s.fill}`}
          style={{ flexGrow: tally[s.key] }}
        />
      ))}
    </div>
  );
}

function LevelRow({ level, tally }: { level: Difficulty; tally: Tally }) {
  const games = tally.win + tally.draw + tally.loss;
  const rate = winRate(tally);
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-bold">
          {LEVEL_NAMES[level]}
          <span className="ml-2 text-sm font-normal text-muted">
            {games} {games === 1 ? 'game' : 'games'}
          </span>
        </p>
        <p className="text-sm text-muted">{rate === null ? 'Not played yet' : `${rate}% won`}</p>
      </div>
      <div className="mt-2">
        <TallyBar tally={tally} />
      </div>
      {games > 0 && (
        <p className="mt-1.5 text-sm text-muted">
          {tally.win} won, {tally.draw} drawn, {tally.loss} lost
        </p>
      )}
    </li>
  );
}

function GameRow({ record }: { record: GameRecord }) {
  const outcome = outcomeFor(record);
  const r = record.result;
  const result =
    outcome !== null
      ? OUTCOME_TEXT[outcome]
      : r.status === 'draw'
        ? OUTCOME_TEXT.draw
        : { word: `${COLOR_NAMES[r.winner]} won`, tone: 'text-ink' };
  const against = record.opponent === 'human' ? 'Two players' : `Computer, ${LEVEL_NAMES[record.difficulty].toLowerCase()}`;
  return (
    <li className="grid grid-cols-[5rem_1fr_auto] items-baseline gap-x-3 py-2.5">
      <span className={`font-bold ${result.tone}`}>{result.word}</span>
      <span className="min-w-0">
        <span className="block truncate">{against}</span>
        <span className="block text-sm text-muted">
          {reasonText(record)}, {Math.ceil(record.plies / 2)} moves
        </span>
      </span>
      <time dateTime={new Date(record.endedAt).toISOString()} className="text-right text-sm text-muted tabular-nums">
        {dateFormat.format(record.endedAt)}
      </time>
    </li>
  );
}

interface StatsScreenProps {
  history: GameRecord[];
  onHome: () => void;
  audio: ReactNode;
}

/** Results of the last games, by computer level, with one tip to win at a time. */
export function StatsScreen({ history, onHome, audio }: StatsScreenProps) {
  const [tip, setTip] = useState(() => loadTipIndex() % TIPS.length);
  // The next visit opens on the tip after the last one seen here.
  useEffect(() => saveTipIndex(nextTip(tip)), [tip]);
  const summary = summarize(history);
  const two = summary.twoPlayer;
  const twoGames = two.white + two.black + two.draw;

  return (
    <div className="min-h-dvh animate-enter">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 pt-4 pb-2 sm:px-6 lg:pt-6">
        <Wordmark />
        <nav aria-label="Results menu" className="flex items-center gap-1.5">
          {audio}
          <Button onClick={onHome}>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5 10 3.5l7 6" />
              <path d="M5 8v8.5h10V8" />
            </svg>
            Home
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight [font-stretch:80%]">Your results</h1>
        <p className="mt-2 text-muted">
          {history.length === 0 ? 'No finished games yet. Your last ' + HISTORY_LIMIT + ' results will appear here.' : `Your last ${history.length} finished ${history.length === 1 ? 'game' : 'games'} (up to ${HISTORY_LIMIT} are kept).`}
        </p>

        <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <div className="lg:col-start-1">
            <section aria-labelledby="vs-computer">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="vs-computer" className="text-xl font-extrabold [font-stretch:85%]">
                  Against the computer
                </h2>
                <ul aria-label="Key" className="flex gap-3 text-sm text-muted">
                  {SEGMENTS.map((s) => (
                    <li key={s.key} className="flex items-center gap-1.5">
                      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-[3px] ${s.fill}`} />
                      {s.label[0]!.toUpperCase() + s.label.slice(1)}
                    </li>
                  ))}
                </ul>
              </div>
              <ul className="mt-1 divide-y divide-line">
                {LEVELS.map((level) => (
                  <LevelRow key={level} level={level} tally={summary.byLevel[level]} />
                ))}
              </ul>
            </section>

            {twoGames > 0 && (
              <section aria-labelledby="two-players" className="mt-8">
                <h2 id="two-players" className="text-xl font-extrabold [font-stretch:85%]">
                  Two players
                </h2>
                <p className="mt-2">
                  {twoGames} {twoGames === 1 ? 'game' : 'games'}: White won {two.white}, Black won {two.black}, {two.draw} drawn.
                </p>
              </section>
            )}
          </div>

          <aside aria-labelledby="tips" className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <h2 id="tips" className="text-xl font-extrabold [font-stretch:85%]">
              Tips to win
            </h2>
            {/* Every tip shares one grid cell and all but the current one are invisible,
                so the card is as tall as the longest tip and the button never moves. */}
            <div className="mt-3 grid rounded-xl bg-surface p-4 leading-snug">
              {TIPS.map((text) => (
                <p key={text} aria-hidden="true" className="invisible col-start-1 row-start-1">
                  {text}
                </p>
              ))}
              <p aria-live="polite" className="col-start-1 row-start-1">
                <span key={tip} className="block animate-enter">
                  {TIPS[tip]}
                </span>
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={() => setTip(nextTip)}>Next tip</Button>
            </div>
          </aside>

          {history.length > 0 && (
            <div className="lg:col-start-1">
              <section aria-labelledby="recent">
                <h2 id="recent" className="text-xl font-extrabold [font-stretch:85%]">
                  Recent games
                </h2>
                <ol className="mt-2 divide-y divide-line">
                  {history.map((record) => (
                    <GameRow key={record.id} record={record} />
                  ))}
                </ol>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
