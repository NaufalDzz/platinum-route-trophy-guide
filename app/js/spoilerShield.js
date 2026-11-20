// Spoiler Shield: while on, unearned story trophies and PSN-hidden trophies show a masked name and description.

const revealedThisSession = new Set();

/** Whether a trophy is covered by the shield (story or PSN-hidden). */
export function isShieldable(trophy) {
  return trophy.kind === 'story' || Boolean(trophy.hidden);
}

/** Whether the trophy's name and description should be masked right now. */
export function isMasked(trophy, store) {
  if (!store.setting('spoiler')) return false;
  if (store.isEarned(trophy.id)) return false;
  if (revealedThisSession.has(trophy.id)) return false;
  return isShieldable(trophy);
}

/** Show one trophy for the rest of this session without turning the shield off. */
export function revealOnce(id) {
  revealedThisSession.add(id);
}

/** The text shown in place of a masked trophy's name. */
export function maskedName(trophy) {
  if (trophy.kind === 'story') return `Story trophy · ${trophy.chapter ?? 'main story'}`;
  return `Hidden trophy · ${trophy.kindLabel ?? 'misc'}`;
}

/** The text shown in place of a masked trophy's description. */
export function maskedDescription(trophy) {
  return trophy.kind === 'story'
    ? 'Hidden by the Spoiler Shield until you earn it.'
    : 'PSN hides this one until earned; the shield keeps it covered.';
}

/** How many trophies the shield is covering at the moment. */
export function countMasked(trophies, store) {
  return trophies.filter((t) => isMasked(t, store)).length;
}
