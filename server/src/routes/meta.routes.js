/**
 * Rute "meta": realizarile si clasamentul.
 *   GET /api/achievements  — definitii + progres + deblocate (evaluat server-side).
 *   GET /api/leaderboard   — clasamente: global / saptamanal / lunar, sortate
 *                            dupa XP, puzzle-uri rezolvate, serie sau dificultate.
 *
 * Toate valorile de gamification vin din datele serverului (Progress, XpEvent,
 * User) — clientul nu poate influenta direct pozitia in clasament.
 */

import { Router } from "express";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { XpEvent } from "../models/XpEvent.js";
import { requireAuth } from "../middleware/auth.js";
import {
  ACHIEVEMENTS,
  achievementProgress,
} from "../lib/achievements.js";
import { evaluateAndPersistAchievements, getProfile } from "../lib/serverMeta.js";
import { levelForXp } from "../lib/xp.js";
import {
  DIFFICULTIES,
  dayKey,
  effectiveStreak,
  publicName,
  streakCutoffDay,
} from "../lib/validation.js";

const router = Router();

  // ---------------- achievements ----------------

  router.get("/achievements", requireAuth, async (req, res, next) => {
    try {
      // Evaluarea server-side deblocheaza si persista realizarile noi,
      // returnandu-le separat pentru notificarile animate din UI.
      // Contextul vine din aceeasi evaluare (inainte era reconstruit, 4 interogari in plus).
      const { newlyUnlocked, unlocked, context } = await evaluateAndPersistAchievements(
        req.userId
      );
      const unlockedSet = new Set(unlocked);

      const profile = await getProfile(req.userId);

      const achievements = ACHIEVEMENTS.map((definition) => {
        const [current, target] = achievementProgress(definition, context);
        return {
          id: definition.id,
          name: definition.name,
          description: definition.description,
          icon: definition.icon,
          category: definition.category,
          rarity: definition.rarity,
          xpReward: definition.xpReward,
          progress: { current, target },
          unlocked: unlockedSet.has(definition.id),
        };
      });

      res.json({
        achievements,
        newlyUnlocked,
        profile,
        context: {
          solved: context.solved,
          streak: context.streak,
          perfectSolves: context.perfectSolves,
          solvedByDifficulty: context.solvedByDifficulty,
          bestTimes: context.bestTimes,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // ---------------- leaderboard ----------------

  router.get("/leaderboard", requireAuth, async (req, res, next) => {
    try {
      const scope = ["global", "weekly", "monthly"].includes(req.query.scope)
        ? req.query.scope
        : "global";
      const sort = String(req.query.sort || "xp");

      const difficultySort = DIFFICULTIES.includes(sort) ? sort : null;

      // Intervalul de timp pentru scopuri temporale.
      let since = null;
      if (scope === "weekly") {
        since = startOfWeek();
      } else if (scope === "monthly") {
        since = startOfMonth();
      }

      // ---------- construirea listei ----------
      let rows; // [{ userId, value }]
      let metric; // descrierea metricii sortate
      let countAbove; // (valoare) => numarul de jucatori cu valoare mai mare

      // O serie e "activa" doar daca ultima zi rezolvata e recenta; altfel
      // documentul retine o serie rupta, care nu trebuie sa apara in top.
      const activeSince = dayKey(streakCutoffDay());

      if (scope === "global" && !difficultySort) {
        if (sort === "solved") {
          metric = "solved";
          rows = await User.aggregate([
            { $match: { "stats.solved": { $gt: 0 } } },
            { $project: { value: "$stats.solved" } },
            { $sort: { value: -1 } },
            { $limit: 500 },
          ]);
          countAbove = (value) => User.countDocuments({ "stats.solved": { $gt: value } });
        } else if (sort === "streak") {
          metric = "streak";
          const filter = {
            "daily.lastCompleted": { $gte: activeSince },
            "daily.streak": { $gt: 0 },
          };
          rows = await User.aggregate([
            { $match: filter },
            { $project: { value: "$daily.streak" } },
            { $sort: { value: -1 } },
            { $limit: 500 },
          ]);
          countAbove = (value) =>
            User.countDocuments({ ...filter, "daily.streak": { $gt: value } });
        } else {
          metric = "xp";
          rows = await User.aggregate([
            { $match: { xpTotal: { $gt: 0 } } },
            { $project: { value: "$xpTotal" } },
            { $sort: { value: -1 } },
            { $limit: 500 },
          ]);
          countAbove = (value) => User.countDocuments({ xpTotal: { $gt: value } });
        }
      } else {
        // Saptamanal / lunar / sortare pe dificultate: aggregare pe XpEvent.
        const match = {};
        if (since) match.at = { $gte: since };
        if (difficultySort) match.difficulty = difficultySort;
        // Evenimentele sintetice (XP de realizare) au difficulty "easy" doar
        // formal — excluse din ORICE clasament pe dificultate (inainte erau
        // excluse doar la "global", deci umflau clasamentul saptamanal "easy").
        if (difficultySort) match.synthetic = { $ne: true };

        metric = difficultySort ? `xp-${difficultySort}` : "xp";

        const grouped = [
          { $match: match },
          { $group: { _id: "$userId", value: { $sum: "$amount" } } },
        ];
        rows = await XpEvent.aggregate([
          ...grouped,
          { $match: { value: { $gt: 0 } } },
          { $sort: { value: -1 } },
          { $limit: 500 },
        ]);
        rows = rows.map((row) => ({ userId: row._id, value: row.value }));
        countAbove = async (value) => {
          const [result] = await XpEvent.aggregate([
            ...grouped,
            { $match: { value: { $gt: value } } },
            { $count: "n" },
          ]);
          return result?.n ?? 0;
        };
      }

      // ---------- detailii utilizatori + ranguri ----------
      const top = rows.slice(0, 100);
      const idList = top.map((row) => row.userId).filter(Boolean);
      const users = await User.find({ _id: { $in: idList } })
        .lean()
        .select("displayName stats daily xpTotal");

      const byId = new Map(users.map((user) => [user._id.toString(), user]));

      const entries = top.map((row, index) => {
        const user = byId.get(String(row.userId)) || {};
        const xpTotal = Number(user.xpTotal) || 0;

        return {
          rank: index + 1,
          userId: String(row.userId),
          // Emailul (nici macar partea dinainte de @) nu mai e expus public.
          name: publicName(user, row.userId),
          level: levelForXp(xpTotal),
          xpTotal,
          solved: Number(user.stats?.solved) || 0,
          streak: effectiveStreak(user.daily),
          value: row.value,
          metric,
        };
      });

      // ---------- pozitia utilizatorului curent ----------
      let me = null;
      const myId = String(req.userId);
      const myIndex = rows.findIndex((row) => String(row.userId) === myId);

      const myUser = await User.findById(req.userId).lean();
      if (myUser) {
        const xpTotal = Number(myUser.xpTotal) || 0;
        let myValue;
        let myRank;

        if (myIndex >= 0) {
          myValue = rows[myIndex].value;
          myRank = myIndex + 1;
        } else {
          // Calculam valoarea utilizatorului pentru metrica aleasa.
          if (scope === "global" && !difficultySort) {
            myValue =
              metric === "solved"
                ? Number(myUser.stats?.solved) || 0
                : metric === "streak"
                ? effectiveStreak(myUser.daily)
                : xpTotal;
          } else {
            const match = { userId: new mongoose.Types.ObjectId(myId) };
            if (since) match.at = { $gte: since };
            if (difficultySort) {
              match.difficulty = difficultySort;
              match.synthetic = { $ne: true };
            }
            const [agg] = await XpEvent.aggregate([
              { $match: match },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ]);
            myValue = agg?.total ?? 0;
          }

          // In afara top 500: rangul real se numara in baza (inainte era
          // plafonat artificial la 501 indiferent de pozitie).
          if (myValue > 0) {
            myRank = (await countAbove(myValue)) + 1;
          }
        }

        me = {
          rank: myValue > 0 ? myRank : null,
          name: publicName(myUser, myId),
          level: levelForXp(xpTotal),
          xpTotal,
          solved: Number(myUser.stats?.solved) || 0,
          streak: effectiveStreak(myUser.daily),
          value: myValue ?? 0,
          metric,
        };
      }

      res.json({ scope, sort: metric, entries, me });
    } catch (error) {
      next(error);
    }
  });

/** Lunea aceastei saptamani (ora 00:00 locala). */
function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7; // luni = 0
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Prima zi a lunii curente (ora 00:00 locala). */
function startOfMonth(date = new Date()) {
  const copy = new Date(date);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default router;
