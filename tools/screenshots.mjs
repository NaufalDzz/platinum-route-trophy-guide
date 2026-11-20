#!/usr/bin/env node
// Renders the shots listed in shots.json from the app's own code in Chromium and writes them to screenshots/.
// Fails on any console error or warning, any page error, or any attempted non-localhost request.
// Each JPEG is kept within 256 KiB by stepping its quality down. Usage: node tools/screenshots.mjs

import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, serveApp, openBrowser, waitReady } from './browserKit.mjs';

const MAX_BYTES = 256 * 1024;
const QUALITIES = [90, 86, 82, 78, 74, 70, 65, 60];
const outDir = join(ROOT, 'screenshots');
const shots = JSON.parse(readFileSync(join(ROOT, 'shots.json'), 'utf8'));

/** Take one JPEG at the best quality that fits the size cap. */
async function captureWithinCap(page) {
  for (const quality of QUALITIES) {
    const buffer = await page.screenshot({ type: 'jpeg', quality });
    if (buffer.length <= MAX_BYTES) return { buffer, quality };
  }
  throw new Error('screenshot stays over 256 KiB even at the lowest quality');
}

const server = await serveApp();
const { browser, newPage, problems, blocked } = await openBrowser();
let failed = false;
try {
  mkdirSync(outDir, { recursive: true });
  const keep = new Set(shots.map((s) => s.file));
  for (const name of readdirSync(outDir)) if (!keep.has(name)) rmSync(join(outDir, name));
  for (const shot of shots) {
    const { context, page } = await newPage({ viewport: shot.viewport, deviceScaleFactor: shot.scale ?? 1 });
    await page.goto(server.url + shot.path);
    await waitReady(page);
    await page.waitForTimeout(150);
    const { buffer, quality } = await captureWithinCap(page);
    writeFileSync(join(outDir, shot.file), buffer);
    console.log(`${shot.file}: ${(buffer.length / 1024).toFixed(1)} KiB at quality ${quality}`);
    await context.close();
  }
  if (problems.length) {
    failed = true;
    console.error(`console/page problems:\n- ${problems.join('\n- ')}`);
  }
  if (blocked.length) {
    failed = true;
    console.error(`blocked network requests:\n- ${blocked.join('\n- ')}`);
  }
} finally {
  await browser.close();
  await server.close();
}
if (failed) process.exit(1);
console.log('screenshots: OK');
