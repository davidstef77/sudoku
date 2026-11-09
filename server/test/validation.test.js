import { describe, it, expect } from "vitest";
import puzzles from "../../src/data/puzzles.json";
import {
  sanitizeEntry,
  resolveDaily,
  effectiveStreak,
  dayNumber,
  dayKey,
  todayNumber,
  getCatalogEntry,
  catalogSize,
  validateCredentials,
  sanitizeDisplayName,
  publicName,
  MAX_CLOCK_SKEW_MS,
} from "../src/lib/validation.js";

const NOW = Date.parse("2026-11-09T12:00:00Z");
const puzzle = puzzles[0];
const solved = [...puzzle.solution].map(Number);

describe("catalogul server = puzzles.json din client", () => {
  it("are aceleasi id-uri, dificultati si solutii", () => {
    expect(catalogSize()).toBe(puzzles.length);
    for (const entry of puzzles) {
      expect(getCatalogEntry(entry.id)).toEqual({
        difficulty: entry.difficulty,
        solution: entry.solution,
      });
    }
  });
});

describe("sanitizeEntry", () => {
  it("respinge puzzle-uri inexistente", () => {
    expect(sanitizeEntry({ puzzleId: 0 }, NOW)).toBeNull();
    expect(sanitizeEntry({ puzzleId: 99999 }, NOW)).toBeNull();
    expect(sanitizeEntry({ puzzleId: "abc" }, NOW)).toBeNull();
    expect(sanitizeEntry(null, NOW)).toBeNull();
  });

  it("ia dificultatea din catalog, nu din request (anti XP umflat)", () => {
    const entry = sanitizeEntry({ puzzleId: puzzle.id, difficulty: "extreme" }, NOW);
    expect(entry.difficulty).toBe(puzzle.difficulty);
  });

  it("accepta completed doar cu grila egala cu solutia", () => {
    expect(sanitizeEntry({ puzzleId: puzzle.id, completed: true, values: solved }, NOW).completed).toBe(true);

    const wrong = [...solved];
    wrong[0] = wrong[0] === 9 ? 1 : wrong[0] + 1;
    expect(sanitizeEntry({ puzzleId: puzzle.id, completed: true, values: wrong }, NOW).completed).toBe(false);
    expect(sanitizeEntry({ puzzleId: puzzle.id, completed: true, values: [] }, NOW).completed).toBe(false);
  });

  it("curata valorile si notitele", () => {
    const entry = sanitizeEntry(
      { puzzleId: puzzle.id, values: [5, "7", -3, 42, "x", null], notes: ["1239", "0a1b1", 5] },
      NOW
    );
    expect(entry.values).toEqual([5, 7, 0, 9, 0, 0]);
    expect(entry.notes).toEqual(["1239", "1", "5"]);
  });

  it("aduce timestamp-urile din viitor la acum (+ toleranta)", () => {
    const future = sanitizeEntry({ puzzleId: puzzle.id, updatedAt: NOW + 365 * 864e5 }, NOW);
    expect(future.updatedAt.getTime()).toBe(NOW + MAX_CLOCK_SKEW_MS);

    const past = sanitizeEntry({ puzzleId: puzzle.id, updatedAt: NOW - 1000 }, NOW);
    expect(past.updatedAt.getTime()).toBe(NOW - 1000);

    const garbage = sanitizeEntry({ puzzleId: puzzle.id, updatedAt: "nu-e-data" }, NOW);
    expect(garbage.updatedAt.getTime()).toBe(NOW);
  });

  it("limiteaza contoarele la intervale rezonabile", () => {
    const entry = sanitizeEntry(
      { puzzleId: puzzle.id, elapsed: -5, mistakes: "NaN", hintsUsed: 1e9, correct: 500 },
      NOW
    );
    expect(entry.elapsed).toBe(0);
    expect(entry.mistakes).toBe(0);
    expect(entry.hintsUsed).toBe(81);
    expect(entry.correct).toBe(81);
  });
});

