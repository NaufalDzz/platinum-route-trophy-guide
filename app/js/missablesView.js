// Missables view: a chapter timeline with Point of No Return flags, then colour-coded risk cards
// (Missable red, At-Risk amber, Safe green), all counted from the data.

import { citeChips, escapeHtml } from './store.js';
import { isMasked, maskedName } from './spoilerShield.js';
import { GRADE_LETTER } from './trackerView.js';

function timelineHtml(chapters, guide) {
  return `<div class="tl" role="list">${chapters
    .map(
      (ch) => `<div class="tl-node${ch.pnr ? ' has-pnr' : ''}" role="listitem">
        ${ch.pnr ? `<div class="tl-flag"><b>POINT OF NO RETURN</b><span>${escapeHtml(ch.pnr.label)}</span></div>` : '<div class="tl-flag tl-flag-empty"></div>'}
        <div class="tl-dot"></div>
        <div class="tl-label"><b>${escapeHtml(ch.label)}</b><span>${escapeHtml(ch.name)}</span><small>${escapeHtml(ch.note ?? '')}</small></div>
      </div>`,
    )
    .join('')}</div>`;
}

function riskCard(t, guide, store) {
  const masked = isMasked(t, store);
  const cls = t.risk === 'missable' ? 'tone-red' : 'tone-amber';
  const tag = t.risk === 'missable' ? 'MISSABLE' : 'AT RISK';
  const done = store.isEarned(t.id);
  const count = t.counter ? ` · <span class="risk-count">${store.counter(t.id)}/${t.counter.target} ${escapeHtml(t.counter.unit)}</span>` : '';
  return `<article class="risk-card ${cls}${done ? ' is-earned' : ''}">
    <header><span class="risk-tag">${tag}</span><span class="grade grade-${t.grade}">${GRADE_LETTER[t.grade]}</span>
      <h3>${escapeHtml(masked ? maskedName(t) : t.name)}</h3>${done ? '<span class="risk-done">✓ earned</span>' : ''}</header>
    <p class="risk-closes">Window closes: <b>${escapeHtml(t.window?.closes ?? 'see guide')}</b>${done ? '' : count}</p>
    <p class="risk-text">${escapeHtml(t.window?.t ?? '')} ${citeChips(t.window?.c, guide)}</p>
    <button type="button" class="risk-open" data-pick="${t.id}">Open guide →</button>
  </article>`;
}

/** Render the missables page. */
export function renderMissablesView(el, app) {
  const { guide, store } = app;
  const r = guide.roadmap;
  const missable = guide.roadmapOrder.filter((t) => t.risk === 'missable');
  const atRisk = guide.roadmapOrder.filter((t) => t.risk === 'at-risk');
  const safe = guide.roadmapOrder.filter((t) => t.risk === 'safe');
  const safeEarned = safe.filter((t) => store.isEarned(t.id)).length;
  el.innerHTML = `<div class="page">
    <header class="page-head">
      <h2 class="page-title">Missables &amp; Points of No Return</h2>
      <p class="page-sub">Every trophy rated from its official description and the cited guides · the timeline flags where a window shuts</p>
    </header>
    <div class="risk-tiles">
      <div class="risk-tile tone-red"><b>${missable.length}</b><span>Missable</span><small>one chance — do before the flag</small></div>
      <div class="risk-tile tone-amber"><b>${atRisk.length}</b><span>At risk</span><small>temporary window or unconfirmed</small></div>
      <div class="risk-tile tone-green"><b>${safe.length}</b><span>Safe</span><small>still open after the credits</small></div>
      <div class="risk-tile tone-ink"><b>${r.chapters.filter((c) => c.pnr).length}</b><span>PNR flags</span><small>on the chapter timeline</small></div>
    </div>
    <h3 class="section-title">Chapter timeline</h3>
    ${timelineHtml(r.chapters, guide)}
    <div class="risk-grid">
      ${missable.map((t) => riskCard(t, guide, store)).join('')}
      ${atRisk.map((t) => riskCard(t, guide, store)).join('')}
      <article class="risk-card tone-green">
        <header><span class="risk-tag">SAFE</span><h3>${safe.length} trophies never close</h3><span class="risk-done">${safeEarned}/${safe.length} earned</span></header>
        <p class="risk-text">${escapeHtml(r.safeNote?.t ?? '')} ${citeChips(r.safeNote?.c, guide)}</p>
        <div class="safe-chips">${safe
          .slice(0, 14)
          .map((t) => `<span class="safe-chip${store.isEarned(t.id) ? ' is-earned' : ''}">${escapeHtml(isMasked(t, store) ? maskedName(t) : t.name)}</span>`)
          .join('')}<span class="safe-chip more">+${Math.max(0, safe.length - 14)} more</span></div>
      </article>
    </div>
  </div>`;
  el.querySelectorAll('[data-pick]').forEach((b) =>
    b.addEventListener('click', () => {
      store.setSetting('selected', Number(b.dataset.pick));
      store.setSetting('view', 'tracker');
    }),
  );
}
