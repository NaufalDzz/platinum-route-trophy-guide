// Text search over trophies. Masked trophies are matched only on their masked label, so search never leaks spoilers.

import { isMasked, maskedName } from './spoilerShield.js';

function normalise(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'*$ ]+/g, ' ');
}

/** The searchable text for one trophy, given what the reader is allowed to see. */
export function searchableText(trophy, store) {
  if (isMasked(trophy, store)) return normalise(`${maskedName(trophy)} ${trophy.kindLabel ?? ''}`);
  const steps = (trophy.steps ?? []).map((s) => s.t).join(' ');
  return normalise(`${trophy.name} ${trophy.description} ${trophy.guide} ${steps} ${trophy.chapter ?? ''} ${trophy.kindLabel ?? ''}`);
}

/** Whether every word of the query appears in the trophy's text. */
export function matchesQuery(trophy, query, store) {
  const words = normalise(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const haystack = searchableText(trophy, store);
  return words.every((w) => haystack.includes(w));
}