describe("zile calendaristice", () => {
  it("parseaza si respinge date invalide", () => {
    expect(dayKey(dayNumber("2026-11-09"))).toBe("2026-11-09");
    expect(dayNumber("2025-02-31")).toBeNull();
    expect(dayNumber("09-11-2026")).toBeNull();
    expect(dayNumber(null)).toBeNull();
  });
});

describe("resolveDaily (seria zilnica)", () => {
  const today = dayKey(todayNumber(NOW));
  const yesterday = dayKey(todayNumber(NOW) - 1);
  const createdAt = NOW - 365 * 864e5;

  it("NU sterge seria serverului cand clientul are stare goala (dispozitiv nou)", () => {
    const server = { lastCompleted: yesterday, streak: 12 };
    expect(resolveDaily({ lastCompleted: null, streak: 0 }, server, { createdAt, now: NOW })).toBeNull();
  });

  it("ignora o zi mai veche sau egala cu cea de pe server", () => {
    const server = { lastCompleted: today, streak: 5 };
    expect(resolveDaily({ lastCompleted: yesterday, streak: 99 }, server, { now: NOW })).toBeNull();
    expect(resolveDaily({ lastCompleted: today, streak: 99 }, server, { now: NOW })).toBeNull();
  });

  it("seria creste cel mult cu o zi pe zi", () => {
    const server = { lastCompleted: yesterday, streak: 5 };
    expect(resolveDaily({ lastCompleted: today, streak: 6 }, server, { now: NOW })).toEqual({
      lastCompleted: today,
      streak: 6,
    });
    expect(resolveDaily({ lastCompleted: today, streak: 500 }, server, { now: NOW }).streak).toBe(6);
  });

  it("o serie rupta pe client (streak 1) e acceptata", () => {
    const server = { lastCompleted: dayKey(todayNumber(NOW) - 10), streak: 5 };
    expect(resolveDaily({ lastCompleted: today, streak: 1 }, server, { now: NOW }).streak).toBe(1);
  });

  it("prima sincronizare e plafonata la varsta contului", () => {
    const newAccount = NOW - 2 * 864e5;
    expect(
      resolveDaily({ lastCompleted: today, streak: 300 }, null, { createdAt: newAccount, now: NOW }).streak
    ).toBe(4);
  });

  it("respinge datele din viitor si formatele invalide", () => {
    const future = dayKey(todayNumber(NOW) + 5);
    expect(resolveDaily({ lastCompleted: future, streak: 3 }, null, { createdAt, now: NOW })).toBeNull();
    expect(resolveDaily({ lastCompleted: "maine", streak: 3 }, null, { createdAt, now: NOW })).toBeNull();
  });
});

describe("effectiveStreak", () => {
  it("o serie veche e considerata rupta", () => {
    expect(effectiveStreak({ lastCompleted: dayKey(todayNumber(NOW) - 1), streak: 7 }, NOW)).toBe(7);
    expect(effectiveStreak({ lastCompleted: dayKey(todayNumber(NOW) - 30), streak: 7 }, NOW)).toBe(0);
    expect(effectiveStreak(null, NOW)).toBe(0);
  });
});

describe("autentificare", () => {
  it("valideaza emailul si lungimea parolei", () => {
    expect(validateCredentials("a@b.ro", "123456")).toBeNull();
    expect(validateCredentials("nu-e-email", "123456")).toMatch(/Email/);
    expect(validateCredentials("a@b.ro", "123")).toMatch(/minim/);
    expect(validateCredentials("a@b.ro", "x".repeat(129))).toMatch(/maxim/);
  });

  it("curata numele afisat", () => {
    expect(sanitizeDisplayName("  Ana \u0000  Maria\n ")).toBe("Ana Maria");
    expect(sanitizeDisplayName("x".repeat(100))).toHaveLength(40);
  });

  it("numele public nu expune emailul", () => {
    const user = { email: "ion.popescu@example.com", displayName: "" };
    const name = publicName(user, "65a1b2c3d4e5f6a7b8c9d0e1");
    expect(name).toBe("Jucător #D0E1");
    expect(name).not.toMatch(/ion/);
    expect(publicName({ displayName: "Ion" }, "x")).toBe("Ion");
  });
});
