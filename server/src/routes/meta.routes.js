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
} from "../../src/lib/achievements.js";
import { buildAchievementContext, evaluateAndPersistAchievements, getProfile } from "../lib/serverMeta.js";
import { levelForXp } from "../../src/lib/xp.js";

const router = Router();

  // ---------------- achievements ----------------

  router.get("/achievements", requireAuth, async (req, res, next) => {
    try {
      // Evaluarea server-side deblocheaza si persista realizarile noi,
      // returnandu-le separat pentru notificarile animate din UI.
      const { newlyUnlocked, unlocked } = await evaluateAndPersistAchievements(req.userId);
      const unlockedSet = new Set(unlocked);

      const context = await buildAchievementContext(req.userId);
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

      const DIFFICULTIES = ["easy", "medium", "hard", "expert", "master", "extreme"];
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

      if (scope === "global" && !difficultySort) {
        if (sort === "solved") {
          metric = "solved";
          rows = await User.aggregate([
            { $project: { value: "$stats.solved" } },
            { $match: { value: { $gt: 0 } } },
            { $sort: { value: -1 } },
            { $limit: 500 },
          ]);
        } else if (sort === "streak") {
          metric = "streak";
          rows = await User.aggregate([
            { $project: { value: "$daily.streak" } },
            { $match: { value: { $gt: 0 } } },
            { $sort: { value: -1 } },
            { $limit: 500 },
          ]);
        } else {
          metric = "xp";
          rows = await User.aggregate([
            { $project: { value: "$xpTotal" } },
            { $match: { value: { $gt: 0 } } },
            { $sort: { value: -1 } },
            { $limit: 500 },
          ]);
        }
      } else {
        // Saptamanal / lunar / sortare pe dificultate: aggregare pe XpEvent.
        const match = {};
        if (since) match.at = { $gte: since };
        if (difficultySort) match.difficulty = difficultySort;
        if (scope === "global" && difficultySort) match.synthetic = { $ne: true };

        metric = difficultySort ? `xp-${difficultySort}` : "xp";

        rows = await XpEvent.aggregate([
          { $match: match },
          { $group: { _id: "$userId", value: { $sum: "$amount" } } },
          { $match: { value: { $gt: 0 } } },
          { $sort: { value: -1 } },
          { $limit: 500 },
        ]);
        rows = rows.map((row) => ({ userId: row._id, value: row.value }));
      }

      // ---------- detailii utilizatori + ranguri ----------
      const top = rows.slice(0, 100);
      const idList = top.map((row) => row.userId).filter(Boolean);
      const users = await User.find({ _id: { $in: idList } })
        .lean()
        .select("displayName email stats daily xpTotal");

      const byId = new Map(users.map((user) => [user._id.toString(), user]));

      const entries = top.map((row, index) => {
        const user = byId.get(String(row.userId)) || {};
        const emailName = String(user.email || "").split("@")[0];
        const name = user.displayName || emailName || "Anonim";
        const xpTotal = Number(user.xpTotal) || 0;

        return {
          rank: index + 1,
          userId: String(row.userId),
          name,
          level: levelForXp(xpTotal),
          xpTotal,
          solved: Number(user.stats?.solved) || 0,
          streak: Number(user.daily?.streak) || 0,
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
                ? Number(myUser.daily?.streak) || 0
                : xpTotal;
          } else {
            const match = { userId: new mongoose.Types.ObjectId(myId) };
            if (since) match.at = { $gte: since };
            if (difficultySort) match.difficulty = difficultySort;
            const [agg] = await XpEvent.aggregate([
              { $match: match },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ]);
            myValue = agg?.total ?? 0;
          }

          if (myValue > 0) {
            myRank = rows.filter((row) => row.value > myValue).length + 1;
          }
        }

        me = {
          rank: myValue > 0 ? myRank : null,
          name: myUser.displayName || String(myUser.email || "").split("@")[0] || "Anonim",
          level: levelForXp(xpTotal),
          xpTotal,
          solved: Number(myUser.stats?.solved) || 0,
          streak: Number(myUser.daily?.streak) || 0,
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
