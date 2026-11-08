/**
 * Test de paritate: logica partajata (XP + realizari) exista in doua copii —
 * client (src/lib) si server (server/src/lib, pentru ca Vercel nu poate
 * importa fisiere din afara folderului deployat). Acest test blocheaza
 * orice divergenta accidentala intre ele.
 */

import { describe, it, expect } from "vitest";
import * as clientXp from "./xp.js";
import * as serverXp from "../../server/src/lib/xp.js";
import * as clientAch from "./achievements.js";
import * as serverAch from "../../server/src/lib/achievements.js";

describe("Paritate client/server pentru logica partajata", () => {
  it("tabelul XP este identic", () => {
    expect(serverXp.XP_PER_DIFFICULTY).toEqual(clientXp.XP_PER_DIFFICULTY);
  });

  it("functiile de nivel produc aceleasi rezultate", () => {
    for (const xp of [0, 1, 99, 100, 250, 1000, 12345]) {
      expect(serverXp.levelForXp(xp)).toBe(clientXp.levelForXp(xp));
      expect(serverXp.totalXpForLevel(xp)).toBe(clientXp.totalXpForLevel(xp));
      expect(serverXp.levelProgress(xp)).toEqual(clientXp.levelProgress(xp));
    }
  });

  it("definitiile realizarilor sunt identice", () => {
    // Functiile (condition/progress) sunt excluse din comparatia serializata —
    // comportamentul lor e verificat de testul de evaluare de mai jos.
    const plain = (achievements) =>
      JSON.parse(JSON.stringify(achievements));
    expect(plain(serverAch.ACHIEVEMENTS)).toEqual(plain(clientAch.ACHIEVEMENTS));
    expect(serverAch.ACHIEVEMENT_CATEGORIES).toEqual(clientAch.ACHIEVEMENT_CATEGORIES);
    expect(serverAch.RARITIES).toEqual(clientAch.RARITIES);

    // Acelasi numar si ordine de id-uri, ca evaluarea sa fie echivalenta.
    expect(serverAch.ACHIEVEMENTS.map((a) => a.id)).toEqual(
      clientAch.ACHIEVEMENTS.map((a) => a.id)
    );
  });

  it("evaluarea realizarilor produce aceleasi rezultate", () => {
    const contexts = [
      { solved: 0, solvedByDifficulty: {}, bestTimes: {}, streak: 0, perfectSolves: 0 },
      { solved: 42, solvedByDifficulty: { easy: 30, expert: 12 }, bestTimes: { easy: 120, expert: 900 }, streak: 8, perfectSolves: 3 },
      { solved: 1000, solvedByDifficulty: { extreme: 100 }, bestTimes: { extreme: 150 }, streak: 100, perfectSolves: 50 },
    ];

    for (const context of contexts) {
      expect(serverAch.evaluateAchievements(context)).toEqual(
        clientAch.evaluateAchievements(context)
      );
    }
  });
});
