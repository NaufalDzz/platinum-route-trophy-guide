#!/usr/bin/env node
// End-to-end checks in Chromium: offline (no non-localhost request), no console errors, the official list rendered
// exactly, saved progress, export/import, live filter counts, the Spoiler Shield, search and keyboard, and a header
// that neither overlaps nor clips at three window sizes. Usage: node tools/test.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, serveApp, openBrowser, waitReady } from './browserKit.mjs';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const official = JSON.parse(execFileSync('git', ['show', 'bf92d33:app/data/trophies.json'], { cwd: ROOT, encoding: 'utf8' })).trophies;
const data = JSON.parse(readFileSync(join(ROOT, 'app/data/trophies.json'), 'utf8')).trophies;

const server = await serveApp();
const { browser, newPage, problems, blocked } = await openBrowser();

async function freshPage(viewport = { width: 1280, height: 800 }) {
  const { context, page } = await newPage({ viewport, acceptDownloads: true });
  page.on('dialog', (d) => d.accept());
  await page.goto(server.url + '/');
  await waitReady(page);
  return { context, page };
}
const rowIds = (page) => page.$$eval('#trophy-list li[data-id]', (rows) => rows.map((r) => Number(r.dataset.id)));
const chipCount = (page, id) => page.$eval(`#filter-chips [data-filter="${id}"] .n`, (n) => Number(n.textContent));
const pickFilter = (page, id) => page.click(`#filter-chips [data-filter="${id}"]`);

