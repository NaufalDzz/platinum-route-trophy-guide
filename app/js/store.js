// Progress store: earned trophies, counter values and view settings, saved to localStorage.
// In screenshot mode (?shot=...) it holds a fixed sample in memory and never writes to the browser.

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
