// Screenshot mode: `?shot=cover|roadmap|missables|sources` opens a fixed view with fixed sample progress,
// held in memory only (nothing is written to localStorage), so every render of a shot is identical.

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