try {
  // 1. Official data, rendered exactly, with the shield off.
  {
    const { context, page } = await freshPage();
    check('data file holds 55 trophies', data.length === 55, `${data.length}`);
    const mismatched = official.filter((o) => {
      const t = data.find((x) => x.id === o.id);
      return !t || t.name !== o.name || t.description !== o.description || t.grade !== o.grade;
    });
    check('names, descriptions and grades match the official list exactly', mismatched.length === 0, mismatched.map((m) => m.name).join(', '));
    await page.click('.spoiler-switch');
    const rendered = await page.$$eval('#trophy-list li[data-id]', (rows) =>
      rows.map((r) => ({ id: Number(r.dataset.id), name: r.querySelector('.row-name').textContent, desc: r.querySelector('.row-desc').textContent, grade: r.querySelector('.grade').title })),
    );
    const wrong = official.filter((o) => {
      const r = rendered.find((x) => x.id === o.id);
      return !r || r.name !== o.name || r.desc !== o.description || r.grade !== o.grade;
    });
    check('checklist renders all 55 official rows verbatim (shield off)', rendered.length === 55 && wrong.length === 0, `${rendered.length} rows, ${wrong.length} differ`);
    const blank = data.filter((t) => !t.guide.trim() || !t.steps.length || t.steps.some((s) => !s.c.length));
    check('every trophy has a guide and cited steps', blank.length === 0);
    await context.close();
  }

  // 2. Saved progress: a checkbox and a counter survive a reload.
  {
    const { context, page } = await freshPage();
    await page.click('#trophy-list [data-check="16"]');
    await page.click('#trophy-list li[data-id="28"]');
    await page.click('#trophy-detail [data-step="1"]');
    await page.click('#trophy-detail [data-step="1"]');
    await page.reload();
    await waitReady(page);
    const checked = await page.$eval('#trophy-list [data-check="16"]', (c) => c.checked);
    const count = await page.$eval('#trophy-detail .counter-input', (i) => Number(i.value));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('platinum-route.gta6.v1')));
    check('earned checkbox persists across reload', checked && stored.earned.includes(16));
    check('counter persists across reload', count === 2 && stored.counters['28'] === 2, `count ${count}`);
    const header = await page.$eval('#header-progress .hp-count', (e) => e.textContent);
    check('header progress counts the earned trophy', /^1\b/.test(header.trim()), header.trim());

    // 3. Export, reset, import back, then a bad file.
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
    const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
    check('export writes earned trophies and counters', exported.format === 'platinum-route-progress' && exported.earned.some((e) => e.id === 16) && exported.counters['28'] === 2);
    await page.click('#reset-btn');
    const afterReset = await page.evaluate(() => JSON.parse(localStorage.getItem('platinum-route.gta6.v1')).earned.length);
    check('reset clears progress', afterReset === 0);
    const dir = mkdtempSync(join(tmpdir(), 'pr-test-'));
    const good = join(dir, 'good.json');
    writeFileSync(good, JSON.stringify({ ...exported, earned: [...exported.earned, { id: 999, name: 'Nope' }] }));
    await page.setInputFiles('#import-file', good);
    await page.waitForFunction(() => !document.getElementById('toast').hidden);
    const toast = await page.$eval('#toast', (t) => t.textContent);
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('platinum-route.gta6.v1')));
    check('import restores progress with a validation summary', restored.earned.includes(16) && restored.counters['28'] === 2 && /Validated .* 1 skipped/.test(toast), toast);
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify({ format: 'something-else', earned: [1, 2, 3] }));
    await page.setInputFiles('#import-file', bad);
    await page.waitForFunction(() => /refused/.test(document.getElementById('toast').textContent));
    const still = await page.evaluate(() => JSON.parse(localStorage.getItem('platinum-route.gta6.v1')).earned);
    check('invalid import is refused and changes nothing', still.includes(16) && !still.includes(1));
    await page.click('#nav-tabs [data-view="sources"]');
    await page.waitForSelector('.import-result');
    const panel = await page.$eval('.import-result', (e) => e.textContent);
    check('backup panel shows the last validation summary', /refused/i.test(panel));
    await context.close();
  }

  // 4. Live filter counts match the data, and Online shows 0 with a note.
  {
    const { context, page } = await freshPage();
    await page.click('.spoiler-switch');
    const expected = {
      all: 55,
      story: data.filter((t) => t.kind === 'story').length,
      missable: data.filter((t) => t.risk !== 'safe').length,
      collectible: data.filter((t) => t.kind === 'collectible').length,
      activity: data.filter((t) => t.kind === 'activity').length,
      hidden: 28,
      disputed: data.filter((t) => (t.disputes ?? []).length).length,
      online: 0,
      'grade-platinum': 1,
      'grade-gold': 2,
      'grade-silver': 6,
      'grade-bronze': 46,
    };
    for (const [id, n] of Object.entries(expected)) {
      const shown = await chipCount(page, id);
      await pickFilter(page, id);
      const rows = (await rowIds(page)).length;
      check(`filter "${id}" count ${n}`, shown === n && rows === n, `chip ${shown}, rows ${rows}`);
    }
    await pickFilter(page, 'online');
    const note = await page.$eval('#trophy-list', (l) => l.textContent);
    check('Online filter explains there are no online trophies', /0 online trophies/i.test(note));
    await pickFilter(page, 'all');
    await page.click('#trophy-list [data-check="2"]');
    check('Earned/Remaining counts update live', (await chipCount(page, 'earned')) === 1 && (await chipCount(page, 'remaining')) === 54);
    await context.close();
  }

  // 5. Spoiler Shield.
  {
    const { context, page } = await freshPage();
    const nameOf = (id) => page.$eval(`#trophy-list li[data-id="${id}"] .row-name`, (e) => e.textContent);
    const shieldOn = await page.$eval('#spoiler-toggle', (c) => c.checked);
    check('Spoiler Shield is on by default', shieldOn);
    const story = data.find((t) => t.id === 9);
    const hiddenSide = data.find((t) => t.id === 47);
    check('unearned story trophy is masked', !(await nameOf(9)).includes(story.name), await nameOf(9));
    check('unearned PSN-hidden trophy is masked', !(await nameOf(47)).includes(hiddenSide.name), await nameOf(47));
    const listText = await page.$eval('#trophy-list', (l) => l.textContent);
    check('masked names never appear anywhere in the list', !listText.includes(story.name) && !listText.includes('Snow Storm'));
    await page.click('#trophy-list [data-check="9"]');
    check('earning a story trophy reveals it', (await nameOf(9)) === story.name);
    await page.click('.spoiler-switch');
    check('turning the shield off reveals every trophy', (await nameOf(47)) === hiddenSide.name);
    await context.close();
  }

  // 6. Search and keyboard shortcuts.
  {
    const { context, page } = await freshPage();
    await page.click('.spoiler-switch');
    await page.click('#app-header .brand');
    await page.keyboard.press('/');
    check('"/" focuses the search box', await page.evaluate(() => document.activeElement.id === 'search-input'));
    await page.keyboard.type('bowling');
    const found = await rowIds(page);
    check('search finds trophies by guide text', found.includes(46) && found.includes(51) === false, `rows ${found.join(',')}`);
    await page.keyboard.press('Escape');
    check('Escape clears the search and restores the list', (await rowIds(page)).length === 55, `${(await rowIds(page)).length} rows`);
    await page.click('#app-header .brand');
    const before = await page.$eval('#trophy-list .is-selected', (e) => Number(e.dataset.id));
    await page.keyboard.press('j');
    const afterJ = await page.$eval('#trophy-list .is-selected', (e) => Number(e.dataset.id));
    await page.keyboard.press('k');
    const afterK = await page.$eval('#trophy-list .is-selected', (e) => Number(e.dataset.id));
    check('j moves down and k moves back up', afterJ !== before && afterK === before, `${before} → ${afterJ} → ${afterK}`);
    await page.keyboard.press('x');
    check('x toggles earned on the selected trophy', await page.$eval(`#trophy-list [data-check="${before}"]`, (c) => c.checked));
    await context.close();
  }

  // 7. Every view renders; shot mode never writes localStorage.
  {
    const { context, page } = await freshPage();
    for (const view of ['roadmap', 'missables', 'sources', 'tracker']) {
      await page.click(`#nav-tabs [data-view="${view}"]`);
      const visible = await page
        .waitForFunction((id) => {
          const v = document.getElementById(id);
          return !v.hidden && v.textContent.trim().length > 100;
        }, `${view}-view`, { timeout: 5000 })
        .then(() => true, () => false);
      check(`${view} view renders`, visible);
    }
    await page.evaluate(() => localStorage.clear());
    await page.goto(server.url + '/?shot=cover');
    await waitReady(page);
    check('shot mode leaves localStorage empty', (await page.evaluate(() => localStorage.length)) === 0);
    await context.close();
  }

  // 8. Header: no overlapping or clipped items at three window sizes.
  for (const viewport of [{ width: 1024, height: 640 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
    const { context, page } = await freshPage(viewport);
    const report = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#app-header .brand, #header-progress > *, #app-header .header-actions > *:not([hidden])')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter((x) => x.r.width > 0);
      const overlaps = [];
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i].r;
          const b = items[j].r;
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps.push(`${items[i].el.className || items[i].el.id} × ${items[j].el.className || items[j].el.id}`);
        }
      const clipped = items.filter((x) => x.r.right > window.innerWidth + 1 || x.r.left < -1 || x.el.scrollWidth > x.el.clientWidth + 2).map((x) => x.el.className || x.el.id);
      return { overlaps, clipped, pageOverflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    check(`header at ${viewport.width}x${viewport.height}: no overlap or clipping`, !report.overlaps.length && !report.clipped.length && !report.pageOverflow, JSON.stringify(report));
    await context.close();
  }

  check('no console errors, warnings or page errors', problems.length === 0, problems.join(' | '));
  check('no request left localhost', blocked.length === 0, blocked.join(' | '));
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
