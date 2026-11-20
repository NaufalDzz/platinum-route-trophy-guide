// Trophy detail: official text, our guide, counter, missable window, numbered cited steps, Sources Differ boxes,
// and the "Sources for this guide" panel.

import { citeChips, escapeHtml, sourcesForTrophy } from './citations.js';
import { isMasked, maskedName, maskedDescription } from './spoilerShield.js';
import { GRADE_LETTER } from './trackerView.js';

const GRADE_NAME = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

function counterHtml(t, store) {
  if (!t.counter) return '';
  const value = store.counter(t.id);
  const pct = Math.round((value / t.counter.target) * 100);
  return `<div class="counter" data-counter="${t.id}">
    <span class="counter-label">Your count · ${escapeHtml(t.counter.unit)}</span>
    <button type="button" class="counter-btn" data-step="-1" aria-label="Decrease">−</button>
    <input class="counter-input" type="number" min="0" max="${t.counter.target}" value="${value}" aria-label="${escapeHtml(t.counter.unit)} done">
    <span class="counter-of">/ ${t.counter.target}</span>
    <button type="button" class="counter-btn" data-step="1" aria-label="Increase">+</button>
    <i class="counter-bar"><b style="width:${pct}%"></b></i>
    <span class="counter-left">${t.counter.target - value} to go · saved</span>
  </div>`;
}

function windowHtml(t, guide) {
  if (!t.window) return '';
  const cls = t.risk === 'missable' ? 'win-red' : t.risk === 'at-risk' ? 'win-amber' : 'win-green';
  const head = t.risk === 'missable' ? 'Missable window' : t.risk === 'at-risk' ? 'At-risk window' : 'Always available';
  return `<div class="window-box ${cls}"><b>${head}${t.window.closes ? ` — closes ${escapeHtml(t.window.closes)}` : ''}.</b> ${escapeHtml(t.window.t)} ${citeChips(t.window.c, guide)}</div>`;
}

function disputesHtml(t, guide) {
  return (t.disputes ?? [])
    .map(
      (d) => `<div class="differ-box">
      <h4>⇄ Sources differ — ${escapeHtml(d.topic)}</h4>
      <div class="differ-side"><span class="differ-tag">A</span><p>${escapeHtml(d.a.t)} ${citeChips(d.a.c, guide)}</p></div>
      <div class="differ-side"><span class="differ-tag">B</span><p>${escapeHtml(d.b.t)} ${citeChips(d.b.c, guide)}</p></div>
      ${d.call ? `<p class="differ-call"><b>Our call:</b> ${escapeHtml(d.call)}</p>` : ''}
    </div>`,
    )
    .join('');
}

function stepsHtml(t, guide) {
  const steps = t.steps ?? [];
  const multi = steps.filter((s) => new Set(s.c).size >= 2).length;
  return `<h3 class="steps-title">How to earn it · ${steps.length} steps · ${multi} on 2+ sources</h3>
    <ol class="steps">${steps.map((s) => `<li><span>${escapeHtml(s.t)} ${citeChips(s.c, guide)}</span></li>`).join('')}</ol>`;
}

