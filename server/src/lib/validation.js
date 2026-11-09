/**
 * Validare si normalizare server-side (functii pure, testabile fara DB).
 *
 * Principiu: clientul NU este sursa de adevar pentru nimic ce influenteaza
 * XP-ul, clasamentul sau realizarile. Serverul:
 *   - ia dificultatea din catalogul propriu (nu din request);
 *   - accepta "completed: true" doar daca valorile trimise sunt exact solutia;
 *   - nu accepta timestamp-uri din viitor (ar bloca alte dispozitive);
 *   - limiteaza seria zilnica la ce e posibil calendaristic.
 */

import { readFileSync } from "node:fs";

export const DIFFICULTIES = ["easy", "medium", "hard", "expert", "master", "extreme"];

/** Toleranta de ceas intre client si server (ms). */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------- catalogul de puzzle-uri ----------------

/**
 * { "<id>": [difficulty, solution] } — generat din src/data/puzzles.json
 * de scripts/generatePuzzles.mjs. Citit cu fs (nu import JSON) pentru
 * compatibilitate cu toate versiunile Node de pe Vercel.
 */
const CATALOG = JSON.parse(
  readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")
);

/** @returns {{difficulty: string, solution: string} | null} */
export function getCatalogEntry(puzzleId) {
  const row = CATALOG[puzzleId];
  return row ? { difficulty: row[0], solution: row[1] } : null;
}

export function catalogSize() {
  return Object.keys(CATALOG).length;
}

// ---------------- progres ----------------

/** Intreg in [min, max], altfel fallback. */
function clampInt(value, min, max, fallback = min) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/**
 * Valideaza si normalizeaza o intrare de progres din request.
 * @returns {object|null} intrarea curata sau null daca e inutilizabila.
 */
export function sanitizeEntry(raw, now = Date.now()) {
  const puzzleId = Number(raw?.puzzleId);
  if (!Number.isInteger(puzzleId)) return null;

  const catalogEntry = getCatalogEntry(puzzleId);
  if (!catalogEntry) return null;

  // Valori: exact cifre 0..9 (0 = gol), maxim 81.
  const values = Array.isArray(raw.values)
    ? raw.values.slice(0, 81).map((value) => clampInt(value, 0, 9, 0))
    : [];

  // Notite: doar cifrele 1..9, fara dubluri, maxim 81 de celule.
  const notes = Array.isArray(raw.notes)
    ? raw.notes.slice(0, 81).map((note) =>
        [...new Set(String(note ?? "").replace(/[^1-9]/g, ""))].join("")
      )
    : [];

  // Un puzzle e "rezolvat" doar daca grila trimisa este exact solutia.
  const completed =
    Boolean(raw.completed) &&
    values.length === 81 &&
    values.join("") === catalogEntry.solution;

  // Timestamp-urile din viitor sunt aduse la "acum" (last-write-wins corect).
  const parsed = new Date(raw.updatedAt ?? now).getTime();
  const updatedAt = Number.isFinite(parsed)
    ? Math.min(parsed, now + MAX_CLOCK_SKEW_MS)
    : now;

  return {
    puzzleId,
    difficulty: catalogEntry.difficulty,
    values,
    notes,
    elapsed: clampInt(raw.elapsed, 0, 7 * 24 * 3600, 0),
    mistakes: clampInt(raw.mistakes, 0, 10_000, 0),
    hintsUsed: clampInt(raw.hintsUsed, 0, 81, 0),
    correct: clampInt(raw.correct, 0, 81, 0),
    completed,
    updatedAt: new Date(updatedAt),
  };
}

// ---------------- seria zilnica ----------------

/** "YYYY-MM-DD" -> numarul zilei (UTC), sau null daca data e invalida. */
export function dayNumber(key) {
  if (typeof key !== "string" || !DATE_RE.test(key)) return null;
  const time = Date.parse(`${key}T00:00:00Z`);
  if (!Number.isFinite(time)) return null;
  // Respinge date "rotunjite" de parser, ex. 2025-02-31.
  if (new Date(time).toISOString().slice(0, 10) !== key) return null;
  return Math.floor(time / DAY_MS);
}

