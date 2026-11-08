/**
 * Gamification server-side: acordarea XP si evaluarea realizarilor.
 *
 * Principii de securitate:
 *   - XP-ul este calculat EXCLUSIV din datele serverului (colectia Progress
 *     + XpEvent). Clientul nu poate "ceri" XP — doar sincronizeaza progres,
 *     iar serverul decide ce e nou completat.
 *   - Indexul unic { userId, puzzleId } din XpEvent garanteaza la nivel de DB
 *     ca un puzzle nu poate fi recompensat de doua ori.
 *   - Un puzzle rezolvat "suspect de repid" (sub un minim plauzibil per
 *     nivel) NU primeste XP — respinge manipularea de timp din frontend.
 *   - Realizarile sunt evaluate din aceleasi date server si persistate in
 *     User.achievements, cu data deblocarii.
 */

import mongoose from "mongoose";
import { Progress } from "../models/Progress.js";
import { User } from "../models/User.js";
import { XpEvent } from "../models/XpEvent.js";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BY_ID,
  evaluateAchievements,
} from "./achievements.js";
import { XP_PER_DIFFICULTY, levelForXp } from "./xp.js";

/**
 * Minimul plauzibil de secunde per nivel, sub care un "rezolvat" este
 * considerat manipulat si nu primeste XP (puzzle-ul se salveaza tot).
 */
export const MIN_PLAUSIBLE_SECONDS = {
  easy: 15,
  medium: 25,
  hard: 40,
  expert: 60,
  master: 90,
  extreme: 120,
};

/** Hash numeric stabil pentru id-ul unei realizari (id-uri sintetice XP). */
function achievementSyntheticId(achievementId) {
  let hash = 5381;
  for (let i = 0; i < achievementId.length; i++) {
    hash = ((hash << 5) + hash + achievementId.charCodeAt(i)) >>> 0;
  }
  // Range negativ, rezervat realizarilor (puzzle-urile reale sunt 1..1000).
  return -(1_000_000 + (hash % 1_000_000_000));
}

/**
 * Acorda XP pentru puzzle-urile NOU completate dintr-un sync.
 * @param {ObjectId|string} userId
 * @param {Array<{puzzleId:Number, difficulty:string, elapsed:Number, mistakes:Number, hintsUsed:Number, completed:Boolean}>} entries
 * @returns {Promise<{ xpGained: Number, events: Number }>}
 */
