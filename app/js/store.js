// The data layer: loads app/reference/*.json (same origin, relative paths only) and indexes it; builds the claim
// index and the audit, so every count shown is computed, never typed; and keeps progress (earned trophies, counters,
// view settings) in localStorage. In screenshot mode (?shot=...) it holds a fixed sample in memory and never writes.

// ---------------------------------------------------------------- guide data
const DATA_FILES = {
  trophies: 'reference/trophies.json',
  sources: 'reference/sources.json',
  roadmap: 'reference/roadmap.json',
};

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
}

/** Fetch every data file in parallel and return one indexed guide object. */
export async function loadGuideData() {
  const [trophyFile, sourceFile, roadmap] = await Promise.all([
    fetchJson(DATA_FILES.trophies),
    fetchJson(DATA_FILES.sources),
    fetchJson(DATA_FILES.roadmap),
  ]);
  return indexGuide(fromRows(trophyFile, 'trophies'), fromRows(sourceFile, 'sources'), roadmap, sourceFile);
}

/** The data files keep one row per record, fields in the order of the file's `columns`; null means "has none". */
export function fromRows(file, key) {
  const { columns } = file;
  return file[key].map((row) => Object.fromEntries(columns.map((name, i) => [name, row[i]]).filter(([, v]) => v !== null)));
}

/** Steps, tips and dispute sides are stored as compact `[text, [source ids]]` pairs; the app works on `{ t, c }` objects. */
export const expandClaim = (item) => (Array.isArray(item) ? { t: item[0], c: item[1] } : item);

/** Build lookup maps: trophies by id, sources by number, trophies in roadmap order. */
export function indexGuide(trophies, sources, roadmap, sourceMeta = {}) {
  for (const t of trophies) {
    t.steps = (t.steps ?? []).map(expandClaim);
    t.tips = (t.tips ?? []).map(expandClaim);
    for (const d of t.disputes ?? []) Object.assign(d, { a: expandClaim(d.a), b: expandClaim(d.b) });
  }
  const trophyById = new Map(trophies.map((t) => [t.id, t]));
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const stageOrder = new Map(roadmap.stages.map((s, i) => [s.id, i]));
  const roadmapOrder = [...trophies].sort(
    (a, b) => (stageOrder.get(a.roadmapStage) ?? 99) - (stageOrder.get(b.roadmapStage) ?? 99) || (a.order ?? a.id) - (b.order ?? b.id),
  );
  return { trophies, sources, roadmap, trophyById, sourceById, roadmapOrder, readOn: sourceMeta.readOn ?? '' };
}

// ---------------------------------------------------------------- citations and claims

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** `[n]` chips for a list of source ids; each opens the source page in a new tab only when followed. */
export function citeChips(ids, guide) {
  return (ids ?? [])
    .map((id) => {
      const s = guide.sourceById.get(id);
      if (!s) return '';
      const title = escapeHtml(`${s.site} — ${s.title} (read ${guide.readOn})`);
      return `<a class="cite" href="${escapeHtml(s.url)}" target="_blank" rel="noopener" title="${title}">${id}</a>`;
    })
    .join('');
}

/**
 * Every cited claim in the guide: each trophy's official text, steps, tips, missable windows and dispute sides, plus roadmap
 * statements. Each item is { where, text, cites, trophyId }.
 */
export function collectClaims(guide) {
  const claims = [];
  const add = (where, item, trophyId = null) => {
    if (item && item.t) claims.push({ where, text: item.t, cites: item.c ?? [], trophyId });
  };
  for (const t of guide.trophies) {
    add('official', { t: `${t.name}: ${t.description} (${t.grade})`, c: guide.roadmap.officialCite }, t.id);
    (t.steps ?? []).forEach((s) => add('step', s, t.id));
    (t.tips ?? []).forEach((s) => add('tip', s, t.id));
    if (t.window) add('window', t.window, t.id);
    for (const d of t.disputes ?? []) {
      add('dispute', d.a, t.id);
      add('dispute', d.b, t.id);
    }
  }
  const r = guide.roadmap;
  (r.kpis ?? []).forEach((k) => add('roadmap', { t: `${k.label}: ${k.value}`, c: k.c }));
  for (const stage of r.stages ?? []) {
    (stage.steps ?? []).forEach((s) => add('roadmap', s));
    if (stage.stop) add('roadmap', stage.stop);
  }
  for (const ch of r.chapters ?? []) if (ch.pnr) add('timeline', ch.pnr);
  return claims;
}

/** Distinct source ids that a trophy's guide cites. */
export function sourcesForTrophy(trophy) {
  const ids = new Set();
  const take = (item) => (item?.c ?? []).forEach((id) => ids.add(id));
  (trophy.steps ?? []).forEach(take);
  (trophy.tips ?? []).forEach(take);
  take(trophy.window);
  for (const d of trophy.disputes ?? []) {
    take(d.a);
    take(d.b);
  }
  return [...ids].sort((a, b) => a - b);
}

/** How many claims each source backs, and in how many trophy guides it is cited. */
export function sourceUsage(guide, claims = collectClaims(guide)) {
  const usage = new Map(guide.sources.map((s) => [s.id, { claims: 0, guides: new Set() }]));
  for (const claim of claims) {
    for (const id of new Set(claim.cites)) {
      const u = usage.get(id);
      if (!u) continue;
      u.claims += 1;
      if (claim.trophyId) u.guides.add(claim.trophyId);
    }
  }
  return usage;
}

