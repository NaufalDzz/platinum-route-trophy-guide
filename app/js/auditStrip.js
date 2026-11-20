// The audit: every number is computed live from app/data/*.json when the page loads.

import { collectClaims } from './citations.js';

const GRADE_KEYS = ['platinum', 'gold', 'silver', 'bronze'];

/** Compute the audit figures shown in the strip and on the Sources view. */
export function computeAudit(guide) {
  const { trophies, sources } = guide;
  const claims = collectClaims(guide);
  const grades = Object.fromEntries(GRADE_KEYS.map((g) => [g, trophies.filter((t) => t.grade === g).length]));
  const official = trophies.filter((t) => t.name && t.description && GRADE_KEYS.includes(t.grade)).length;
  const cited = claims.filter((c) => c.cites.length > 0).length;
  const multi = claims.filter((c) => new Set(c.cites).size >= 2).length;
  const steps = trophies.reduce((n, t) => n + (t.steps ?? []).length, 0);
  const stepsCited = trophies.reduce((n, t) => n + (t.steps ?? []).filter((s) => (s.c ?? []).length > 0).length, 0);
  const guidesCited = trophies.filter(
    (t) => String(t.guide ?? '').trim() && (t.steps ?? []).length > 0 && t.steps.every((s) => (s.c ?? []).length > 0),
  ).length;
  return {
    total: trophies.length,
    official,
    grades,
    hidden: trophies.filter((t) => t.hidden).length,
    claims: claims.length,
    cited,
    multi,
    multiPct: claims.length ? Math.round((multi / claims.length) * 100) : 0,
    steps,
    stepsCited,
    guidesCited,
    pages: sources.length,
    sites: new Set(sources.map((s) => s.site)).size,
    readOn: guide.readOn,
    missable: trophies.filter((t) => t.risk === 'missable').length,
    atRisk: trophies.filter((t) => t.risk === 'at-risk').length,
    disputes: trophies.reduce((n, t) => n + (t.disputes ?? []).length, 0),
    disputedTrophies: trophies.filter((t) => (t.disputes ?? []).length).length,
    unconfirmed: trophies.reduce((n, t) => n + (t.disputes ?? []).filter((d) => d.unconfirmed).length, 0),
    online: trophies.filter((t) => t.online).length,
  };
}

/** "1P 2G 6S 46B" from the computed grade counts. */
export function gradeLine(a) {
  return `${a.grades.platinum}P ${a.grades.gold}G ${a.grades.silver}S ${a.grades.bronze}B`;
}

/** Fill the strip under the header with computed chips. */
export function renderAuditStrip(el, a) {
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
