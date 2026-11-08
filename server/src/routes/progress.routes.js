/**
 * Sincronizarea progresului: citire, scriere bulk si resetare.
 *
 * Optimizari cheie:
 *   1. PUT /sync primeste TOATE puzzle-urile modificate local si le scrie
 *      intr-un SINGUR bulkWrite (1 request = 1 round-trip, nu N request-uri).
 *   2. Inainte de scriere se citesc doar updatedAt-urile existente pentru
 *      puzzle-urile din payload (o singura interogare lean + proiectie) —
 *      scriem doar ce e mai nou (last-write-wins), zero upsert-uri inutile.
 *   3. GET / foloseste lean() + proiectie fara _id — deserializare rapida.
 *   4. Statisticile sunt embedded in User — 1 find, nu 2 colectii.
 */

import { Router } from "express";
import mongoose from "mongoose";
import { Progress } from "../models/Progress.js";
import { XpEvent } from "../models/XpEvent.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import {
  grantXpForNewCompletions,
  evaluateAndPersistAchievements,
  getProfile,
} from "../lib/serverMeta.js";

const router = Router();
router.use(requireAuth);

/** Valideaza si normalizeaza o intrare de progres din request. */
function sanitizeEntry(raw) {
  const puzzleId = Number(raw?.puzzleId);
  const difficulty = String(raw?.difficulty || "");

  if (
    !Number.isInteger(puzzleId) ||
    puzzleId < 1 ||
    !["easy", "medium", "hard", "expert", "master", "extreme"].includes(difficulty)
  ) {
    return null;
  }

  const values = Array.isArray(raw.values) ? raw.values.slice(0, 81) : [];
  const notes = Array.isArray(raw.notes) ? raw.notes.slice(0, 81) : [];
  const updatedAt = new Date(raw.updatedAt || Date.now());

  return {
    puzzleId,
    difficulty,
    values: values.map(Number),
    notes: notes.map(String),
    elapsed: Math.max(0, Number(raw.elapsed) || 0),
    mistakes: Math.max(0, Number(raw.mistakes) || 0),
    hintsUsed: Math.max(0, Number(raw.hintsUsed) || 0),
    correct: Math.max(0, Number(raw.correct) || 0),
    completed: Boolean(raw.completed),
    updatedAt: isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
  };
}