// ---------------------------------------------------------------- audit

const GRADE_KEYS = ['platinum', 'gold', 'silver', 'bronze'];

/** Compute the audit figures shown in the strip and on the Sources view. */
export function computeAudit(guide) {
  const { trophies, sources } = guide;
  const claims = collectClaims(guide);
  const grades = Object.fromEntries(GRADE_KEYS.map((g) => [g, trophies.filter((t) => t.grade === g).length]));
  const official = trophies.filter((t) => t.name && t.description && GRADE_KEYS.includes(t.grade)).length;
  const cited = claims.filter((c) => c.cites.length > 0).length;
  const multi = claims.filter((c) => new Set(c.cites).size >= 2).length;
  const guidesCited = trophies.filter(
    (t) => String(t.guide ?? '').trim() && (t.steps ?? []).length > 0 && t.steps.every((s) => (s.c ?? []).length > 0),
  ).length;
  return {
    total: trophies.length,
    official,
    grades,
    hidden: trophies.filter((t) => t.hidden).length,
    claims: claims.length,
    cited,
    multi,
    multiPct: claims.length ? Math.round((multi / claims.length) * 100) : 0,
    guidesCited,
    pages: sources.length,
    sites: new Set(sources.map((s) => s.site)).size,
    readOn: guide.readOn,
    missable: trophies.filter((t) => t.risk === 'missable').length,
    atRisk: trophies.filter((t) => t.risk === 'at-risk').length,
    disputes: trophies.reduce((n, t) => n + (t.disputes ?? []).length, 0),
    unconfirmed: trophies.reduce((n, t) => n + (t.disputes ?? []).filter((d) => d.unconfirmed).length, 0),
    online: trophies.filter((t) => t.online).length,
  };
}

/** "1P 2G 6S 46B" from the computed grade counts. */
export function gradeLine(a) {
  return `${a.grades.platinum}P ${a.grades.gold}G ${a.grades.silver}S ${a.grades.bronze}B`;
}

// ---------------------------------------------------------------- screenshot mode

export const SHOT_VIEWS = { cover: 'tracker', roadmap: 'roadmap', missables: 'missables', sources: 'sources' };

/** Sample progress: a late Chapter 1 save, just before Tourist Trap, with plenty of free-roam work done. */
const SAMPLE = {
  earned: [2, 16, 18, 20, 21, 30, 31, 32, 35, 36, 37, 38, 42, 51],
  counters: { 14: 6, 15: 61, 16: 9, 17: 9, 18: 14, 19: 3, 28: 0, 30: 3, 31: 100, 32: 50, 35: 100, 43: 2, 48: 130 },
};

/** The shot named in the URL, or null outside screenshot mode. */
export function readShot(search = location.search) {
  const shot = new URLSearchParams(search).get('shot');
  return shot && shot in SHOT_VIEWS ? shot : null;
}

/** The sample store contents for a shot: progress plus the view and the trophy the shot opens. */
export function shotSample(shot, coverTrophyId) {
  return {
    earned: SAMPLE.earned,
    counters: SAMPLE.counters,
    settings: { spoiler: true, view: SHOT_VIEWS[shot], filter: 'all', selected: coverTrophyId },
  };
}

// ---------------------------------------------------------------- progress store

export const STORAGE_KEY = 'platinum-route.gta6.v1';

const DEFAULT_SETTINGS = { spoiler: true, view: 'tracker', filter: 'all', selected: null };

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Create the store. `sample` replaces saved progress and turns persistence off. */
export function createStore(sample = null) {
  const persist = !sample;
  const saved = sample ?? readSaved() ?? {};
  const state = {
    earned: new Set(Array.isArray(saved.earned) ? saved.earned : []),
    counters: { ...(saved.counters ?? {}) },
    settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
  };
  const listeners = new Set();

  function save() {
    if (!persist) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
    } catch {
      /* storage full or blocked: progress stays in memory for this session */
    }
  }

  function emit(change) {
    save();
    for (const fn of listeners) fn(change);
  }

  function snapshot() {
    return {
      earned: [...state.earned].sort((a, b) => a - b),
      counters: { ...state.counters },
      settings: { ...state.settings },
    };
  }

  return {
    persist,
    isEarned: (id) => state.earned.has(id),
    earnedCount: () => state.earned.size,
    counter: (id) => state.counters[id] ?? 0,
    setting: (key) => state.settings[key],
    snapshot,
    toggleEarned(id, value = !state.earned.has(id)) {
      if (value) state.earned.add(id);
      else state.earned.delete(id);
      emit({ type: 'earned', id });
    },
    setCounter(id, value, target) {
      const clamped = Math.max(0, Math.min(target ?? Infinity, Math.round(value)));
      state.counters[id] = clamped;
      emit({ type: 'counter', id });
    },
    setSetting(key, value) {
      if (state.settings[key] === value) return;
      state.settings[key] = value;
      emit({ type: 'setting', key });
    },
    replaceProgress(earnedIds, counters) {
      state.earned = new Set(earnedIds);
      state.counters = { ...counters };
      emit({ type: 'import' });
    },
    reset() {
      state.earned.clear();
      state.counters = {};
      emit({ type: 'reset' });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
