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
import { Progress } from "../models/Progress.js";
import { XpEvent } from "../models/XpEvent.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import {
  grantXpForNewCompletions,
  evaluateAndPersistAchievements,
  computeVerifiedStats,
  getProfile,
} from "../lib/serverMeta.js";
import { sanitizeEntry, resolveDaily } from "../lib/validation.js";

/** Peste atat, payload-ul e clar abuziv (exista doar 1000 de puzzle-uri). */
const MAX_ENTRIES_PER_SYNC = 1000;

const PROGRESS_FIELDS =
  "-_id puzzleId difficulty values notes elapsed mistakes hintsUsed correct completed updatedAt";

const router = Router();
router.use(requireAuth);

/** GET /api/progress — tot progresul utilizatorului (pentru restaurare). */
router.get("/", async (req, res, next) => {
  try {
    const docs = await Progress.find({ userId: req.userId })
      .lean()
      .select(PROGRESS_FIELDS);

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
    const rawEntries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (rawEntries.length > MAX_ENTRIES_PER_SYNC) {
      return res.status(413).json({ error: "Prea multe intrări într-o singură sincronizare." });
    }

    // Validare + normalizare: dificultatea vine din catalogul serverului,
    // iar "completed" e acceptat doar daca grila e exact solutia.
    const now = Date.now();
    const byPuzzle = new Map();
    for (const raw of rawEntries) {
      const entry = sanitizeEntry(raw, now);
      if (!entry) continue;
      const previous = byPuzzle.get(entry.puzzleId);
      if (!previous || entry.updatedAt > previous.updatedAt) byPuzzle.set(entry.puzzleId, entry);
    }
    const incoming = [...byPuzzle.values()];
    const clientStats = req.body?.stats && typeof req.body.stats === "object" ? req.body.stats : null;

    // 1) O singura interogare: updatedAt-urile existente pentru puzzle-urile primite.
    const ids = incoming.map((entry) => entry.puzzleId);
    const existing = ids.length
      ? await Progress.find(
          { userId: req.userId, puzzleId: { $in: ids } },
          { puzzleId: 1, updatedAt: 1 }
        ).lean()
      : [];

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

    // 3) Statistici + seria zilnica, intr-un singur update.
    //    - solved / bestTimes: DOAR din date verificate de server (clasamentul
    //      "solved" si realizarile de viteza nu mai pot fi umflate din client);
    //    - attempted / totalSeconds: informative, max(server, client).
    const user = await User.findById(req.userId).lean();
    const serverStats = user?.stats || {};
    const verified = await computeVerifiedStats(req.userId, serverStats);

    const toCount = (value) => Math.min(1e9, Math.max(0, Math.floor(Number(value) || 0)));
    const mergedStats = {
      solved: verified.solved,
      attempted: Math.max(
        toCount(serverStats.attempted),
        toCount(clientStats?.attempted),
        verified.solved
      ),
      totalSeconds: Math.max(toCount(serverStats.totalSeconds), toCount(clientStats?.totalSeconds)),
      bestTimes: verified.bestTimes,
    };

    const update = { stats: mergedStats };

    // Seria zilnica: validata calendaristic (nu poate creste mai repede de
    // o zi pe zi) si NICIODATA stearsa de un dispozitiv cu stare goala.
    const daily = resolveDaily(req.body?.daily, user?.daily, {
      createdAt: user?.createdAt,
      now,
    });
    if (daily) {
      update.daily = daily;
      update.maxStreak = Math.max(Number(user?.maxStreak) || 0, daily.streak);
    }

    await User.updateOne({ _id: req.userId }, { $set: update });

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
    const docs = await Progress.find({ userId: req.userId }).lean().select(PROGRESS_FIELDS);

    res.json({
      progress: docs,
      stats: mergedStats,
      daily: update.daily ?? user?.daily ?? null,
      written: toWrite.length,
      profile,
      newlyUnlocked,
    });
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
          daily: { lastCompleted: null, streak: 0 },
        },
      }
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