/** GET /api/progress — tot progresul utilizatorului (pentru restaurare). */
router.get("/", async (req, res, next) => {
  try {
    const docs = await Progress.find({ userId: req.userId })
      .lean()
      .select("-_id puzzleId difficulty values notes elapsed mistakes hintsUsed correct completed updatedAt");

    const user = await User.findById(req.userId).lean();
    const stats = user?.stats
      ? { ...user.stats, bestTimes: user.stats.bestTimes ?? {} }
      : { solved: 0, attempted: 0, totalSeconds: 0, bestTimes: {} };

    res.json({ progress: docs, stats });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/progress/sync
 * Body: { entries: [...], stats: { solved, totalSeconds, bestTimes } }
 * Returneaza progresul + statisticile combinate (server + client).
 */
router.put("/sync", async (req, res, next) => {
  try {
    const incoming = Array.isArray(req.body?.entries)
      ? req.body.entries.map(sanitizeEntry).filter(Boolean)
      : [];
    const clientStats = req.body?.stats || null;

    // 1) O singura interogare: updatedAt-urile existente pentru puzzle-urile primite.
    const ids = [...new Set(incoming.map((entry) => entry.puzzleId))];
    const existing = await Progress.find(
      { userId: req.userId, puzzleId: { $in: ids } },
      { puzzleId: 1, updatedAt: 1 }
    ).lean();

    const currentVersion = new Map(
      existing.map((doc) => [doc.puzzleId, doc.updatedAt?.getTime() ?? 0])
    );

    // 2) Pastram doar intrarile mai noi decat serverul SAU inexistente acolo.
    const toWrite = incoming.filter(
      (entry) => entry.updatedAt.getTime() > (currentVersion.get(entry.puzzleId) ?? 0)
    );

    // 2b) Gamification — XP-ul se acorda INAINTE de scriere: asa putem
    //     compara corect cu ce era deja completat pe server (anti-dublu).
    //     Eșecul aici nu blochează scrierea progresului.
    try {
      await grantXpForNewCompletions(req.userId, toWrite);
    } catch (xpError) {
      console.warn("xp grant failed:", xpError?.message);
    }

    if (toWrite.length > 0) {
      const ops = toWrite.map((entry) => ({
        replaceOne: {
          filter: { userId: req.userId, puzzleId: entry.puzzleId },
          replacement: { userId: req.userId, ...entry },
          upsert: true,
        },
      }));

      await Progress.bulkWrite(ops, { ordered: false }); // 1 round-trip catre DB
    }

    // 3) Statistici: pastram valorile "mejloare" (max solved, min bestTimes,
    //    max totalSeconds) — merge optimist si defensiv.
    let mergedStats;
    if (clientStats) {
      const user = await User.findById(req.userId).lean();
      const serverStats = user?.stats || {};

      const bestTimes = { ...(clientStats.bestTimes || {}) };
      const serverBest = serverStats.bestTimes || {};
      for (const [level, seconds] of Object.entries(serverBest)) {
        const current = bestTimes[level];
        if (!current || seconds < current) bestTimes[level] = seconds;
      }

      mergedStats = {
        solved: Math.max(Number(serverStats.solved) || 0, Number(clientStats.solved) || 0),
        attempted: Math.max(
          Number(serverStats.attempted) || 0,
          Number(clientStats.attempted) || 0
        ),
        totalSeconds: Math.max(
          Number(serverStats.totalSeconds) || 0,
          Number(clientStats.totalSeconds) || 0
        ),
        bestTimes,
      };

      await User.updateOne(
        { _id: req.userId },
        { $set: { stats: mergedStats } }
      );
    } else {
      const user = await User.findById(req.userId).lean();
      mergedStats = user?.stats
        ? { ...user.stats, bestTimes: user.stats.bestTimes ?? {} }
        : { solved: 0, attempted: 0, totalSeconds: 0, bestTimes: {} };
    }

    // 3b) Seria zilnica: last-write-wins dupa data ultimei zile rezolvate.
    //     Pastram si maxStreak pentru realizarile de consistenta.
    const clientDaily = req.body?.daily || null;
    if (
      clientDaily &&
      (typeof clientDaily.lastCompleted === "string" || clientDaily.lastCompleted === null)
    ) {
      const user = await User.findById(req.userId).lean();
      const serverLast = user?.daily?.lastCompleted || null;
      const clientLast = clientDaily.lastCompleted;
      const clientStreak = Math.max(0, Math.floor(Number(clientDaily.streak) || 0));

      if (!serverLast || !clientLast || clientLast >= serverLast) {
        const maxStreak = Math.max(Number(user?.maxStreak) || 0, clientStreak);
        await User.updateOne(
          { _id: req.userId },
          { $set: { daily: { lastCompleted: clientLast, streak: clientStreak }, maxStreak } }
        );
      }
    }

    // 4) Realizarile se evalueaza dupa ce progresul e scris (datele noi
    //    sunt vizibile pentru agregari). Clientul primeste profilul + noile
    //    deblocari pentru notificari animate.
    let profile = null;
    let newlyUnlocked = [];
    try {
      const evaluation = await evaluateAndPersistAchievements(req.userId);
      newlyUnlocked = evaluation.newlyUnlocked;
      profile = await getProfile(req.userId);
    } catch (metaError) {
      // Gamification nu trebuie sa blocheze sincronizarea progresului.
      console.warn("meta sync failed:", metaError?.message);
    }

    // 5) Returnam totul combinat, ca clientul sa se alinieze la server.
    const docs = await Progress.find({ userId: req.userId })
      .lean()
      .select("-_id puzzleId difficulty values notes elapsed mistakes hintsUsed correct completed updatedAt");

    res.json({ progress: docs, stats: mergedStats, written: toWrite.length, profile, newlyUnlocked });
  } catch (error) {
    next(error);
  }
});

/** POST /api/progress/reset — sterge tot progresul + reseteaza statisticile. */
router.post("/reset", async (req, res, next) => {
  try {
    await Progress.deleteMany({ userId: req.userId });
    await XpEvent.deleteMany({ userId: req.userId });
    await User.updateOne(
      { _id: req.userId },
      {
        $set: {
          stats: { solved: 0, attempted: 0, totalSeconds: 0, bestTimes: {} },
          xpTotal: 0,
          achievements: {},
          maxStreak: 0,
        },
      }
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
