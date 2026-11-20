#!/usr/bin/env node
// Validates app/reference/*.json: the 55 official names, descriptions and grades against the starter list, every guide
// non-blank and cited, every citation resolving to a source, and the roadmap's references. Exits 1 on any problem.
// Usage: node tools/checkData.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const STARTER_COMMIT = 'bf92d33';
const KINDS = new Set(['story', 'collectible', 'activity', 'side', 'crime', 'misc', 'completion']);
const RISKS = new Set(['missable', 'at-risk', 'safe']);
const EXPECTED_GRADES = { platinum: 1, gold: 2, silver: 6, bronze: 46 };
const EXPECTED_HIDDEN = 28;

const problems = [];
const fail = (msg) => problems.push(msg);
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

/** The official list as the kit's starter shipped it: from git history, else the kit folder beside the repo. */
export function loadOfficialList() {
  try {
    const raw = execFileSync('git', ['show', `${STARTER_COMMIT}:app/data/trophies.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(raw).trophies;
  } catch {
    const kit = join(root, '..', 'gta6-trophy-guide-01-kit', 'starter', 'app', 'data', 'trophies.json');
    if (existsSync(kit)) return JSON.parse(readFileSync(kit, 'utf8')).trophies;
    throw new Error('Official starter list not found (git history or kit folder).');
  }
}

function checkOfficial(trophies, official) {
  if (trophies.length !== 55) fail(`expected 55 trophies, found ${trophies.length}`);
  for (const ref of official) {
    const t = trophies.find((x) => x.id === ref.id);
    if (!t) { fail(`missing trophy #${ref.id} ${ref.name}`); continue; }
    for (const key of ['name', 'description', 'grade']) {
      if (t[key] !== ref[key]) fail(`#${ref.id} ${key} differs: ${JSON.stringify(t[key])} vs official ${JSON.stringify(ref[key])}`);
    }
  }
  const grades = {};
  for (const t of trophies) grades[t.grade] = (grades[t.grade] ?? 0) + 1;
  for (const [g, n] of Object.entries(EXPECTED_GRADES)) if (grades[g] !== n) fail(`grade ${g}: ${grades[g]} (expected ${n})`);
  const hidden = trophies.filter((t) => t.hidden === true).length;
  if (hidden !== EXPECTED_HIDDEN) fail(`hidden trophies: ${hidden} (expected ${EXPECTED_HIDDEN})`);
}

function checkCites(where, item, sourceIds) {
  if (!item || typeof item.t !== 'string' || !item.t.trim()) return fail(`${where}: empty text`);
  if (!Array.isArray(item.c) || !item.c.length) return fail(`${where}: no citation`);
  for (const id of item.c) if (!sourceIds.has(id)) fail(`${where}: cites unknown source ${id}`);
  if (new Set(item.c).size !== item.c.length) fail(`${where}: repeats a source`);
}

function checkGuides(trophies, sourceIds, stageIds) {
  for (const t of trophies) {
    const at = `#${t.id} ${t.name}`;
    if (!String(t.guide ?? '').trim()) fail(`${at}: blank guide`);
    if (String(t.guide).trim() === t.description.trim()) fail(`${at}: guide only repeats the description`);
    if (typeof t.hidden !== 'boolean') fail(`${at}: hidden flag missing`);
    if (!KINDS.has(t.kind)) fail(`${at}: unknown kind ${t.kind}`);
    if (!RISKS.has(t.risk)) fail(`${at}: unknown risk ${t.risk}`);
    if (!stageIds.has(t.roadmapStage)) fail(`${at}: unknown roadmap stage ${t.roadmapStage}`);
    if (t.risk !== 'safe' && !t.window) fail(`${at}: ${t.risk} trophy needs a window`);
    if (t.counter && !(Number.isInteger(t.counter.target) && t.counter.target > 0 && t.counter.unit)) fail(`${at}: bad counter`);
    if (!Array.isArray(t.steps) || t.steps.length < 3) fail(`${at}: needs at least 3 numbered steps`);
    (t.steps ?? []).forEach((s, i) => checkCites(`${at} step ${i + 1}`, s, sourceIds));
    (t.tips ?? []).forEach((s, i) => checkCites(`${at} tip ${i + 1}`, s, sourceIds));
    if (t.window) checkCites(`${at} window`, t.window, sourceIds);
    (t.disputes ?? []).forEach((d, i) => {
      if (!d.topic) fail(`${at} dispute ${i + 1}: no topic`);
      checkCites(`${at} dispute ${i + 1} side A`, d.a, sourceIds);
      checkCites(`${at} dispute ${i + 1} side B`, d.b, sourceIds);
    });
  }
}

function checkRoadmap(roadmap, trophies, sourceIds) {
  const ids = new Set(trophies.map((t) => t.id));
  if (!ids.has(roadmap.coverTrophy)) fail('roadmap.coverTrophy is not a trophy id');
  for (const id of roadmap.officialCite) if (!sourceIds.has(id)) fail(`officialCite: unknown source ${id}`);
  roadmap.kpis.forEach((k, i) => (k.c ?? []).forEach((id) => sourceIds.has(id) || fail(`kpi ${i + 1}: unknown source ${id}`)));
  for (const s of roadmap.stages) {
    (s.steps ?? []).forEach((x, i) => checkCites(`stage ${s.n} step ${i + 1}`, x, sourceIds));
    if (s.stop) checkCites(`stage ${s.n} stop`, s.stop, sourceIds);
    if (!trophies.some((t) => t.roadmapStage === s.id)) fail(`stage ${s.n} has no trophies`);
  }
  for (const ch of roadmap.chapters) if (ch.pnr) checkCites(`timeline ${ch.label}`, ch.pnr, sourceIds);
}

function checkSources(sources, used) {
  const seen = new Set();
  for (const s of sources) {
    if (seen.has(s.id)) fail(`duplicate source id ${s.id}`);
    seen.add(s.id);
    if (!/^https:\/\//.test(s.url)) fail(`source ${s.id}: url must be https`);
    if (!s.site || !s.title) fail(`source ${s.id}: site and title required`);
    if (!used.has(s.id)) fail(`source ${s.id} (${s.site}) is never cited`);
  }
}

/** The app must reach nothing outside itself: no absolute URLs in code or styles. */
function checkOffline() {
  const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
  for (const file of walk(join(root, 'app'))) {
    if (!/\.(js|mjs|css|html|svg)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    if (/(https?:)?\/\/[a-z0-9-]+\.[a-z]/i.test(text.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ''))) fail(`${file.slice(root.length + 1)} names an absolute URL`);
  }
}

function stats(trophies, roadmap) {
  const items = [];
  for (const t of trophies) {
    items.push({ c: roadmap.officialCite }, ...(t.steps ?? []), ...(t.tips ?? []));
    if (t.window) items.push(t.window);
    for (const d of t.disputes ?? []) items.push(d.a, d.b);
  }
  for (const s of roadmap.stages) items.push(...(s.steps ?? []), ...(s.stop ? [s.stop] : []));
  for (const ch of roadmap.chapters) if (ch.pnr) items.push(ch.pnr);
  const multi = items.filter((i) => new Set(i.c).size >= 2).length;
  const steps = trophies.reduce((n, t) => n + t.steps.length, 0);
  const stepMulti = trophies.reduce((n, t) => n + t.steps.filter((s) => new Set(s.c).size >= 2).length, 0);
  return { claims: items.length, multi, steps, stepMulti, disputes: trophies.reduce((n, t) => n + (t.disputes ?? []).length, 0) };
}

const data = readJson('app/reference/trophies.json');
// Records are rows in the order of the file's columns (null = none); steps, tips and dispute sides are [text, [source ids]] pairs.
// Check them as the app reads them: objects, with { t, c } claims.
const fromRows = (file, key) => file[key].map((row) => Object.fromEntries(file.columns.map((k, i) => [k, row[i]]).filter(([, v]) => v !== null)));
const expandClaim = (item) => (Array.isArray(item) ? { t: item[0], c: item[1] } : item);
const trophies = fromRows(data, 'trophies');
for (const t of trophies) {
  if (Array.isArray(t.steps)) t.steps = t.steps.map(expandClaim);
  if (t.tips) t.tips = t.tips.map(expandClaim);
  for (const d of t.disputes ?? []) Object.assign(d, { a: expandClaim(d.a), b: expandClaim(d.b) });
}
const sourceFile = readJson('app/reference/sources.json');
const { readOn } = sourceFile;
const sources = fromRows(sourceFile, 'sources');
if (!/^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(readOn ?? '')) fail('sources.json: readOn date required');
const roadmap = readJson('app/reference/roadmap.json');
const sourceIds = new Set(sources.map((s) => s.id));
const stageIds = new Set(roadmap.stages.map((s) => s.id));

checkOfficial(trophies, loadOfficialList());
checkGuides(trophies, sourceIds, stageIds);
checkRoadmap(roadmap, trophies, sourceIds);
const used = new Set(JSON.stringify({ trophies, roadmap }).match(/"c":\[[^\]]*\]/g).flatMap((m) => JSON.parse(m.slice(4))));
roadmap.officialCite.forEach((id) => used.add(id));
roadmap.kpis.forEach((k) => (k.c ?? []).forEach((id) => used.add(id)));
checkSources(sources, used);
checkOffline();

const s = stats(trophies, roadmap);
const sites = new Set(sources.map((x) => x.site)).size;
console.log(`trophies ${trophies.length} · sources ${sources.length} on ${sites} sites · claims ${s.claims} (${s.multi} backed by 2+, ${Math.round((100 * s.multi) / s.claims)}%) · steps ${s.steps} (${s.stepMulti} multi-source) · disputes ${s.disputes}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('checkData: OK');
