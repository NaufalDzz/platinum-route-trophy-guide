// Entry point: loads the data, wires the header, tabs, filters, search and keyboard, and renders the views.
// The Roadmap, Missables and Sources views load on demand with import(), keeping the first load small.

import { loadGuideData, createStore, computeAudit, gradeLine, readShot, shotSample } from './store.js';
import { renderFilterChips, ONLINE_NOTE } from './filters.js';
import { renderTrophyList, renderNextUp, visibleTrophies, GRADE_LETTER } from './trackerView.js';
import { renderTrophyDetail, renderGuideSources } from './trophyDetail.js';
import { revealOnce, countMasked } from './spoilerShield.js';

const $ = (sel) => document.querySelector(sel);
const VIEW_IDS = { tracker: 'tracker-view', roadmap: 'roadmap-view', missables: 'missables-view', sources: 'sources-view' };
// Backup code is only needed when the reader exports or imports, so it loads on first use.
const loadBackupTools = () => import('./exportImport.js');

const LAZY_VIEWS = {
  roadmap: () => import('./roadmapView.js').then((m) => m.renderRoadmapView),
  missables: () => import('./missablesView.js').then((m) => m.renderMissablesView),
  sources: () => import('./sourcesView.js').then((m) => m.renderSourcesView),
};

const app = { guide: null, store: null, audit: null, query: '', shot: null, lastImport: null };

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 4200);
}

/** The audit strip under the header: computed chips. */
function renderAuditStrip(el, a) {
  const chip = (cls, value, label) => `<span class="audit-chip ${cls}"><b>${value}</b>${label}</span>`;
  el.innerHTML = [
    '<span class="audit-label">AUDIT</span>',
    chip('ok', `${a.official}/${a.total}`, 'official'),
    chip('', gradeLine(a), `· ${a.hidden} hidden`),
    chip('ok', `${a.cited}/${a.claims}`, 'claims cited'),
    chip('', `${a.multi}`, `2+ sources · ${a.multiPct}%`),
    chip('', a.pages, `pages · ${a.sites} sites`),
    `<span class="audit-chip red"><b>${a.missable}</b>missable · <b class="amber-n">${a.atRisk}</b>at risk</span>`,
    `<span class="audit-chip violet"><b>${a.disputes}</b>disputes · <b>${a.unconfirmed}</b>unconfirmed</span>`,
    chip('', a.online, 'online'),
  ].join('');
}

function renderHeaderProgress() {
  const { guide, store } = app;
  const earned = store.earnedCount();
  const pct = Math.round((earned / guide.trophies.length) * 100);
  const grades = ['platinum', 'gold', 'silver', 'bronze'].map((g) => {
    const all = guide.trophies.filter((t) => t.grade === g);
    const got = all.filter((t) => store.isEarned(t.id)).length;
    return `<span class="hp-grade"><span class="grade grade-${g}">${GRADE_LETTER[g]}</span>${got}/${all.length}</span>`;
  });
  $('#header-progress').innerHTML = `<span class="hp-count">${earned}<small> / ${guide.trophies.length} earned</small></span>
    <span class="hp-bar-wrap"><span class="hp-bar"><i style="width:${pct}%"></i></span><span class="hp-grades">${grades.join('')}</span></span>`;
  $('#spoiler-toggle').checked = Boolean(store.setting('spoiler'));
  const masked = countMasked(guide.trophies, store);
  $('.switch-label').innerHTML = `Spoiler Shield <b>${store.setting('spoiler') ? `ON · ${masked} masked` : 'OFF · all shown'}</b>`;
  $('#save-state').innerHTML = store.persist ? '✓ Saved in<br>this browser' : 'Sample save<br>not stored';
}

function selectedTrophy() {
  return app.guide.trophyById.get(app.store.setting('selected')) ?? null;
}

function renderTracker() {
  const { guide, store } = app;
  renderFilterChips($('#filter-chips'), guide.trophies, store, (id) => {
    store.setSetting('filter', id);
    if (id === 'online') toast(ONLINE_NOTE);
  });
  const shown = renderTrophyList($('#trophy-list'), guide, store, app.query, store.setting('selected'));
  if (!selectedTrophy() && shown.length) store.setSetting('selected', shown[0].id);
  const t = selectedTrophy();
  renderTrophyDetail($('#trophy-detail'), t, guide, store, {
    toggle: (id) => store.toggleEarned(id),
    count: (trophy, value) => {
      store.setCounter(trophy.id, value, trophy.counter.target);
      if (store.counter(trophy.id) >= trophy.counter.target && !store.isEarned(trophy.id)) toast(`${trophy.name}: target reached — mark it earned when it pops.`);
    },
    reveal: (id) => {
      revealOnce(id);
      renderAll();
    },
  });
  const panel = $('#next-up-panel');
  panel.innerHTML = '<section class="panel" id="next-up"></section><section class="panel" id="guide-sources"></section>';
  renderNextUp($('#next-up'), guide, store, pick);
  renderGuideSources($('#guide-sources'), t, guide, store);
  const row = $(`#trophy-list [data-id="${store.setting('selected')}"]`);
  if (row) row.scrollIntoView({ block: 'nearest' });
}

