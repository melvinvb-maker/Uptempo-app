// Smoke test for the UPTEMPO app: serves the repository, opens it in Chromium and walks
// through the main features. Exits with code 1 and a list of failures when anything breaks.
//
// Run: cd tests && npm install && npx playwright install chromium && npm run smoke
// Festival times are Dutch local times: compute them in the same time zone as the browser below.
process.env.TZ = 'Europe/Amsterdam';
import http from 'node:http';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright');
const failures = [];
const check = (ok, message) => { console.log((ok ? '  ok   ' : '  FAIL ') + message); if (!ok) failures.push(message); };

// --- 1. Every photo the code refers to exists ---
console.log('Photos');
const photoSources = ['timetable-photos.js', 'auto-photos.js', 'artists.js'];
const referenced = new Set();
for (const file of photoSources) {
  const text = await readFile(path.join(ROOT, file), 'utf8');
  for (const match of text.matchAll(/images\/acts\/[\w\-/]+\.webp/g)) referenced.add(match[0]);
}
const missing = [];
for (const file of referenced) await access(path.join(ROOT, file)).catch(() => missing.push(file));
check(missing.length === 0, `${referenced.size} referenced photos exist${missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''}`);

// --- 2. Pick a festival day with timed sets on at least two stages ---
const { bundledLineups } = await import(path.join(ROOT, 'festival-data.js'));
const { scheduledSets, setKey } = await import(path.join(ROOT, 'planning.js'));
const { normalizeFestivalName } = await import(path.join(ROOT, 'utils.js'));
// Same order and choice as the app: sorted by date, the first edition on or after today with set times.
const editions = bundledLineups
  .filter(edition => edition.date)
  .map(edition => ({ ...edition, name: edition.festival, key: 'catalog:' + normalizeFestivalName(edition.festival) }))
  .sort((x, y) => x.date.localeCompare(y.date));
const appChoice = day => editions.find(edition => (edition.dateEnd || edition.date) >= day && (edition.lineup || []).some(set => set.start));
const festival = editions.find(edition => new Set(scheduledSets(edition).map(set => set.stage)).size > 1 && appChoice(edition.date) === edition);
if (!festival) throw new Error('No bundled festival with timed sets on two stages');
const sets = scheduledSets(festival);
const now = new Date(sets[0].start.getTime() + 30 * 60000);
console.log(`Festival day: ${festival.festival} at ${now.toString().slice(0, 21)}`);

// --- 3. Serve the repository ---
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  const file = path.join(ROOT, decodeURIComponent(request.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(ROOT)) { response.writeHead(403); return response.end(); }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, timezoneId: 'Europe/Amsterdam' });
  // Outside services (Firebase, festival images) are not needed for these checks.
  await context.route(url => !url.href.startsWith('http://127.0.0.1'), route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: now });

  // --- 4. All tabs open ---
  console.log('Tabs');
  await page.goto(url);
  await page.waitForSelector('.tab');
  for (const tab of ['Home', 'Festivals', 'Agenda', 'Meer']) {
    await page.click(`.tab:has-text("${tab}")`);
    await page.waitForTimeout(300);
    check(await page.$eval('.screen.active', el => el.innerText.trim().length > 0), `${tab} shows content`);
  }

  console.log('Profile');
  await page.click('.tab:has-text("Meer")');
  await page.click('.menuTile[data-tab="profile"]');
  await page.waitForSelector('#profile.active');
  check(await page.$('#profile.active #groupSlot #createGroupBtn') !== null, 'profile page shows the group options');
  check(await page.$('#profile.active #accountForm') !== null, 'profile page keeps the account form');

  // --- 5. Timetable on the festival day ---
  console.log('Timetable');
  // The line-up has no tab of its own: it opens from the festival list.
  await page.click('.tab:has-text("Festivals")');
  await page.locator('.screen.active .festivalOpen', { hasText: festival.festival }).first().click();
  await page.waitForSelector('#planPanel');
  check(await page.$eval('.tab.active', tab => tab.textContent.trim()) === 'Festivals', 'Festivals tab stays highlighted on the line-up');
  check((await page.textContent('#planPanel')).includes('Nu & straks'), '"Nu & straks" appears on the festival day');

  const [a, b] = (() => {
    for (const first of sets) for (const second of sets) {
      if (first.stage !== second.stage && first.start < second.end && second.start < first.end) return [first, second];
    }
    return [sets[0], sets.find(set => set.stage !== sets[0].stage)];
  })();
  const overlap = a.start < b.end && b.start < a.end;
  check((await page.textContent('.lineup-hero h2')).trim() === festival.festival, `timetable opens on ${festival.festival}`);
  for (const set of [a, b]) {
    const key = setKey(festival, set.item);
    await page.locator('.artistSlot').filter({ has: page.locator('strong', { hasText: set.item.artist }) })
      .and(page.locator(`[data-set-key="${key.replace(/"/g, '\\"')}"]`)).first().click();
  }
  await page.waitForTimeout(300);
  const panel = await page.textContent('#planPanel');
  if (overlap) check(panel.includes('Overlap in je favorieten'), 'overlapping favourites are reported');
  check(panel.includes('In mijn agenda (2)'), 'agenda button counts two favourites');

  const [calendar] = await Promise.all([page.waitForEvent('download'), page.click('[data-export-agenda]')]);
  const ics = await readFile(await calendar.path(), 'utf8');
  check((ics.match(/BEGIN:VEVENT/g) || []).length === 2 && ics.includes('TRIGGER:-PT15M'), 'calendar file has two events with reminders');
  check(ics.includes('DTSTART:' + a.start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')), 'calendar times match the line-up');

  const [image] = await Promise.all([page.waitForEvent('download'), page.click('[data-share-plan]')]);
  const png = await readFile(await image.path());
  check(png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1920, 'plan image is 1080x1920');

  // Saving offline puts the timetable on the Meer page, and the link opens it.
  await page.click('[data-download-timetable]');
  await page.click('.tab:has-text("Meer")');
  const saved = page.locator('#offlineList a', { hasText: festival.festival });
  check(await saved.count() === 1, 'saved timetable is listed on the Meer page');
  await saved.click();
  await page.waitForSelector('#reader:not([hidden]) iframe', { timeout: 5000 }).catch(() => {});
  check(await page.$('#reader:not([hidden]) iframe') !== null, 'the link opens the saved timetable');
  await page.goBack();
  await page.waitForSelector('.tab');
  await page.locator('.tab', { hasText: 'Festivals' }).click();
  await page.locator('.screen.active .festivalOpen', { hasText: festival.festival }).first().click();
  await page.waitForSelector('#planPanel');

  // --- 6. Artist dialog ---
  console.log('Artist dialog');
  await page.click('.profileList summary');
  await page.click('.profileList [data-artist-info]');
  await page.waitForSelector('#artistDialog[open]');
  check((await page.textContent('#artistDialog h2')).trim().length > 0, 'artist dialog opens with a name');
  await page.keyboard.press('Escape');

  // --- 7. Damaged storage and no connection ---
  console.log('Resilience');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.evaluate(() => { localStorage.festivals = '{broken'; localStorage.uptempoFavoriteSets = 'nope'; });
  await page.reload();
  await page.waitForSelector('.tab');
  check(await page.$$eval('.tab', tabs => tabs.length) === 4, 'app starts with damaged storage');
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.tab', { timeout: 10000 }).catch(() => {});
  check(await page.$$eval('.tab', tabs => tabs.length) === 4, 'app starts without a connection');

  check(errors.length === 0, 'no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
