// Shared by the screenshot and test tools: serve app/ on a free localhost port, and open Chromium with every
// non-localhost request blocked and every console error, warning or page error recorded.

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const APP = join(ROOT, 'app');
export const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE ?? '/home/mausbot/mf-tools/node_modules/playwright/index.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/** Serve app/ on 127.0.0.1 at a free port. Resolves to { url, close }. */
export function serveApp() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(join(APP, normalize(path)));
    if (!file.startsWith(APP + sep)) return res.writeHead(403).end();
    try {
      if (!statSync(file).isFile()) throw new Error('not a file');
    } catch {
      return res.writeHead(404).end('not found');
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) =>
    server.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => server.close(done)) })),
  );
}

/** Launch Chromium and return { browser, newPage, problems, blocked }. */
export async function openBrowser() {
  const { chromium } = await import(PLAYWRIGHT);
  const browser = await chromium.launch();
  const problems = [];
  const blocked = [];
  async function newPage(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options });
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
      if (local || url.protocol === 'blob:' || url.protocol === 'data:') return route.continue();
      blocked.push(url.href);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`console ${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    return { context, page };
  }
  return { browser, newPage, problems, blocked };
}

/** Wait until main.js marks the page ready (or failed). */
export async function waitReady(page) {
  await page.waitForFunction(() => document.body.dataset.ready === 'true' || document.body.dataset.ready === 'error', null, { timeout: 15000 });
  const state = await page.evaluate(() => document.body.dataset.ready);
  if (state !== 'true') throw new Error('app reported a load error');
  await page.evaluate(() => document.fonts.ready);
}
