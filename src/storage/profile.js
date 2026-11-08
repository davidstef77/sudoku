/**
 * Profilul de gamification (XP + realizari), offline-first.
 *
 * Local: XP-ul si realizarile se calculeaza si se salveaza in AsyncStorage,
 * ca aplicatia sa functioneze complet fara cont. Cand utilizatorul e
 * autentificat, profilul serverului (autoritar) se suprapune peste cel local.
 *
 * Regula anti-dublu: un puzzle primeste XP o singura data (lista awardedIds).
 */

import AsyncStorage, { STORAGE_KEYS } from "./asyncStorage.js";
import { XP_PER_DIFFICULTY, levelForXp, levelProgress } from "../lib/xp.js";
import {
  evaluateAchievements,
  achievementProgress,
  ACHIEVEMENTS,
} from "../lib/achievements.js";
import { loadStats } from "./progress.js";
import { loadDailyState } from "../lib/daily.js";

const EMPTY_PROFILE = {
  xp: 0,
  unlocked: {}, // { <achievementId>: timestamp deblocare }
  awardedIds: [], // puzzle-uri deja recompensate
  solvedByDifficulty: {},
  perfectSolves: 0,
};

/** Citeste profilul local. */
export async function loadProfile() {
  const profile = await AsyncStorage.getJSON(STORAGE_KEYS.profile, null);
  return { ...EMPTY_PROFILE, ...(profile || {}) };
}

async function saveProfile(profile) {
  await AsyncStorage.setJSON(STORAGE_KEYS.profile, profile);
  return profile;
}

/** Contextul de evaluare, din datele locale. */
export async function buildLocalContext(profile) {
  const [stats, daily] = await Promise.all([loadStats(), loadDailyState()]);

  const solvedByDifficulty = { ...(profile.solvedByDifficulty || {}) };
  const solved = Object.values(solvedByDifficulty).reduce((sum, n) => sum + n, 0);

  return {
    solved,
    solvedByDifficulty,
    bestTimes: stats.bestTimes || {},
    streak: Math.max(daily.streak || 0, 0),
    perfectSolves: profile.perfectSolves || 0,
  };
}

/**
 * Acorda XP pentru un puzzle rezolvat (o singura data per puzzle) si
 * evalueaza realizarile. Returneaza ce e nou pentru notificari.
 *
 * @param {{puzzleId:Number, difficulty:string, seconds:Number,
 *          mistakes:Number, hintsUsed:Number}} solve
 * @returns {Promise<{ profile, xpGained, levelUp, newlyUnlocked, context }>}
 */
export async function awardSolve({ puzzleId, difficulty, seconds, mistakes, hintsUsed }) {
  const profile = await loadProfile();

  const already = profile.awardedIds.includes(puzzleId);
  const xpGained = already ? 0 : XP_PER_DIFFICULTY[difficulty] ?? 0;

  if (!already) {
    profile.awardedIds.push(puzzleId);
    profile.solvedByDifficulty = {
      ...profile.solvedByDifficulty,
      [difficulty]: (profile.solvedByDifficulty?.[difficulty] || 0) + 1,
    };
  }

  if (Number(mistakes) === 0 && Number(hintsUsed) === 0 && !already) {
    profile.perfectSolves = (profile.perfectSolves || 0) + 1;
  }

  const previousLevel = levelForXp(profile.xp);
  profile.xp += xpGained;

  const context = await buildLocalContext(profile);
  const satisfied = evaluateAchievements(context);

  const newlyUnlocked = [];
  for (const id of satisfied) {
    if (!profile.unlocked[id]) {
      profile.unlocked[id] = Date.now();
      newlyUnlocked.push(id);
    }
  }

  // XP-ul de realizare se adauga in total.
  for (const id of newlyUnlocked) {
    const definition = ACHIEVEMENTS.find((entry) => entry.id === id);
    profile.xp += definition?.xpReward ?? 0;
  }

  await saveProfile(profile);

  const newLevel = levelForXp(profile.xp);
  return {
    profile,
    xpGained: xpGained + newlyUnlocked.reduce((sum, id) => {
      const definition = ACHIEVEMENTS.find((entry) => entry.id === id);
      return sum + (definition?.xpReward ?? 0);
    }, 0),
    levelUp: newLevel > previousLevel,
    newlyUnlocked,
    context,
  };
}

/** Adopta profilul autoritar al serverului (dupa sync, pentru logati). */
export async function adoptServerProfile(serverProfile) {
  if (!serverProfile) return loadProfile();

  const profile = await loadProfile();
  profile.xp = Math.max(profile.xp, Number(serverProfile.xpTotal) || 0);

  const unlocked = { ...profile.unlocked };
  for (const id of serverProfile.achievements || []) {
    if (!unlocked[id]) unlocked[id] = Date.now();
  }
  profile.unlocked = unlocked;

  await saveProfile(profile);
  return profile;
}

/** Progresul de nivel pentru UI. */
export function profileLevelProgress(profile) {
  return levelProgress(profile?.xp || 0);
}

/** Progresul unei realizari pe contextul local (pentru pagina dedicata). */
export function localAchievementProgress(definition, context) {
  return achievementProgress(definition, context);
}
