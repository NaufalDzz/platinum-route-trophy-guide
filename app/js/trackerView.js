// Tracker view: the filtered checklist grouped by roadmap stage, plus the Next-Up panel.

import { escapeHtml, sourcesForTrophy } from './store.js';
import { getFilter, matchesQuery, ONLINE_NOTE } from './filters.js';
import { isMasked, maskedName, maskedDescription } from './spoilerShield.js';

export const GRADE_LETTER = { platinum: 'P', gold: 'G', silver: 'S', bronze: 'B' };

/** The trophies the current filter and search show, in roadmap order. */
export function visibleTrophies(guide, store, query) {
  const filter = getFilter(store.setting('filter'));
  return guide.roadmapOrder.filter((t) => filter.test(t, store) && matchesQuery(t, query, store));
}

function riskPill(t) {
  if (t.risk === 'missable') return '<span class="pill pill-missable">Missable</span>';
  if (t.risk === 'at-risk') return '<span class="pill pill-risk">At risk</span>';
  return '';
}

function rowHtml(t, guide, store, selectedId) {
  const masked = isMasked(t, store);
  const earned = store.isEarned(t.id);
  const name = masked ? maskedName(t) : t.name;
  const desc = masked ? maskedDescription(t) : t.description;
  const count = t.counter ? `<span class="row-count">${store.counter(t.id)}/${t.counter.target}</span>` : '';
  const pills = [
    riskPill(t),
    t.hidden ? '<span class="pill pill-hidden">PSN-hidden</span>' : '',
    (t.disputes ?? []).length ? '<span class="pill pill-dispute">Sources differ</span>' : '',
  ].join('');
  return `<li class="trophy-row${earned ? ' is-earned' : ''}${masked ? ' is-masked' : ''}${t.id === selectedId ? ' is-selected' : ''}" data-id="${t.id}" tabindex="-1">
    <input type="checkbox" class="row-check" data-check="${t.id}" ${earned ? 'checked' : ''} aria-label="Mark earned: ${escapeHtml(name)}">
    <span class="grade grade-${t.grade}" title="${t.grade}">${GRADE_LETTER[t.grade]}</span>
    <span class="row-main">
      <span class="row-name">${escapeHtml(name)}</span>
      <span class="row-desc">${escapeHtml(desc)}</span>
      <span class="row-meta">${pills}${count}<span class="row-src">${sourcesForTrophy(t).length} src</span></span>
    </span>
  </li>`;
}

/** Render the grouped checklist. */
export function renderTrophyList(listEl, guide, store, query, selectedId) {
  const shown = visibleTrophies(guide, store, query);
  const parts = [];
  if (store.setting('filter') === 'online') {
    parts.push(`<li class="list-empty online-note"><b>0 online trophies.</b> ${escapeHtml(ONLINE_NOTE.replace(/^Online: 0 — /, ''))}</li>`);
  } else if (!shown.length) {
    parts.push('<li class="list-empty">No trophies match this filter and search.</li>');
  }
  for (const stage of guide.roadmap.stages) {
    const inStage = shown.filter((t) => t.roadmapStage === stage.id);
    if (!inStage.length) continue;
    const all = guide.trophies.filter((t) => t.roadmapStage === stage.id);
    const done = all.filter((t) => store.isEarned(t.id)).length;
    const pct = Math.round((done / all.length) * 100);
    parts.push(`<li class="group-head" aria-hidden="true"><span class="group-n">${stage.n}</span><span class="group-title">${escapeHtml(stage.short ?? stage.title)}</span><span class="group-prog">${done}/${all.length}</span><i class="group-bar"><b style="width:${pct}%"></b></i></li>`);
    for (const t of inStage) parts.push(rowHtml(t, guide, store, selectedId));
  }
  listEl.innerHTML = parts.join('');
  return shown;
}

/** Next-Up: the first unearned trophies in roadmap order. */
export function renderNextUp(el, guide, store, onPick) {
  const next = guide.roadmapOrder.filter((t) => !store.isEarned(t.id) && t.grade !== 'platinum').slice(0, 4);
  const stageOf = (t) => guide.roadmap.stages.find((s) => s.id === t.roadmapStage);
  el.innerHTML = `<h3 class="panel-title">Next up · roadmap order</h3><ol class="next-list">${next
    .map((t) => {
      const masked = isMasked(t, store);
      return `<li><button type="button" class="next-item" data-pick="${t.id}">
        <span class="grade grade-${t.grade}">${GRADE_LETTER[t.grade]}</span>
        <span><b>${escapeHtml(masked ? maskedName(t) : t.name)}</b>
        <small>Stage ${stageOf(t)?.n ?? '?'} · ${escapeHtml(t.chapter ?? t.kindLabel ?? '')}${t.risk === 'missable' ? ' · <em class="txt-red">do first</em>' : ''}</small></span>
      </button></li>`;
    })
    .join('')}</ol>`;
  el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => onPick(Number(b.dataset.pick))));
}
