// Citation chips and the claim index: every cited statement in the data, so counts are computed, never typed.

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** `[n]` chips for a list of source ids; each opens the source page in a new tab only when followed. */
export function citeChips(ids, guide) {
  return (ids ?? [])
    .map((id) => {
      const s = guide.sourceById.get(id);
      if (!s) return '';
      const title = escapeHtml(`${s.site} — ${s.title} (read ${s.read})`);
      return `<a class="cite" href="${escapeHtml(s.url)}" target="_blank" rel="noopener" title="${title}">${id}</a>`;
    })
    .join('');
}

/**
 * Every cited claim in the guide: each trophy's official text, steps, tips, missable windows and dispute sides, plus roadmap
 * statements. Each item is { where, text, cites, trophyId }.
 */
export function collectClaims(guide) {
  const claims = [];
  const add = (where, item, trophyId = null) => {
    if (item && item.t) claims.push({ where, text: item.t, cites: item.c ?? [], trophyId });
  };
  for (const t of guide.trophies) {
    add('official', { t: `${t.name}: ${t.description} (${t.grade})`, c: guide.roadmap.officialCite }, t.id);
    (t.steps ?? []).forEach((s) => add('step', s, t.id));
    (t.tips ?? []).forEach((s) => add('tip', s, t.id));
    if (t.window) add('window', t.window, t.id);
    for (const d of t.disputes ?? []) {
      add('dispute', d.a, t.id);
      add('dispute', d.b, t.id);
    }
  }
  const r = guide.roadmap;
  (r.kpis ?? []).forEach((k) => add('roadmap', { t: `${k.label}: ${k.value}`, c: k.c }));
  for (const stage of r.stages ?? []) {
    (stage.steps ?? []).forEach((s) => add('roadmap', s));
    if (stage.stop) add('roadmap', stage.stop);
  }
  for (const ch of r.chapters ?? []) if (ch.pnr) add('timeline', ch.pnr);
  return claims;
}

/** Distinct source ids that a trophy's guide cites. */
export function sourcesForTrophy(trophy) {
  const ids = new Set();
  const take = (item) => (item?.c ?? []).forEach((id) => ids.add(id));
  (trophy.steps ?? []).forEach(take);
  (trophy.tips ?? []).forEach(take);
  take(trophy.window);
  for (const d of trophy.disputes ?? []) {
    take(d.a);
    take(d.b);
  }
  return [...ids].sort((a, b) => a - b);
}

/** How many claims each source backs, and in how many trophy guides it is cited. */
export function sourceUsage(guide, claims = collectClaims(guide)) {
  const usage = new Map(guide.sources.map((s) => [s.id, { claims: 0, guides: new Set() }]));
  for (const claim of claims) {
    for (const id of new Set(claim.cites)) {
      const u = usage.get(id);
      if (!u) continue;
      u.claims += 1;
      if (claim.trophyId) u.guides.add(claim.trophyId);
    }
  }
  return usage;
}
