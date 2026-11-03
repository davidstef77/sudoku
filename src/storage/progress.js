/**
 * Salvare / incarcare progres cu AsyncStorage.
 * Fiecare puzzle are propria cheie: progress:<id>.
 */

import AsyncStorage, { STORAGE_KEYS } from "./asyncStorage.js";

const EMPTY_STATS = {
  solved: 0,
  attempted: 0,
  totalSeconds: 0,
  bestTimes: {}, // { easy: sec, medium: sec, hard: sec }
};

/** Progresul unui puzzle, sau null daca nu a fost inceput. */
export async function loadProgress(id) {
  return AsyncStorage.getJSON(STORAGE_KEYS.progress(id), null);
}

/** Salveaza progresul unui puzzle. */
export async function saveProgress(id, data) {
  const payload = { ...data, id, updatedAt: Date.now() };
  await AsyncStorage.setJSON(STORAGE_KEYS.progress(id), payload);
  return payload;
}

/** Sterge progresul unui puzzle. */
export async function clearProgress(id) {
  await AsyncStorage.removeItem(STORAGE_KEYS.progress(id));
}

/**
 * Incarca progresul pentru toate puzzle-urile incepute.
 * Returneaza un obiect { [id]: progress }.
 */
export async function loadAllProgress() {
  const keys = await AsyncStorage.getAllKeys();
  const progressKeys = keys.filter((key) => key.startsWith("progress:"));

  const entries = await AsyncStorage.multiGet(progressKeys);
  const result = {};

  for (const [, raw] of entries) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.id) result[parsed.id] = parsed;
    } catch {
      // ignoram intrarile corupte
    }
  }

  return result;
}

/** Statistici globale. */
export async function loadStats() {
  const stats = await AsyncStorage.getJSON(STORAGE_KEYS.stats, null);
  return { ...EMPTY_STATS, ...(stats || {}) };
}

/** Actualizeaza statisticile dupa un puzzle rezolvat. */
export async function recordSolved(difficulty, seconds) {
  const stats = await loadStats();

  stats.solved += 1;
  stats.totalSeconds += seconds;

  const previousBest = stats.bestTimes?.[difficulty];
  if (!previousBest || seconds < previousBest) {
    stats.bestTimes = { ...stats.bestTimes, [difficulty]: seconds };
  }

  await AsyncStorage.setJSON(STORAGE_KEYS.stats, stats);
  return stats;
}

/** Retine ultimul puzzle deschis (pentru butonul „Continua"). */
export async function setLastPlayed(id) {
  await AsyncStorage.setJSON(STORAGE_KEYS.lastPlayed, { id, at: Date.now() });
}

/** Citeste ultimul puzzle deschis. */
export async function getLastPlayed() {
  const data = await AsyncStorage.getJSON(STORAGE_KEYS.lastPlayed, null);
  return data?.id ?? null;
}

/** Sterge tot progresul si statisticile. */
export async function resetEverything() {
  await AsyncStorage.clear();
}
