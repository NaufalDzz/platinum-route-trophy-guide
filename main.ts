// Platinum Route — hands the GTA VI trophy guide in (Node 22, standard library only).
//
// The guide itself is app/: static files with no build step (index.html, ES modules in js/, stylesheets in css/,
// and the trophy, source and roadmap data in data/*.json). It makes no network request when it runs.
//
// This program copies app/ and screenshots/ into the output directory and writes dossier.json there with the
// vendored make.fun library, so the dossier is byte for byte what the scorer rebuilds. Both runs write identical
// bytes: nothing here depends on the clock, randomness or the machine.
//
// The output directory is /output in the grader; elsewhere set MAKEFUN_OUTPUT_DIR, for example:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy one folder of the repository into the output directory (an absent folder becomes an empty one). */
function copyFolder(name: string): void {
  const from = join(repoDir, name);
  const to = join(outputDir, name);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyFolder('app');
copyFolder('screenshots');

// The scorer's caps: a 160 KiB text outline, at most 4 screenshots of 256 KiB each, and app/ within 993 entries
// and 48 MiB, which leaves room in /output's own 1,000-entry cap for screenshots/ and dossier.json.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
