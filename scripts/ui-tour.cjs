const { chromium, devices } = require('playwright');
// UI review tour: screenshots every page on a phone (iPhone 13) and a laptop screen.
// Usage: npm run dev, then in another terminal: npm run ui:tour [-- <tag>]
// Needs Playwright with Chromium (not a project dependency: npm i -g playwright && npx playwright install chromium).
// Lichess is mocked with two finished games, which are imported and reviewed first.
const fs = require('node:fs');
const path = require('node:path');
const OUT = path.join(__dirname, '..', 'ui-shots') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:5173/';
const tag = process.argv[2] || new Date().toISOString().slice(0, 10);
const lichessGames = [
  { id: 'trap0001', rated: true, variant: 'standard', speed: 'blitz', createdAt: 1763400000000, lastMoveAt: 1763400300000, status: 'mate',
    players: { white: { user: { name: 'TestUser', id: 'testuser' }, rating: 1300 }, black: { user: { name: 'Trapper', id: 'trapper' }, rating: 1350 } },
    winner: 'black', opening: { name: 'Italian Game: Blackburne-Kostić Gambit' }, moves: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5 Nxf7 Qxg2 Rf1 Qxe4+ Be2 Nf3#' },
  { id: 'scholar1', rated: true, variant: 'standard', speed: 'rapid', createdAt: 1763300000000, lastMoveAt: 1763300200000, status: 'mate',
    players: { white: { user: { name: 'TestUser', id: 'testuser' }, rating: 1300 }, black: { user: { name: 'Victim', id: 'victim' }, rating: 1200 } },
    winner: 'white', opening: { name: "King's Pawn Game" }, moves: 'e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#' },
];
const waitStatus = (page, t) => page.waitForFunction(t => (document.querySelector('[data-testid=status]')?.textContent || '').startsWith(t), t, { timeout: 60000 });
async function tour(name, ctxOpts, browser) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route('https://lichess.org/api/games/user/**', r => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: lichessGames.map(g => JSON.stringify(g)).join('\n') }));
  const page = await ctx.newPage();
  const shot = async (n, full = false) => { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}${tag}-${name}-${n}.png`, fullPage: full }) };
  // Seed: import and review both games via Progress batch review
  await page.goto(BASE + '#/games');
  await page.getByLabel('Lichess username').fill('TestUser');
  await page.getByRole('button', { name: 'Import' }).click();
  await page.locator('.import-status').waitFor();
  await page.goto(BASE + '#/progress');
  await page.getByRole('button', { name: /Review them now/ }).click();
  await page.waitForFunction(() => !document.querySelector('.unreviewed') && !document.querySelector('.review-status-bar'), null, { timeout: 180000 });
  // Play screen mid-game
  await page.goto(BASE + '#/');
  await waitStatus(page, 'Your move');
  await shot('play-start');
  const sq = s => page.locator(`#play-board-board [data-square="${s}"]`);
  await sq('e2').click(); await sq('e4').click(); await waitStatus(page, 'Your move');
  await sq('g1').click(); await sq('f3').click(); await waitStatus(page, 'Your move');
  await shot('play-mid', true);
  await page.getByRole('button', { name: 'New', exact: true }).click(); await shot('newgame'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings' }).click(); await shot('settings'); await page.keyboard.press('Escape');
  await page.goto(BASE + '#/games'); await shot('games', true);
  await page.locator('.game-row').first().click(); await page.getByTestId('review-summary').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid=analysing]'), null, { timeout: 120000 });
  await shot('review-summary', true);
  await page.getByTestId('start-review').click(); await page.getByTestId('review-pos').waitFor();
  await shot('review', true);
  await page.getByRole('button', { name: 'Explore' }).click(); await page.waitForTimeout(2500); await shot('review-explore', false);
  await page.goto(BASE + '#/progress'); await shot('progress', true);
  await page.goto(BASE + '#/openings'); await page.getByTestId('opening-report').waitFor(); await shot('opening-report', true);
  await page.goto(BASE + '#/report'); await page.getByTestId('weekly-report').waitFor(); await shot('report', true);
  await page.goto(BASE + '#/train'); await page.getByTestId('train-plan').waitFor(); await shot('train', true);
  await page.goto(BASE + '#/train/puzzles'); await page.getByTestId('puzzle-card').waitFor(); await shot('puzzles', true);
  await page.goto(BASE + '#/train/vision'); await page.getByTestId('vision-list').waitFor(); await shot('vision', true);
  await page.goto(BASE + '#/train/vision-mixed'); await page.getByTestId('vision-question').waitFor(); await shot('vision-set', true);
  await page.goto(BASE + '#/train/lessons'); await page.getByTestId('lessons-card').waitFor(); await shot('lessons', true);
  await page.goto(BASE + '#/train/mistakes'); await page.getByTestId('mistake-patterns').waitFor(); await shot('mistakes', true);
  await page.getByTestId('start-today').click(); await page.getByTestId('mistake-card').waitFor(); await shot('mistake-session', true);
  await page.goto(BASE + '#/train/endgames'); await page.getByTestId('endgames').waitFor(); await shot('endgames', true);
  await page.goto(BASE + '#/train/openings'); await page.getByRole('searchbox', { name: 'Search openings' }).fill('Italian'); await shot('openings-lines', true);
  await page.locator('.line-row').first().getByRole('button', { name: 'Learn as White' }).click();
  await page.goto(BASE + '#/train/openings'); await page.getByTestId('opening-card').waitFor(); await shot('openings', true);
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  await tour('phone', { ...devices['iPhone 13'] }, browser);
  await tour('desk', { viewport: { width: 1280, height: 860 } }, browser);
  await browser.close();
  console.log(`Screenshots saved in ${OUT}`);
})();
