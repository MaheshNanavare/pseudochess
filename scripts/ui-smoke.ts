/**
 * Headless UI smoke test: loads the home page, starts a game, dismisses the
 * help screen, plays a few moves against the AI by clicking squares, and
 * saves screenshots.
 *
 * Start a server first (npm run build && npm run preview), then:
 *   npm run ui:smoke -- [url] [outDir]
 */
import { chromium, type Locator, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173';
const outDir = process.argv[3] ?? 'test-results/ui';
mkdirSync(outDir, { recursive: true });

async function clickSquare(page: Page, square: string): Promise<void> {
  await page.locator(`button[aria-label^="${square},"]`).click();
}

/** Plays the first legal move for the player: selects a movable piece, then its first target. */
async function playAnyMove(page: Page): Promise<string> {
  const movable = page.locator('button[data-movable="true"]');
  await movable.first().click();
  const target = page.locator('button[aria-label$=" here"]').first();
  const label = (await target.getAttribute('aria-label')) ?? '?';
  await target.click();
  const promo = page.getByRole('dialog', { name: 'Promote pawn to' });
  if (await promo.isVisible()) await promo.getByRole('button').first().click();
  return label;
}

/** From the home page into a fresh game; the rules show before the first game. */
async function startFromHome(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start new game' }).click();
  await page.getByRole('button', { name: 'Start playing' }).click();
}

async function waitForPlayerTurn(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const text = document.querySelector('#status')?.textContent ?? '';
      return !text.includes('thinking');
    },
    undefined,
    { timeout: 30_000 },
  );
}

function check(ok: boolean, what: string): void {
  if (!ok) errors.push(`[interactions] FAILED: ${what}`);
  console.log(`[interactions] ${ok ? 'ok  ' : 'FAIL'} ${what}`);
}

async function historyText(page: Page): Promise<string> {
  return (await page.locator('#moves-title').locator('..').textContent()) ?? '';
}

/** Drag and drop, keyboard play, resuming after reload, settings and the privacy page. */
async function checkInteractions(): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`[interactions] ${err.message}`));
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await startFromHome(page);

  // Drag the d2 pawn to d4 with the mouse.
  const box = async (sq: string) => (await page.locator(`button[aria-label^="${sq},"]`).boundingBox())!;
  const from = await box('d2');
  const to = await box('d4');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y - 20, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await waitForPlayerTurn(page);
  check((await historyText(page)).includes('d4'), 'drag and drop plays d2-d4');

  // Keyboard only: focus the board's tab stop, walk with arrows, Enter to pick and to move.
  const movable = page.locator('button[data-movable="true"]').first();
  const fromSquare = (await movable.getAttribute('data-square'))!;
  await movable.focus();
  await page.keyboard.press('Enter');
  const target = page.locator('button[aria-label$=" here"]').first();
  const toSquare = (await target.getAttribute('data-square'))!;
  await target.focus();
  await page.keyboard.press('Enter');
  await waitForPlayerTurn(page);
  check((await historyText(page)).includes(toSquare), `keyboard plays ${fromSquare}-${toSquare}`);
  await page.locator('[data-square="e4"]').focus();
  await page.keyboard.press('ArrowUp');
  check((await page.evaluate(() => document.activeElement?.getAttribute('data-square'))) === 'e5', 'arrow keys move focus between squares');

  // Resume after reload: the app opens on Home, which offers to continue.
  const before = await historyText(page);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Continue game/ }).click();
  check((await historyText(page)) === before, 'game resumes after reload');

  // Home and back.
  await page.getByRole('button', { name: 'Home' }).click();
  check(await page.getByRole('heading', { name: 'New game' }).isVisible(), 'home button opens the home page');
  await page.getByRole('button', { name: /Continue game/ }).click();
  check((await historyText(page)) === before, 'continue returns to the same game');

  // Settings: board theme persists.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByText('Ocean', { exact: true }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  check((await page.evaluate(() => document.documentElement.dataset.board)) === 'ocean', 'board theme applies');
  await page.screenshot({ path: `${outDir}/interactions-ocean.png` });
  await page.reload();
  await page.waitForLoadState('networkidle');
  check((await page.evaluate(() => document.documentElement.dataset.board)) === 'ocean', 'board theme persists');

  // Privacy page.
  await page.goto(new URL('privacy.html', url).toString());
  check((await page.locator('h1').textContent()) === 'Privacy policy', 'privacy page loads');
  await context.close();
}