/** Render one trophy into the detail pane. */
export function renderTrophyDetail(el, t, guide, store, handlers) {
  if (!t) {
    el.innerHTML = '<p class="detail-empty">Pick a trophy from the list.</p>';
    return;
  }
  const earned = store.isEarned(t.id);
  const stage = guide.roadmap.stages.find((s) => s.id === t.roadmapStage);
  if (isMasked(t, store)) {
    el.innerHTML = `<div class="detail-masked">
      <span class="grade grade-${t.grade} grade-lg">${GRADE_LETTER[t.grade]}</span>
      <h2>${escapeHtml(maskedName(t))}</h2>
      <p>${escapeHtml(maskedDescription(t))}</p>
      <p class="masked-meta">${GRADE_NAME[t.grade]} · Stage ${stage?.n ?? '?'} · ${t.hidden ? 'hidden on PSN' : 'visible on PSN'}</p>
      <button type="button" class="btn btn-primary" data-reveal="${t.id}">Reveal this trophy</button>
    </div>`;
    el.querySelector('[data-reveal]').addEventListener('click', () => handlers.reveal(t.id));
    return;
  }
  const pills = [
    t.risk === 'missable' ? '<span class="pill pill-missable">Missable</span>' : '',
    t.risk === 'at-risk' ? '<span class="pill pill-risk">At risk</span>' : '',
    t.risk === 'safe' ? '<span class="pill pill-safe">Safe · no deadline</span>' : '',
    (t.disputes ?? []).length ? `<span class="pill pill-dispute">Sources differ · ${t.disputes.length}</span>` : '',
    `<span class="pill pill-kind">${escapeHtml(t.kindLabel ?? t.kind)}</span>`,
    stage ? `<span class="pill pill-stage">Stage ${stage.n}</span>` : '',
    t.hidden ? '<span class="pill pill-hidden">PSN-hidden</span>' : '',
  ].join('');
  el.innerHTML = `<header class="detail-head">
      <span class="grade grade-${t.grade} grade-lg">${GRADE_LETTER[t.grade]}</span>
      <h2 class="detail-name">${escapeHtml(t.name)}</h2>
      <button type="button" class="btn ${earned ? 'btn-earned' : 'btn-primary'}" data-earn="${t.id}">${earned ? '✓ Earned' : 'Mark earned'}</button>
    </header>
    <div class="official">
      <span class="official-label">Official description · ${GRADE_NAME[t.grade]} · #${t.id} of 55 · ${t.hidden ? 'hidden on PSN until earned' : 'visible on PSN'} ${citeChips(guide.roadmap.officialCite, guide)}</span>
      <p class="official-text">“${escapeHtml(t.description)}”</p>
    </div>
    <div class="pill-row">${pills}</div>
    <p class="guide-summary">${escapeHtml(t.guide)}</p>
    ${counterHtml(t, store)}
    <div class="detail-body${t.window || (t.disputes ?? []).length ? ' has-side' : ''}">
      <div class="detail-main">
        ${stepsHtml(t, guide)}
        ${(t.tips ?? []).length ? `<div class="tips"><h4>Tips</h4><ul>${t.tips.map((s) => `<li>${escapeHtml(s.t)} ${citeChips(s.c, guide)}</li>`).join('')}</ul></div>` : ''}
      </div>
      <div class="detail-side">${windowHtml(t, guide)}${disputesHtml(t, guide)}</div>
    </div>`;

  el.querySelector('[data-earn]').addEventListener('click', () => handlers.toggle(t.id));
  const counter = el.querySelector('[data-counter]');
  if (counter) {
    const input = counter.querySelector('input');
    counter.querySelectorAll('[data-step]').forEach((b) =>
      b.addEventListener('click', () => handlers.count(t, store.counter(t.id) + Number(b.dataset.step))),
    );
    input.addEventListener('change', () => handlers.count(t, Number(input.value) || 0));
  }
}

/** The right-hand "Sources for this guide" panel. */
export function renderGuideSources(el, t, guide, store) {
  if (!t || isMasked(t, store)) {
    el.innerHTML = '<h3 class="panel-title">Sources for this guide</h3><p class="panel-note">Hidden with the trophy while the Spoiler Shield covers it.</p>';
    return;
  }
  const ids = sourcesForTrophy(t);
  el.innerHTML = `<h3 class="panel-title">Sources for this guide · ${ids.length}</h3><ul class="src-list">${ids
    .map((id) => {
      const s = guide.sourceById.get(id);
      return `<li><span class="src-n">${id}</span><span><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a><small>${escapeHtml(s.site)} · read ${escapeHtml(s.read)}</small></span></li>`;
    })
    .join('')}</ul>`;
}