/** Ziua curenta UTC, ca numar. */
export function todayNumber(now = Date.now()) {
  return Math.floor(now / DAY_MS);
}

/** Numarul zilei -> "YYYY-MM-DD". */
export function dayKey(number) {
  return new Date(number * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Decide noua stare a seriei zilnice, pe baza a ce trimite clientul.
 * Cheile de zi sunt in ora LOCALA a clientului, deci permitem ±1 zi fata
 * de UTC (fusurile orare merg de la -12h la +14h).
 *
 * @param {{lastCompleted: string|null, streak: number}|null} client
 * @param {{lastCompleted?: string|null, streak?: number}|null} server
 * @param {{createdAt?: Date|string|number, now?: number}} options
 * @returns {{lastCompleted: string, streak: number} | null} null = nu schimbam nimic
 */
export function resolveDaily(client, server, { createdAt, now = Date.now() } = {}) {
  if (!client || typeof client !== "object") return null;

  const clientDay = dayNumber(client.lastCompleted);
  // Fara zi valida (ex. dispozitiv nou cu stare goala) NU stergem seria serverului.
  if (clientDay === null) return null;
  if (clientDay > todayNumber(now) + 1) return null; // data din viitor

  const clientStreak = clampInt(client.streak, 0, 100_000, 0);
  if (clientStreak < 1) return null;

  const serverDay = dayNumber(server?.lastCompleted);
  const serverStreak = clampInt(server?.streak, 0, 100_000, 0);

  let cap;
  if (serverDay !== null) {
    // Mai vechi sau aceeasi zi: serverul are deja informatia.
    if (clientDay <= serverDay) return null;
    // Seria poate creste cel mult cu o unitate pe zi scursa.
    cap = serverStreak + (clientDay - serverDay);
  } else {
    // Prima sincronizare: seria nu poate depasi varsta contului (+ slack fus orar).
    const created = new Date(createdAt ?? now).getTime();
    const createdDay = todayNumber(Number.isFinite(created) ? created : now);
    cap = Math.max(1, clientDay - createdDay + 2);
  }

  return {
    lastCompleted: client.lastCompleted,
    streak: Math.max(1, Math.min(clientStreak, cap)),
  };
}

/**
 * Seria "vie": daca ultima zi rezolvata e mai veche decat ieri (in orice
 * fus orar), seria e de fapt rupta, chiar daca documentul inca o retine.
 */
export function effectiveStreak(daily, now = Date.now()) {
  const day = dayNumber(daily?.lastCompleted);
  if (day === null) return 0;
  if (day < streakCutoffDay(now)) return 0;
  return clampInt(daily?.streak, 0, 100_000, 0);
}

/** Prima zi (numar) pentru care o serie mai e considerata activa. */
export function streakCutoffDay(now = Date.now()) {
  return todayNumber(now) - 2;
}

// ---------------- autentificare ----------------

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 128;
export const DISPLAY_NAME_MAX = 40;

export function validateCredentials(email, password) {
  if (!email || typeof email !== "string") return "Emailul este obligatoriu.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Email invalid.";
  }
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return `Parola trebuie să aibă minim ${PASSWORD_MIN} caractere.`;
  }
  if (password.length > PASSWORD_MAX) {
    return `Parola poate avea maxim ${PASSWORD_MAX} de caractere.`;
  }
  return null;
}

/** Nume afisat curatat: fara caractere de control, spatii comprimate. */
export function sanitizeDisplayName(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DISPLAY_NAME_MAX);
}

/**
 * Numele public in clasament. Nu expunem NICIODATA emailul (nici partea
 * dinainte de @) — fallback anonim stabil, derivat din id.
 */
export function publicName(user, userId) {
  const name = sanitizeDisplayName(user?.displayName);
  if (name) return name;
  const id = String(userId ?? user?._id ?? "");
  return `Jucător #${id.slice(-4).toUpperCase() || "0000"}`;
}
