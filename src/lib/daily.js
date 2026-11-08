/**
 * Provocarea zilei: selectie determinista (acelasi puzzle pentru toti
 * utilizatorii in aceeasi zi) + seria de zile consecutive (streak).
 *
 * Selectia NU depinde de ordinea din puzzles.json, ci de un hash al datei,
 * rotind prin cele 6 niveluri de dificultate.
 */

import { DIFFICULTY_ORDER } from "./sudoku.js";
import AsyncStorage, { STORAGE_KEYS } from "../storage/asyncStorage.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Cheia zilei, in format YYYY-MM-DD (ora locala). */
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Cheia zilei de ieri. */
export function yesterdayKey() {
  return dateKey(new Date(Date.now() - DAY_MS));
}

/** Hash simplu si stabil (FNV-like) dintr-un string. */
function hashString(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Puzzle-ul zilei pentru o data data.
 * Folosim doua "sari" diferite ca selectia la nivel si index sa nu se coreleze.
 */
export function getDailyPuzzle(puzzles, date = new Date()) {
  const key = dateKey(date);
  const levelHash = hashString(`nivel:${key}`);
  const itemHash = hashString(`puzzle:${key}`);

  const level = DIFFICULTY_ORDER[levelHash % DIFFICULTY_ORDER.length];
  const items = puzzles.filter((puzzle) => puzzle.difficulty === level);

  // Daca structura s-ar schimba (0 puzzle-uri la un nivel), cadem la primul.
  const fallback = puzzles[0];
  if (items.length === 0) return { date: key, difficulty: level, puzzle: fallback };

  return {
    date: key,
    difficulty: level,
    puzzle: items[itemHash % items.length],
  };
}

// ---------------- streak (seria de zile) ----------------

/** Incarca starea serii zilnice din storage. */
export async function loadDailyState() {
  return AsyncStorage.getJSON(STORAGE_KEYS.dailyState, {
    lastCompleted: null,
    streak: 0,
  });
}

/** Marcheaza provocarea zilei ca rezolvata astazi si calculeaza seria noua. */
export async function recordDailySolved(currentState) {
  const today = dateKey();

  if (currentState.lastCompleted === today) {
    return currentState; // deja rezolvata azi — seria ramane
  }

  const streak = currentState.lastCompleted === yesterdayKey() ? currentState.streak + 1 : 1;

  const next = { lastCompleted: today, streak };
  await AsyncStorage.setJSON(STORAGE_KEYS.dailyState, next);
  return next;
}

/** Seria activa acum (0 daca seria s-a intrerupt). */
export function activeStreak(state) {
  if (!state?.lastCompleted) return 0;
  const today = dateKey();
  return state.lastCompleted === today || state.lastCompleted === yesterdayKey()
    ? state.streak
    : 0;
}
