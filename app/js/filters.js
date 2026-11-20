// Tracker filters: each has a label, a predicate and a live count computed from the data and saved progress.

export const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'story', label: 'Story', test: (t) => t.kind === 'story' },
  { id: 'missable', label: 'Missable', css: 'chip-missable', test: (t) => t.risk === 'missable' || t.risk === 'at-risk' },
  { id: 'collectible', label: 'Collectibles', test: (t) => t.kind === 'collectible' },
  { id: 'activity', label: 'Activities', test: (t) => t.kind === 'activity' },
  { id: 'side', label: 'Side', test: (t) => t.kind === 'side' },
  { id: 'online', label: 'Online', test: (t) => Boolean(t.online) },
  { id: 'hidden', label: 'PSN-Hidden', test: (t) => Boolean(t.hidden) },
  { id: 'disputed', label: 'Disputed', test: (t) => (t.disputes ?? []).length > 0 },
  { id: 'remaining', label: 'Remaining', test: (t, store) => !store.isEarned(t.id), sep: true },
  { id: 'earned', label: 'Earned', test: (t, store) => store.isEarned(t.id) },
  { id: 'grade-platinum', label: 'P', title: 'Platinum', test: (t) => t.grade === 'platinum', sep: true },
  { id: 'grade-gold', label: 'G', title: 'Gold', test: (t) => t.grade === 'gold' },
  { id: 'grade-silver', label: 'S', title: 'Silver', test: (t) => t.grade === 'silver' },
  { id: 'grade-bronze', label: 'B', title: 'Bronze', test: (t) => t.grade === 'bronze' },
];

export const ONLINE_NOTE = 'Online: 0 — the official PS5 list has no online or multiplayer trophies; everything here is earned offline in story mode.';

/** Look up a filter, falling back to All. */
export function getFilter(id) {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0];
}

/** Count how many trophies each filter matches right now. */
export function countFilters(trophies, store) {
  const counts = {};
  for (const filter of FILTERS) counts[filter.id] = trophies.filter((t) => filter.test(t, store)).length;
  return counts;
}

/** Render the chip row with live counts. */
export function renderFilterChips(container, trophies, store, onPick) {
  const counts = countFilters(trophies, store);
  const active = store.setting('filter');
  container.replaceChildren();
  for (const filter of FILTERS) {
    if (filter.sep) {
      const sep = document.createElement('span');
      sep.className = 'chip-sep';
      container.append(sep);
    }
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `chip ${filter.css ?? ''} ${counts[filter.id] === 0 ? 'chip-zero' : ''}`.trim();
    chip.dataset.filter = filter.id;
    chip.setAttribute('aria-pressed', String(filter.id === active));
    if (filter.title) chip.title = filter.title;
    if (filter.id === 'online') chip.title = ONLINE_NOTE;
    chip.innerHTML = `${filter.label} <span class="n">${counts[filter.id]}</span>`;
    chip.addEventListener('click', () => onPick(filter.id));
    container.append(chip);
  }
  return counts;
}
