/**
 * Captures the PWA manifest screenshots and the Microsoft Store listing
 * screenshots from a running preview server.
 *
 *   npm run build && npm run preview   (in another terminal)
 *   npm run screenshots -- [url]
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173';

/** Plays a short opening so the board shows forced captures and a filling move list. */
async function playOpening(page: Page): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Start new game' }).click();
  await page.getByRole('button', { name: 'Start playing' }).click();
  for (let i = 0; i < 5; i++) {
    await page.locator('#status').filter({ hasNotText: 'thinking' }).waitFor({ timeout: 30_000 });
    const status = (await page.locator('#status').textContent()) ?? '';
    if (/You win|You lose|Draw/.test(status)) break;
    if (i === 0) {
      await page.locator('button[aria-label^="e2,"]').click();
      await page.locator('button[aria-label^="e4,"]').click();
    } else {
      await page.locator('button[data-movable="true"]').first().click();
      await page.locator('button[aria-label$=" here"]').first().click();
    }
    await page.waitForTimeout(200);
  }
  await page.locator('#status').filter({ hasNotText: 'thinking' }).waitFor({ timeout: 30_000 });
  // Show the gold forced-capture marks by selecting a piece that must capture.
  const movable = page.locator('button[data-movable="true"]');
  if (await movable.count()) await movable.first().click();
  await page.waitForTimeout(400);
}

mkdirSync('public/screenshots', { recursive: true });
mkdirSync('store-assets/screenshots', { recursive: true });

const browser = await chromium.launch();
const shots: { file: string; width: number; height: number; scale: number; scheme: 'light' | 'dark'; home?: boolean }[] = [
  { file: 'store-assets/screenshots/home-dark-1920x1080.png', width: 1920, height: 1080, scale: 1, scheme: 'dark', home: true },
  { file: 'public/screenshots/wide.png', width: 1366, height: 768, scale: 1, scheme: 'light' },
  { file: 'public/screenshots/narrow.png', width: 390, height: 844, scale: 2, scheme: 'light' },
  { file: 'store-assets/screenshots/desktop-light-1920x1080.png', width: 1920, height: 1080, scale: 1, scheme: 'light' },
  { file: 'store-assets/screenshots/desktop-dark-1920x1080.png', width: 1920, height: 1080, scale: 1, scheme: 'dark' },
];
try {
  for (const s of shots) {
    const context = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: s.scale,
      colorScheme: s.scheme,
    });
    const page = await context.newPage();
    if (s.home) {
      // The home page once its landing animation has finished.
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(4500);
    } else {
      await playOpening(page);
    }
    await page.screenshot({ path: s.file });
    console.log(`wrote ${s.file}`);
    await context.close();
  }
} finally {
  await browser.close();
}
