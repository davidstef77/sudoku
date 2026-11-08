import { describe, it, expect } from "vitest";
import {
  XP_PER_DIFFICULTY,
  levelForXp,
  totalXpForLevel,
  levelProgress,
  rankForLevel,
} from "./xp.js";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  achievementProgress,
} from "./achievements.js";

describe("XP si nivele", () => {
  it("tabelul de XP pe dificultate este cel cerut", () => {
    expect(XP_PER_DIFFICULTY).toEqual({
      easy: 10,
      medium: 20,
      hard: 35,
      expert: 50,
      master: 75,
      extreme: 100,
    });
  });

  it("nivelul 1 incepe de la 0 XP", () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(levelForXp(0)).toBe(1);
  });

  it("curba de nivel este monoton crescatoare", () => {
    for (let level = 1; level <= 30; level++) {
      expect(totalXpForLevel(level + 1)).toBeGreaterThan(totalXpForLevel(level));
    }
  });

  it("nivelul creste odata cu XP-ul si nu salt peste praguri", () => {
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2); // 100 XP pentru nivelul 2
    expect(levelForXp(249)).toBe(2); // nivelul 3 necesita 100+150=250
    expect(levelForXp(250)).toBe(3);
  });

  it("levelProgress calculeaza corect segmentul curent", () => {
    const progress = levelProgress(150);
    expect(progress.level).toBe(2);
    expect(progress.xpInLevel).toBe(50);
    expect(progress.xpForNext).toBe(150);
    expect(progress.percent).toBe(33);
  });

  it("rankForLevel returneaza un titlu valid", () => {
    expect(rankForLevel(1)).toBe("Începător");
    expect(typeof rankForLevel(50)).toBe("string");
  });
});

describe("Realizari (achievements)", () => {
  const emptyContext = {
    solved: 0,
    solvedByDifficulty: {},
    bestTimes: {},
    streak: 0,
    perfectSolves: 0,
  };

  it("fara activitate, nimic nu e deblocat", () => {
    expect(evaluateAchievements(emptyContext)).toEqual([]);
  });

  it("prima rezolvare deblocheaza doar realizarile de progres mici", () => {
    const unlocked = evaluateAchievements({ ...emptyContext, solved: 1 });
    expect(unlocked).toContain("first-solve");
    expect(unlocked).not.toContain("solved-10");
  });

  it("pragurile de progres functioneaza exact", () => {
    expect(evaluateAchievements({ ...emptyContext, solved: 10 })).toContain("solved-10");
    expect(evaluateAchievements({ ...emptyContext, solved: 49 })).not.toContain("solved-50");
    expect(evaluateAchievements({ ...emptyContext, solved: 500 })).toContain("solved-500");
    expect(evaluateAchievements({ ...emptyContext, solved: 999 })).not.toContain("solved-1000");
  });

  it("dificultatea Expert/Maestru/Extrem deblocheaza realizarile lor", () => {
    expect(
      evaluateAchievements({ ...emptyContext, solvedByDifficulty: { expert: 1 } })
    ).toContain("expert-first");
    expect(
      evaluateAchievements({ ...emptyContext, solvedByDifficulty: { master: 3 } })
    ).toContain("master-first");
    expect(
      evaluateAchievements({ ...emptyContext, solvedByDifficulty: { extreme: 1 } })
    ).toContain("extreme-first");
  });

  it("viteza: bestTimes sub praguri deblocheaza realizarile de speed", () => {
    expect(evaluateAchievements({ ...emptyContext, bestTimes: { easy: 599 } })).toContain(
      "speed-10min"
    );
    expect(evaluateAchievements({ ...emptyContext, bestTimes: { easy: 601 } })).not.toContain(
      "speed-10min"
    );
    expect(
      evaluateAchievements({ ...emptyContext, bestTimes: { expert: 1199 } })
    ).toContain("speed-expert-20min");
    expect(
      evaluateAchievements({ ...emptyContext, bestTimes: { expert: 1201 } })
    ).not.toContain("speed-expert-20min");
  });

  it("consistent: seria zilnica deblocheaza pragurile", () => {
    expect(evaluateAchievements({ ...emptyContext, streak: 3 })).toContain("streak-3");
    expect(evaluateAchievements({ ...emptyContext, streak: 6 })).not.toContain("streak-7");
    expect(evaluateAchievements({ ...emptyContext, streak: 100 })).toContain("streak-100");
  });

  it("perfectiune: fara greseli si fara hint-uri", () => {
    expect(evaluateAchievements({ ...emptyContext, perfectSolves: 1 })).toContain("perfect-1");
    expect(evaluateAchievements({ ...emptyContext, perfectSolves: 9 })).not.toContain("perfect-10");
  });

  it("toate realizarile au structura completa", () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.id).toBeTruthy();
      expect(achievement.name).toBeTruthy();
      expect(achievement.description).toBeTruthy();
      expect(achievement.icon).toBeTruthy();
      expect(["progress", "difficulty", "speed", "consistency", "perfection"]).toContain(
        achievement.category
      );
      expect(["common", "rare", "epic", "legendary"]).toContain(achievement.rarity);
      expect(achievement.xpReward).toBeGreaterThan(0);
      expect(typeof achievement.condition).toBe("function");
      expect(typeof achievement.progress).toBe("function");
    }
  });

  it("achievementProgress limiteaza progresul la tinta", () => {
    const achievement = ACHIEVEMENTS.find((entry) => entry.id === "solved-10");
    const [current, target] = achievementProgress(achievement, {
      ...emptyContext,
      solved: 25,
    });
    expect(current).toBe(10);
    expect(target).toBe(10);
  });

  it("evaluarea nu arunca erori pe contexte corupte", () => {
    expect(() => evaluateAchievements(null)).not.toThrow();
    expect(evaluateAchievements(null)).toEqual([]);
  });
});
