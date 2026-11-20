// Export progress to a JSON file and import it back, validating every entry before anything is applied.

export const BACKUP_FORMAT = 'platinum-route-progress';
export const BACKUP_VERSION = 1;

/** Build the backup object for the current progress. */
export function buildBackup(store, guide, now = new Date()) {
  const snap = store.snapshot();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    game: 'Grand Theft Auto VI (PS5)',
    exportedAt: now.toISOString(),
    earned: snap.earned.map((id) => ({ id, name: guide.trophyById.get(id)?.name ?? '' })),
    counters: snap.counters,
  };
}

/** Offer the backup as a file download (a local blob URL, no network). */
export function downloadBackup(store, guide) {
  const backup = buildBackup(store, guide);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `platinum-route-gta6-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return backup;
}

/**
 * Check a parsed backup against the trophy list. Returns a summary and, when valid, the progress to apply.
 * Unknown ids and out-of-range counters are skipped and reported, never applied.
 */
export function validateBackup(data, guide) {
  const summary = { ok: false, earned: [], counters: {}, skipped: [], errors: [], checked: 0 };
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    summary.errors.push('File is not a JSON object.');
    return summary;
  }
  if (data.format !== BACKUP_FORMAT) summary.errors.push(`Unknown format "${String(data.format ?? 'none')}" (expected ${BACKUP_FORMAT}).`);
  if (data.version !== BACKUP_VERSION) summary.errors.push(`Unsupported version ${String(data.version ?? 'none')}.`);
  if (!Array.isArray(data.earned)) summary.errors.push('Missing "earned" list.');
  if (summary.errors.length) return summary;

  for (const entry of data.earned) {
    summary.checked += 1;
    const id = typeof entry === 'number' ? entry : Number(entry?.id);
    const trophy = guide.trophyById.get(id);
    if (!trophy) summary.skipped.push(`Unknown trophy id ${JSON.stringify(entry?.id ?? entry)}`);
    else if (entry?.name && entry.name !== trophy.name) summary.skipped.push(`Name mismatch for #${id}`);
    else if (!summary.earned.includes(id)) summary.earned.push(id);
  }
  for (const [key, value] of Object.entries(data.counters ?? {})) {
    summary.checked += 1;
    const trophy = guide.trophyById.get(Number(key));
    const target = trophy?.counter?.target;
    if (!trophy || !target) summary.skipped.push(`Counter for #${key} has no tracked count`);
    else if (!Number.isInteger(value) || value < 0 || value > target) summary.skipped.push(`Counter #${key} = ${value} outside 0–${target}`);
    else summary.counters[trophy.id] = value;
  }
  summary.ok = true;
  return summary;
}

/** One-line human summary of a validation result. */
export function describeImport(summary) {
  if (!summary.ok) return `Import refused: ${summary.errors.join(' ')}`;
  const counters = Object.keys(summary.counters).length;
  const skipped = summary.skipped.length ? `, ${summary.skipped.length} skipped` : ', 0 skipped';
  return `Validated ${summary.checked} entries: ${summary.earned.length} earned restored, ${counters} counters restored${skipped}.`;
}

/** Read a chosen file, validate it and apply it to the store when valid. */
export async function importBackupFile(file, store, guide) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return { ok: false, errors: ['File is not valid JSON.'], skipped: [], earned: [], counters: {}, checked: 0 };
  }
  const summary = validateBackup(data, guide);
  if (summary.ok) store.replaceProgress(summary.earned, summary.counters);
  return summary;
}