async function renderActiveView() {
  const view = app.store.setting('view');
  for (const [name, id] of Object.entries(VIEW_IDS)) document.getElementById(id).hidden = name !== view;
  document.querySelectorAll('#nav-tabs .tab').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.view === view)));
  if (view === 'tracker') return renderTracker();
  const render = await LAZY_VIEWS[view]();
  render(document.getElementById(VIEW_IDS[view]), app);
}

function renderAll() {
  renderHeaderProgress();
  return renderActiveView();
}

function pick(id) {
  app.store.setSetting('view', 'tracker');
  app.store.setSetting('selected', id);
}

function moveSelection(delta) {
  const shown = visibleTrophies(app.guide, app.store, app.query);
  if (!shown.length) return;
  const index = shown.findIndex((t) => t.id === app.store.setting('selected'));
  const next = shown[Math.max(0, Math.min(shown.length - 1, index + delta))];
  app.store.setSetting('selected', next.id);
}

function wireControls() {
  const { store } = app;
  document.querySelectorAll('#nav-tabs .tab').forEach((tab) => tab.addEventListener('click', () => store.setSetting('view', tab.dataset.view)));
  $('#spoiler-toggle').addEventListener('change', (e) => store.setSetting('spoiler', e.target.checked));
  // 'search' fires when the browser clears the box itself (Escape or the clear button), which sends no 'input'.
  const onSearch = (e) => {
    if (app.query === e.target.value) return;
    app.query = e.target.value;
    renderTracker();
  };
  $('#search-input').addEventListener('input', onSearch);
  $('#search-input').addEventListener('search', onSearch);
  $('#trophy-list').addEventListener('click', (e) => {
    const check = e.target.closest('[data-check]');
    if (check) return store.toggleEarned(Number(check.dataset.check), check.checked);
    const row = e.target.closest('[data-id]');
    if (row) store.setSetting('selected', Number(row.dataset.id));
  });
  $('#export-btn').addEventListener('click', async () => {
    const { downloadBackup } = await loadBackupTools();
    const backup = downloadBackup(store, app.guide);
    toast(`Exported ${backup.earned.length} earned and ${Object.keys(backup.counters).length} counters to a JSON file.`);
  });
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { importBackupFile, describeImport } = await loadBackupTools();
    app.lastImport = await importBackupFile(file, store, app.guide);
    e.target.value = '';
    toast(describeImport(app.lastImport));
    renderAll();
  });
  $('#reset-btn').addEventListener('click', () => {
    if (confirm('Clear all earned trophies and counters saved in this browser?')) store.reset();
  });
  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches('input, textarea, select');
    if (e.key === '/' && !typing) {
      e.preventDefault();
      store.setSetting('view', 'tracker');
      $('#search-input').focus();
    } else if (e.key === 'Escape' && e.target === $('#search-input')) {
      e.target.blur();
    } else if (!typing && store.setting('view') === 'tracker' && (e.key === 'j' || e.key === 'k')) {
      moveSelection(e.key === 'j' ? 1 : -1);
    } else if (!typing && e.key === 'x' && store.setting('selected')) {
      store.toggleEarned(store.setting('selected'));
    }
  });
}

async function start() {
  app.shot = readShot();
  app.guide = await loadGuideData();
  app.store = createStore(app.shot ? shotSample(app.shot, app.guide.roadmap.coverTrophy) : null);
  app.audit = computeAudit(app.guide);
  document.body.dataset.shot = app.shot ?? '';
  renderAuditStrip($('#audit-strip'), app.audit);
  wireControls();
  app.store.subscribe(() => renderAll());
  await renderAll();
  document.body.dataset.ready = 'true';
}

start().catch((error) => {
  document.body.dataset.ready = 'error';
  $('#views').innerHTML = `<p class="fatal">The guide's data could not be loaded: ${String(error.message)}</p>`;
});
