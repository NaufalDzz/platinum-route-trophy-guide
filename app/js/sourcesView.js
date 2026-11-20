// Sources, Audit & Backup view: computed audit tiles, the Export/Import panel with its validation summary,
// and the table of every page read with the number of claims it backs.

import { escapeHtml, sourceUsage, collectClaims, gradeLine } from './store.js';
import { buildBackup, validateBackup, describeImport, downloadBackup } from './exportImport.js';

function tile(value, label, tone = 'ink') {
  return `<div class="audit-tile tone-${tone}"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`;
}

function importPanel(app) {
  const { store, guide } = app;
  // In screenshot mode, show the round trip of the sample save: export it, then validate it as an import would.
  const summary = app.lastImport ?? (app.shot ? validateBackup(buildBackup(store, guide, new Date('2026-11-20T12:00:00Z')), guide) : null);
  const rows = summary
    ? `<div class="import-result ${summary.ok ? 'ok' : 'bad'}">
        <b>${summary.ok ? '✓ Import validated' : '✗ Import refused'}</b>
        <p>${escapeHtml(describeImport(summary))}</p>
        <ul>
          <li><span>Entries checked</span><b>${summary.checked}</b></li>
          <li><span>Earned trophies restored</span><b>${summary.earned.length}</b></li>
          <li><span>Counters restored</span><b>${Object.keys(summary.counters).length}</b></li>
          <li><span>Skipped (unknown / out of range)</span><b>${summary.skipped.length}</b></li>
        </ul>
      </div>`
    : '<p class="panel-note">No import yet this session. Choose a backup file to see its validation summary here.</p>';
  return `<section class="backup-panel">
    <h3>Backup: Export &amp; Import JSON</h3>
    <p class="panel-note">Progress lives in this browser (localStorage). Export writes a JSON file; Import checks every id and counter against the official list before restoring anything.</p>
    <div class="backup-actions"><button type="button" class="btn btn-primary" data-export>Export JSON</button><button type="button" class="btn btn-light btn-outline" data-import>Import JSON</button></div>
    ${rows}
  </section>`;
}

/** Pages read and claims backed per site, most-cited site first. */
function siteSummary(guide, usage) {
  const bySite = new Map();
  for (const s of guide.sources) {
    const row = bySite.get(s.site) ?? { site: s.site, pages: 0, claims: 0 };
    row.pages += 1;
    row.claims += usage.get(s.id).claims;
    bySite.set(s.site, row);
  }
  return [...bySite.values()].sort((a, b) => b.claims - a.claims);
}

/** Render the sources page. */
export function renderSourcesView(el, app) {
  const { guide, audit } = app;
  const usage = sourceUsage(guide, collectClaims(guide));
  const sites = [...new Set(guide.sources.map((s) => s.site))];
  el.innerHTML = `<div class="page">
    <header class="page-head">
      <h2 class="page-title">Sources, Audit &amp; Backup</h2>
      <p class="page-sub">${audit.pages} pages on ${audit.sites} sites, read ${escapeHtml(audit.readOn)} · guides are in our own words; links open only when you follow them</p>
    </header>
    <div class="audit-tiles">
      ${tile(`${audit.official}/${audit.total}`, 'official name · desc · grade', 'green')}
      ${tile(gradeLine(audit), `grades · ${audit.hidden} PSN-hidden`)}
      ${tile(`${audit.cited}/${audit.claims}`, 'claims cited', 'green')}
      ${tile(String(audit.multi), `backed by 2+ sources · ${audit.multiPct}%`, 'indigo')}
      ${tile(`${audit.guidesCited}/${audit.total}`, 'guides fully cited', 'green')}
      ${tile(String(audit.pages), `pages read · ${audit.sites} sites`, 'indigo')}
      ${tile(`${audit.disputes} · ${audit.unconfirmed}`, 'disputes shown · unconfirmed', 'violet')}
      ${tile(String(audit.online), 'online trophies', 'ink')}
    </div>
    <div class="sources-grid">
      ${importPanel(app)}
      <section class="source-table-wrap">
        <h3>Every page read · ${sites.length} sites</h3>
        <div class="site-strip">${siteSummary(guide, usage)
          .map((x) => `<span class="site-chip">${escapeHtml(x.site)} <small>${x.pages} pages · ${x.claims} claims</small></span>`)
          .join('')}</div>
        <table class="source-table">
          <thead><tr><th>#</th><th>Site</th><th>Page read</th><th>Read</th><th>Claims</th><th>Guides</th></tr></thead>
          <tbody>${guide.sources
            .map((s) => {
              const u = usage.get(s.id);
              return `<tr><td class="num">${s.id}</td><td><span class="site-badge">${escapeHtml(s.site)}</span></td>
                <td><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a><small>${escapeHtml(s.url.replace(/^https?:\/\/(www\.)?/, ''))}</small></td>
                <td class="nowrap">${escapeHtml(app.guide.readOn)}</td><td class="num">${u.claims}</td><td class="num">${u.guides.size}</td></tr>`;
            })
            .join('')}</tbody>
        </table>
      </section>
    </div>
  </div>`;
  el.querySelector('[data-export]').addEventListener('click', () => downloadBackup(app.store, guide));
  el.querySelector('[data-import]').addEventListener('click', () => document.getElementById('import-file').click());
}
