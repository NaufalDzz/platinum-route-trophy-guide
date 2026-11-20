// Platinum Roadmap view: cited headline tiles, then the ordered stages with their chapters, trophies,
// collectible counts and red Missable Stop banners.

import { citeChips, escapeHtml } from './store.js';
import { isMasked, maskedName } from './spoilerShield.js';
import { GRADE_LETTER } from './trackerView.js';

/** A tile's value: typed in roadmap.json for cited facts, or counted from the trophy data for `computed` tiles. */
function kpiValue(k, audit) {
  return k.computed ? String(audit[k.computed]) : k.value;
}

function kpiTile(k, guide, audit) {
  return `<div class="kpi tone-${k.tone ?? 'ink'}">
    <span class="kpi-value">${escapeHtml(kpiValue(k, audit))}</span>
    <span class="kpi-label">${escapeHtml(k.label)}</span>
    <span class="kpi-cites">${citeChips(k.c, guide)}</span>
  </div>`;
}

function trophyChip(t, store) {
  const name = isMasked(t, store) ? maskedName(t) : t.name;
  const state = store.isEarned(t.id) ? ' is-earned' : '';
  const risk = t.risk === 'missable' ? ' chip-red' : t.risk === 'at-risk' ? ' chip-amber' : '';
  return `<button type="button" class="rm-trophy${state}${risk}" data-pick="${t.id}"><span class="grade grade-${t.grade}">${GRADE_LETTER[t.grade]}</span>${escapeHtml(name)}${store.isEarned(t.id) ? ' ✓' : ''}</button>`;
}

function stageCard(stage, guide, store) {
  const trophies = guide.roadmapOrder.filter((t) => t.roadmapStage === stage.id);
  const done = trophies.filter((t) => store.isEarned(t.id)).length;
  const counts = (stage.counts ?? []).map((c) => `<span class="rm-count"><b>${escapeHtml(c.value)}</b> ${escapeHtml(c.label)}</span>`).join('');
  return `<article class="rm-stage tone-${stage.tone ?? 'indigo'}">
    <header class="rm-stage-head">
      <span class="rm-stage-n">${stage.n}</span>
      <div><h3>${escapeHtml(stage.title)}</h3><p>${escapeHtml(stage.chapters)}</p></div>
      <span class="rm-stage-prog">${done}/${trophies.length}</span>
    </header>
    ${stage.stop ? `<div class="rm-stop"><b>⛔ MISSABLE STOP</b> ${escapeHtml(stage.stop.t)} ${citeChips(stage.stop.c, guide)}</div>` : ''}
    ${counts ? `<div class="rm-counts">${counts}</div>` : ''}
    <ol class="rm-steps">${(stage.steps ?? []).map((s) => `<li>${escapeHtml(s.t)} ${citeChips(s.c, guide)}</li>`).join('')}</ol>
    <div class="rm-trophies">${trophies.map((t) => trophyChip(t, store)).join('')}</div>
  </article>`;
}

/** The whole route on one line: every stage in play order with its progress and any missable stop. */
function routeStrip(guide, store) {
  return `<ol class="rm-route" aria-label="Route overview">${guide.roadmap.stages
    .map((stage) => {
      const all = guide.trophies.filter((t) => t.roadmapStage === stage.id);
      const done = all.filter((t) => store.isEarned(t.id)).length;
      return `<li class="rm-route-step tone-${stage.tone ?? 'indigo'}">
        <span class="rm-route-n">${stage.n}</span>
        <span class="rm-route-text"><b>${escapeHtml(stage.title)}</b><small>${done}/${all.length} trophies</small></span>
        ${stage.stop ? '<span class="rm-route-stop">⛔ STOP</span>' : ''}
      </li>`;
    })
    .join('')}</ol>`;
}

/** Render the roadmap into its section. */
export function renderRoadmapView(el, app) {
  const { guide, store } = app;
  const r = guide.roadmap;
  const earned = store.earnedCount();
  el.innerHTML = `<div class="page">
    <header class="page-head">
      <h2 class="page-title">Platinum Roadmap</h2>
      <p class="page-sub">${r.stages.length} stages in play order · built from the 55 official descriptions and cited guides · ${earned}/${guide.trophies.length} earned</p>
      <button type="button" class="btn btn-light print-btn" data-print>Print roadmap</button>
    </header>
    <div class="kpi-row">${r.kpis.map((k) => kpiTile(k, guide, app.audit)).join('')}</div>
    ${routeStrip(guide, store)}
    <div class="rm-grid">${r.stages.map((s) => stageCard(s, guide, store)).join('')}</div>
  </div>`;
  el.querySelectorAll('[data-pick]').forEach((b) =>
    b.addEventListener('click', () => {
      store.setSetting('selected', Number(b.dataset.pick));
      store.setSetting('view', 'tracker');
    }),
  );
  el.querySelector('[data-print]').addEventListener('click', () => window.print());
}
