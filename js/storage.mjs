const RESULTS = 'science-mystery:v1:results';
const PREFERENCES = 'science-mystery:v1:preferences';
const unavailable = 'Browser storage is unavailable. You can still play, but changes may not be saved.';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validResult(value) {
  return isRecord(value) && [300, 350].includes(value.score)
    && typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt));
}

function readResults(storage) {
  const raw = storage.getItem(RESULTS);
  if (raw === null) return {};
  const results = JSON.parse(raw);
  if (!isRecord(results) || !Object.values(results).every(validResult)) {
    throw new Error('Invalid saved results');
  }
  return results;
}

export function loadSaved(storage) {
  let results = {};
  let preferences = { sound: false, darkMode: true };
  let warning = null;
  if (!storage) return { results, preferences, warning: unavailable };
  try {
    results = readResults(storage);
  } catch {
    warning = 'Saved results could not be read. They have not been changed. Clear saved data to reset them.';
  }
  try {
    const raw = storage.getItem(PREFERENCES);
    if (raw !== null) {
      const value = JSON.parse(raw);
      if (!isRecord(value) || typeof value.sound !== 'boolean') throw new Error('Invalid preferences');
      preferences = { sound: value.sound, darkMode: value.darkMode !== false };
    }
  } catch {
    warning ??= 'Saved preferences could not be read. Sound is off; you can still play.';
  }
  return { results, preferences, warning };
}

export function saveResult(storage, chapterId, result) {
  if (!result?.finished || result.debug !== false || !validResult(result)
      || !/^[a-z0-9-]+$/.test(chapterId)) {
    return { saved: false, warning: 'This run is not eligible to be saved.' };
  }
  if (!storage) return { saved: false, warning: unavailable };
  try {
    const results = readResults(storage);
    if (Object.hasOwn(results, chapterId)) return { saved: false, warning: null };
    results[chapterId] = { score: result.score, completedAt: result.completedAt };
    storage.setItem(RESULTS, JSON.stringify(results));
    return { saved: true, warning: null };
  } catch {
    return { saved: false, warning: 'Your result could not be saved. Existing data has not been replaced.' };
  }
}

export function savePreferences(storage, preferences) {
  if (!storage) return { saved: false, warning: unavailable };
  try {
    storage.setItem(PREFERENCES, JSON.stringify({ sound: preferences.sound === true, darkMode: preferences.darkMode !== false }));
    return { saved: true, warning: null };
  } catch {
    return { saved: false, warning: 'Your preferences could not be saved.' };
  }
}

export function clearSaved(storage) {
  if (!storage) return { cleared: false, warning: unavailable };
  try {
    storage.removeItem(RESULTS);
    storage.removeItem(PREFERENCES);
    if (storage.getItem(RESULTS) !== null || storage.getItem(PREFERENCES) !== null) {
      throw new Error('Storage did not clear');
    }
    return { cleared: true, warning: null };
  } catch {
    return { cleared: false, warning: 'Some saved data could not be cleared. Try again in your browser settings.' };
  }
}