/** Two players on one device, and the note that explains a refused move when a capture is forced. */
async function checkTwoPlayerAndForcedNote(): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`[two-player] ${err.message}`));
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.getByText('A friend', { exact: true }).click();
  await startFromHome(page);
  const status = async () => (await page.locator('#status').textContent()) ?? '';

  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  check((await status()).includes('Black to move'), 'two players: Black moves next, no computer');
  await clickSquare(page, 'd7');
  await clickSquare(page, 'd5');
  check((await status()).includes('White must capture'), 'two players: White must capture');

  const note = page.getByRole('alert');
  await clickSquare(page, 'g1');
  check((await note.textContent())?.includes('knight on g1 has to wait') ?? false, 'note when picking a piece that cannot capture');
  await page.waitForTimeout(400); // let the note finish dropping in
  check(await clearOfBoard(page, note), 'the note does not cover the board');
  await page.screenshot({ path: `${outDir}/two-player-note.png`, fullPage: true });
  await clickSquare(page, 'e4');
  check(!(await note.isVisible()), 'note clears when the capturing piece is picked');
  await clickSquare(page, 'e5');
  check((await note.textContent())?.includes("can't move to e5") ?? false, 'note when putting the capturer on a quiet square');
  await clickSquare(page, 'd5');
  check((await historyText(page)).includes('exd5') && !(await note.isVisible()), 'the piece stays in hand, so the capture still plays');

  await page.getByRole('button', { name: 'Undo move' }).click();
  check(!(await historyText(page)).includes('exd5') && (await historyText(page)).includes('d5'), 'two players: undo takes back one move');

  const offer = page.getByRole('button', { name: 'Offer draw' });
  await offer.click();
  const answer = page.getByRole('dialog', { name: 'White offers a draw' });
  check(await answer.isVisible(), 'two players: a draw offer asks the other player');
  await answer.getByRole('button', { name: 'Decline' }).click();
  check(await offer.isDisabled(), 'after a declined offer, no new offer until a move is played');

  await page.getByRole('button', { name: 'Home' }).click();
  check((await page.getByRole('button', { name: /Continue game/ }).textContent())?.includes('two players') ?? false, 'home offers to continue the two-player game');
  await context.close();
}

/** True when the element and the board do not overlap on screen. */
async function clearOfBoard(page: Page, el: Locator): Promise<boolean> {
  const a = await el.boundingBox();
  const b = await page.getByRole('group', { name: /Chess board/ }).boundingBox();
  if (!a || !b) return false;
  return a.x >= b.x + b.width || b.x >= a.x + a.width || a.y >= b.y + b.height || b.y >= a.y + a.height;
}

/** Draw offers against the computer and between two players, the only-move autoplay, and music. */
async function checkDrawsAutoMoveAndMusic(): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    localStorage.setItem('pseudochess.helpSeen', '1');
    localStorage.setItem('pseudochess.prefs', JSON.stringify({ autoMove: true }));
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`[draws] ${err.message}`));
  const audio: string[] = [];
  page.on('requestfinished', (req) => {
    if (req.url().includes('/audio/')) audio.push(new URL(req.url()).pathname);
  });
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  check(audio.length === 0, 'no music before the first interaction');
  await page.mouse.click(5, 5);
  await page.waitForTimeout(1500);
  check(audio.includes('/audio/home.mp3'), 'home music starts after the first interaction');

  // Against the computer at the start: pieces everywhere, so the draw is declined.
  await page.getByRole('button', { name: 'Start new game' }).click();
  await page.getByRole('button', { name: 'Offer draw' }).click();
  const notice = page.getByRole('alert');
  check((await notice.textContent())?.includes('Draw declined') ?? false, 'the computer declines a draw with pieces on the board');
  check(await clearOfBoard(page, notice), 'the draw notice does not cover the board');
  await page.waitForTimeout(1500);
  check(audio.includes('/audio/game.mp3'), 'game music plays on the game screen');

  // Quick mute buttons beside the game controls, remembered in preferences.
  const prefs = () => page.evaluate(() => JSON.parse(localStorage.getItem('pseudochess.prefs') ?? '{}') as { music?: boolean; sound?: boolean });
  const musicButton = page.getByRole('button', { name: 'Music', exact: true });
  const soundButton = page.getByRole('button', { name: 'Sound effects', exact: true });
  await musicButton.click();
  await soundButton.click();
  const muted = await prefs();
  check(muted.music === false && muted.sound === false && (await musicButton.getAttribute('aria-pressed')) === 'false', 'music and sound effects mute from the game screen');
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  check((await prefs()).music === true, 'music unmutes from the home screen');
  await page.getByRole('button', { name: 'Start new game' }).click(); // no moves yet, so no Continue
  await soundButton.click();

  // Two players: after 1.e4 d5 the only legal move, exd5, is played automatically.
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await dialog.getByText('A friend', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Start game' }).click();
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await clickSquare(page, 'd7');
  await clickSquare(page, 'd5');
  // Then Black's only legal move is Qxd5, which is played for Black too.
  await page.waitForFunction(() => document.querySelector('#moves-title')?.parentElement?.textContent?.includes('Qxd5'), undefined, { timeout: 5000 });
  check(true, 'the only legal move is played automatically for each side when the setting is on');

  await page.getByRole('button', { name: 'Offer draw' }).click();
  await page.getByRole('dialog', { name: 'White offers a draw' }).getByRole('button', { name: 'Accept draw' }).click();
  // The end scene plays first (about 3 s), then the result dialog opens.
  await page.getByRole('heading', { name: 'Draw' }).waitFor({ timeout: 6000 });
  check(true, 'two players: an accepted offer ends the game in a draw, after the end scene');
  await page.getByRole('dialog').getByRole('button', { name: 'Home', exact: true }).click();
  check(await page.getByRole('heading', { name: 'New game' }).isVisible(), 'the result dialog has a way home');
  await context.close();
}

