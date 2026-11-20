// Loads the guide's three data files from app/data/ (same origin, relative paths only) and indexes them.

const DATA_FILES = {
  trophies: 'data/trophies.json',
  sources: 'data/sources.json',
  roadmap: 'data/roadmap.json',
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
  const trophies = Array.isArray(trophyFile) ? trophyFile : trophyFile.trophies;
  const sources = sourceFile.sources;
  return indexGuide(trophies, sources, roadmap, sourceFile);
}

/** Build lookup maps: trophies by id, sources by number, trophies in roadmap order. */
export function indexGuide(trophies, sources, roadmap, sourceMeta = {}) {
  const trophyById = new Map(trophies.map((t) => [t.id, t]));
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const stageOrder = new Map(roadmap.stages.map((s, i) => [s.id, i]));
  const roadmapOrder = [...trophies].sort(
    (a, b) => (stageOrder.get(a.roadmapStage) ?? 99) - (stageOrder.get(b.roadmapStage) ?? 99) || (a.order ?? a.id) - (b.order ?? b.id),
  );
  return { trophies, sources, roadmap, trophyById, sourceById, roadmapOrder, readOn: sourceMeta.readOn ?? '' };
}
