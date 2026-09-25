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
  const target = page.locator('button[aria-label$="move here"]').first();
  const label = (await target.getAttribute('aria-label')) ?? '?';
  await target.click();
  const promo = page.getByRole('dialog', { name: 'Promote pawn to' });
  if (await promo.isVisible()) await promo.getByRole('button').first().click();
  return label;
}

async function waitForPlayerTurn(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const text = document.querySelector('[aria-live="polite"]')?.textContent ?? '';
      return !text.includes('thinking');
    },
    undefined,
    { timeout: 30_000 },
  );
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

    await page.getByRole('button', { name: 'Got it' }).click();

    await clickSquare(page, 'e2');
    await clickSquare(page, 'e4');
    await waitForPlayerTurn(page);
    await page.screenshot({ path: `${outDir}/${viewport.name}-2-after-e4.png` });

    for (let i = 0; i < 6; i++) {
      const status = (await page.locator('[aria-live="polite"]').textContent()) ?? '';
      if (!status.includes('Your move') && !status.includes('check')) break;
      const played = await playAnyMove(page);
      console.log(`[${viewport.name}] played: ${played}`);
      await waitForPlayerTurn(page);
    }
    await page.screenshot({ path: `${outDir}/${viewport.name}-3-midgame.png` });
    console.log(`[${viewport.name}] status:`, await page.locator('[aria-live="polite"]').textContent());
    await page.close();
  }
} finally {
  await browser.close();
}

if (errors.length > 0) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`OK. Screenshots in ${outDir}`);