/** Leaving a game (keep or resign), and the results page with its shuffled tips. */
async function checkExitAndResults(): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem('pseudochess.helpSeen', '1'));
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(`[results] ${err.message}`));
  await page.goto(url);
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Your results' }).click();
  check((await page.locator('main').textContent())?.includes('No finished games yet') ?? false, 'results page explains when there are no games');
  const tips = async () => (await page.getByRole('complementary').locator('li').allTextContents()).join('|');
  const firstTips = await tips();
  await page.getByRole('button', { name: 'Home', exact: true }).click();

  await page.getByRole('button', { name: 'Start new game' }).click();
  await clickSquare(page, 'e2');
  await clickSquare(page, 'e4');
  await waitForPlayerTurn(page);
  await page.getByRole('button', { name: 'Exit game' }).click();
  const exit = page.getByRole('dialog', { name: 'Leave this game?' });
  await exit.getByRole('button', { name: 'Keep and go home' }).click();
  check(await page.getByRole('button', { name: /Continue game/ }).isVisible(), 'keeping a game on exit offers to continue it');

  await page.getByRole('button', { name: /Continue game/ }).click();
  await page.getByRole('button', { name: 'Exit game' }).click();
  await exit.getByRole('button', { name: 'Resign' }).click();
  check(!(await page.getByRole('button', { name: /Continue game/ }).isVisible()), 'resigning ends the game');

  await page.getByRole('button', { name: 'Your results' }).click();
  const main = (await page.locator('main').textContent()) ?? '';
  check(main.includes('Loss') && main.includes('Resigned') && main.includes('1 game'), 'the resigned game is recorded as a loss');
  await page.screenshot({ path: `${outDir}/results.png`, fullPage: true });
  const reshuffled = (await tips()) !== firstTips;
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Your results' }).click();
  check(reshuffled || (await tips()) !== firstTips, 'tips reshuffle on each visit');
  await context.close();
}

const browser = await chromium.launch({ headless: true });
const errors: string[] = [];
try {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'phone', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`[${viewport.name}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`[${viewport.name}] ${err.message}`));

    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(4500); // let the landing animation finish
    await page.screenshot({ path: `${outDir}/${viewport.name}-1-home.png` });

    // Reconnaissance: list the interactive elements we can see.
    const buttons = await page.getByRole('button').allInnerTexts();
    console.log(`[${viewport.name}] buttons:`, buttons.filter((t) => t.trim()).slice(0, 12));

    await startFromHome(page);

    await clickSquare(page, 'e2');
    await clickSquare(page, 'e4');
    await waitForPlayerTurn(page);
    await page.screenshot({ path: `${outDir}/${viewport.name}-2-after-e4.png` });

    for (let i = 0; i < 6; i++) {
      const status = (await page.locator('#status').textContent()) ?? '';
      if (/thinking|You win|You lose|Draw/.test(status)) break;
      const played = await playAnyMove(page);
      console.log(`[${viewport.name}] played: ${played}`);
      await waitForPlayerTurn(page);
    }
    await page.screenshot({ path: `${outDir}/${viewport.name}-3-midgame.png` });
    console.log(`[${viewport.name}] status:`, await page.locator('#status').textContent());
    await page.close();
  }
  await checkInteractions();
  await checkTwoPlayerAndForcedNote();
  await checkDrawsAutoMoveAndMusic();
  await checkExitAndResults();
} finally {
  await browser.close();
}

if (errors.length > 0) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`OK. Screenshots in ${outDir}`);
