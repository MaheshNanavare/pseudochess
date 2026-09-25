/**
 * Headless UI smoke test: loads the app, dismisses the help screen, plays a
 * few moves against the AI by clicking squares, and saves screenshots.
 *
 * Start a server first (npm run build && npm run preview), then:
 *   npm run ui:smoke -- [url] [outDir]
 */
import { chromium, type Page } from 'playwright';
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
  await page.getByRole('button', { name: 'Start playing' }).click();

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

  // Resume after reload.
  const before = await historyText(page);
  await page.reload();
  await page.waitForLoadState('networkidle');
  check((await historyText(page)) === before, 'game resumes after reload');

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
    await page.screenshot({ path: `${outDir}/${viewport.name}-1-help.png` });

    // Reconnaissance: list the interactive elements we can see.
    const buttons = await page.getByRole('button').allInnerTexts();
    console.log(`[${viewport.name}] buttons:`, buttons.filter((t) => t.trim()).slice(0, 12));

    await page.getByRole('button', { name: 'Start playing' }).click();

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
} finally {
  await browser.close();
}

if (errors.length > 0) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`OK. Screenshots in ${outDir}`);