export async function grantXpForNewCompletions(userId, entries) {
  const completed = (entries || []).filter(
    (entry) =>
      entry &&
      entry.completed &&
      Number.isInteger(entry.puzzleId) &&
      XP_PER_DIFFICULTY[entry.difficulty]
  );

  if (completed.length === 0) return { xpGained: 0, events: 0 };

  // Ce era deja completat pe server (oriceentry vechi blocand re-recompensa).
  const ids = [...new Set(completed.map((entry) => entry.puzzleId))];
  const existing = await Progress.find(
    { userId, puzzleId: { $in: ids }, completed: true },
    { puzzleId: 1 }
  ).lean();
  const alreadyDone = new Set(existing.map((doc) => doc.puzzleId));

  const fresh = completed.filter((entry) => !alreadyDone.has(entry.puzzleId));
  if (fresh.length === 0) return { xpGained: 0, events: 0 };

  // evenimente XP — ordered:false + unique index => dublurile sunt ignorate.
  const now = new Date();
  const ops = fresh.map((entry) => {
    const seconds = Math.max(0, Math.floor(Number(entry.elapsed) || 0));
    const trustworthy = seconds >= (MIN_PLAUSIBLE_SECONDS[entry.difficulty] ?? 30);
    const base = XP_PER_DIFFICULTY[entry.difficulty];
    const mistakes = Math.max(0, Math.floor(Number(entry.mistakes) || 0));
    const hintsUsed = Math.max(0, Math.floor(Number(entry.hintsUsed) || 0));

    return {
      updateOne: {
        filter: { userId, puzzleId: entry.puzzleId },
        update: {
          $setOnInsert: {
            userId,
            puzzleId: entry.puzzleId,
            difficulty: entry.difficulty,
            amount: trustworthy ? base : 0,
            seconds,
            mistakes,
            hintsUsed,
            perfect: trustworthy && mistakes === 0 && hintsUsed === 0,
            at: now,
          },
        },
        upsert: true,
      },
    };
  });

  await XpEvent.bulkWrite(ops, { ordered: false });

  // Recalculam totalul din sursa de adevar (suma evenimentelor).
  const [agg] = await XpEvent.aggregate([
    { $match: { userId: toId(userId) } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const xpTotal = agg?.total ?? 0;

  await User.updateOne({ _id: userId }, { $set: { xpTotal } });

  const events = fresh.length;
  return { xpGained: xpTotal, events };
}

/**
 * Contextul de evaluare al realizarilor, construit exclusiv din date server.
 */
export async function buildAchievementContext(userId) {
  const [byDifficulty, perfectCount, user] = await Promise.all([
    Progress.aggregate([
      { $match: { userId: toId(userId), completed: true } },
      { $group: { _id: "$difficulty", count: { $sum: 1 } } },
    ]),
    XpEvent.countDocuments({ userId: toId(userId), perfect: true, amount: { $gt: 0 } }),
    User.findById(userId).lean(),
  ]);

  const solvedByDifficulty = Object.fromEntries(
    byDifficulty.map((row) => [row._id, row.count])
  );

  const bestTimes = {};
  for (const [key, value] of Object.entries(user?.stats?.bestTimes ?? {})) {
    bestTimes[key] = Number(value) || 0;
  }

  const streak = Math.max(Number(user?.daily?.streak) || 0, Number(user?.maxStreak) || 0);

  return {
    solved: Object.values(solvedByDifficulty).reduce((sum, count) => sum + count, 0),
    solvedByDifficulty,
    bestTimes,
    streak,
    perfectSolves: perfectCount,
  };
}

/**
 * Evalueaza realizarile pentru un utilizator, persista noile deblocari si
 * acorda XP-ul de realizare (eveniment sintetic, puzzleId negativ, ca sa
 * nu interfereze cu regula anti-dublu a puzzle-urilor).
 * @returns {Promise<{ newlyUnlocked: string[], unlocked: string[] }>}
 */
export async function evaluateAndPersistAchievements(userId) {
  const context = await buildAchievementContext(userId);
  const satisfied = new Set(evaluateAchievements(context));

  const user = await User.findById(userId).lean();
  const unlocked = new Set(Object.keys(user?.achievements ?? {}));

  const newly = [...satisfied].filter((id) => !unlocked.has(id));

  if (newly.length > 0) {
    const now = new Date();
    const setAchievements = {};
    for (const id of newly) setAchievements[`achievements.${id}`] = now;

    // XP de realizare — evenimente sintetice cu id negativ unic.
    const xpOps = newly.map((id) => ({
      updateOne: {
        filter: { userId, puzzleId: achievementSyntheticId(id) },
        update: {
          $setOnInsert: {
            userId,
            puzzleId: achievementSyntheticId(id),
            difficulty: "easy",
            amount: ACHIEVEMENT_BY_ID[id]?.xpReward ?? 0,
            seconds: 0,
            at: now,
            synthetic: true,
            achievementId: id,
          },
        },
        upsert: true,
      },
    }));

    await XpEvent.bulkWrite(xpOps, { ordered: false });

    const [agg] = await XpEvent.aggregate([
      { $match: { userId: toId(userId) } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    await User.updateOne(
      { _id: userId },
      { $set: { ...setAchievements, xpTotal: agg?.total ?? 0 } }
    );

    unlocked.clear();
    for (const id of [...Object.keys(user?.achievements ?? {}), ...newly]) unlocked.add(id);
  }

  // Seria maxima, pentru realizarile de consistenta.
  const streak = Number(user?.daily?.streak) || 0;
  if (streak > Number(user?.maxStreak) || 0) {
    await User.updateOne({ _id: userId }, { $set: { maxStreak: streak } });
  }

  return { newlyUnlocked: newly, unlocked: [...unlocked] };
}

/** Profilul gamification trimis clientului. */
export async function getProfile(userId) {
  const user = await User.findById(userId).lean();
  const xpTotal = Number(user?.xpTotal) || 0;

  return {
    xpTotal,
    level: levelForXp(xpTotal),
    achievements: Object.keys(user?.achievements ?? {}),
  };
}

function toId(value) {
  return typeof value === "string" ? new mongoose.Types.ObjectId(value) : value;
}
