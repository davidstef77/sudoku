/**
 * KOPIE a fisierului src/lib/ din client (Vercel nu poate importa fisiere
 * din afara directorului `server/`). Pastreaza-l sincronizat cu originalul:
 *   src/lib/xp.js  <-->  server/src/lib/xp.js
 * Paritatea este verificata automat de src/lib/gamification.test.js.
 */
/**
 * Definitiile realizarilor (achievements) — logica PURA, partajata intre
 * client si server. Serverul evalueaza pe datele sale; clientul pastreaza
 * o copie offline identica si o sincronizeaza la autentificare.
 *
 * Un context de evaluare arata asa:
 *   {
 *     solved: Number,               // puzzle-uri rezolvate (unice)
 *     solvedByDifficulty: { easy..extreme: Number },
 *     bestTimes: { easy..extreme: secunde },
 *     streak: Number,               // seria zilnica curenta/maxima
 *     perfectSolves: Number,        // fara greseli si fara hint-uri
 *   }
 */

export const ACHIEVEMENT_CATEGORIES = {
  progress: "Progres",
  difficulty: "Dificultate",
  speed: "Viteză",
  consistency: "Consistență",
  perfection: "Perfecțiune",
};

export const RARITIES = {
  common: { label: "Comună", color: "text-muted", ring: "ring-muted/40", xp: 25 },
  rare: { label: "Rară", color: "text-good", ring: "ring-good/40", xp: 100 },
  epic: { label: "Epică", color: "text-accent", ring: "ring-accent/50", xp: 250 },
  legendary: { label: "Legendară", color: "text-warn", ring: "ring-warn/50", xp: 500 },
};

/** Definitiile tuturor realizarilor. */
export const ACHIEVEMENTS = [
  // ---------------- progres ----------------
  {
    id: "first-solve",
    category: "progress",
    rarity: "common",
    icon: "🎯",
    name: "Primul pas",
    description: "Rezolvă primul tău puzzle.",
    xpReward: 25,
    condition: (c) => c.solved >= 1,
    progress: (c) => [Math.min(c.solved, 1), 1],
  },
  {
    id: "solved-10",
    category: "progress",
    rarity: "common",
    icon: "🧩",
    name: "Colecționar",
    description: "Rezolvă 10 puzzle-uri.",
    xpReward: 50,
    condition: (c) => c.solved >= 10,
    progress: (c) => [Math.min(c.solved, 10), 10],
  },
  {
    id: "solved-50",
    category: "progress",
    rarity: "rare",
    icon: "🧠",
    name: "Creier antrenat",
    description: "Rezolvă 50 de puzzle-uri.",
    xpReward: 150,
    condition: (c) => c.solved >= 50,
    progress: (c) => [Math.min(c.solved, 50), 50],
  },
  {
    id: "solved-100",
    category: "progress",
    rarity: "epic",
    icon: "💯",
    name: "Centurion",
    description: "Rezolvă 100 de puzzle-uri.",
    xpReward: 300,
    condition: (c) => c.solved >= 100,
    progress: (c) => [Math.min(c.solved, 100), 100],
  },
  {
    id: "solved-500",
    category: "progress",
    rarity: "epic",
    icon: "🏆",
    name: "Maratonist",
    description: "Rezolvă 500 de puzzle-uri.",
    xpReward: 400,
    condition: (c) => c.solved >= 500,
    progress: (c) => [Math.min(c.solved, 500), 500],
  },
  {
    id: "solved-1000",
    category: "progress",
    rarity: "legendary",
    icon: "👑",
    name: "Sudoku 1000",
    description: "Rezolvă 1000 de puzzle-uri. Legendar!",
    xpReward: 1000,
    condition: (c) => c.solved >= 1000,
    progress: (c) => [Math.min(c.solved, 1000), 1000],
  },

  // ---------------- dificultate ----------------
  {
    id: "expert-first",
    category: "difficulty",
    rarity: "rare",
    icon: "🦾",
    name: "Expert",
    description: "Rezolvă primul puzzle de nivel Expert.",
    xpReward: 100,
    condition: (c) => (c.solvedByDifficulty.expert ?? 0) >= 1,
    progress: (c) => [Math.min(c.solvedByDifficulty.expert ?? 0, 1), 1],
  },
  {
    id: "master-first",
    category: "difficulty",
    rarity: "epic",
    icon: "🥋",
    name: "Maestru",
    description: "Rezolvă primul puzzle de nivel Maestru.",
    xpReward: 250,
    condition: (c) => (c.solvedByDifficulty.master ?? 0) >= 1,
    progress: (c) => [Math.min(c.solvedByDifficulty.master ?? 0, 1), 1],
  },
  {
    id: "extreme-first",
    category: "difficulty",
    rarity: "legendary",
    icon: "🔥",
    name: "Extrem",
    description: "Rezolvă primul puzzle de nivel Extrem.",
    xpReward: 500,
    condition: (c) => (c.solvedByDifficulty.extreme ?? 0) >= 1,
    progress: (c) => [Math.min(c.solvedByDifficulty.extreme ?? 0, 1), 1],
  },

  // ---------------- viteza ----------------
  {
    id: "speed-10min",
    category: "speed",
    rarity: "common",
    icon: "⏱️",
    name: "Sprint",
    description: "Rezolvă orice puzzle în sub 10 minute.",
    xpReward: 50,
    condition: (c) => Object.values(c.bestTimes ?? {}).some((t) => t > 0 && t < 600),
    progress: (c) => [anyBestUnder(c, 600) ? 1 : 0, 1],
  },
  {
    id: "speed-5min",
    category: "speed",
    rarity: "rare",
    icon: "⚡",
    name: "Fulger",
    description: "Rezolvă orice puzzle în sub 5 minute.",
    xpReward: 150,
    condition: (c) => Object.values(c.bestTimes ?? {}).some((t) => t > 0 && t < 300),
    progress: (c) => [anyBestUnder(c, 300) ? 1 : 0, 1],
  },
  {
    id: "speed-3min",
    category: "speed",
    rarity: "epic",
    icon: "🌀",
    name: "Vortex",
    description: "Rezolvă orice puzzle în sub 3 minute.",
    xpReward: 300,
    condition: (c) => Object.values(c.bestTimes ?? {}).some((t) => t > 0 && t < 180),
    progress: (c) => [anyBestUnder(c, 180) ? 1 : 0, 1],
  },
  {
    id: "speed-expert-20min",
    category: "speed",
    rarity: "epic",
    icon: "🚀",
    name: "Expert fulger",
    description: "Rezolvă un puzzle Expert în sub 20 de minute.",
    xpReward: 300,
    condition: (c) => (c.bestTimes?.expert ?? Infinity) < 1200,
    progress: (c) => [(c.bestTimes?.expert ?? Infinity) < 1200 ? 1 : 0, 1],
  },

  // ---------------- consistenta ----------------
  {
    id: "streak-3",
    category: "consistency",
    rarity: "common",
    icon: "🌱",
    name: "Obicei bun",
    description: "Rezolvă provocarea zilei 3 zile la rând.",
    xpReward: 50,
    condition: (c) => c.streak >= 3,
    progress: (c) => [Math.min(c.streak, 3), 3],
  },
  {
    id: "streak-7",
    category: "consistency",
    rarity: "rare",
    icon: "📅",
    name: "Săptămână de fier",
    description: "Rezolvă provocarea zilei 7 zile la rând.",
    xpReward: 150,
    condition: (c) => c.streak >= 7,
    progress: (c) => [Math.min(c.streak, 7), 7],
  },
  {
    id: "streak-30",
    category: "consistency",
    rarity: "epic",
    icon: "🌙",
    name: "Lună întreagă",
    description: "Rezolvă provocarea zilei 30 de zile la rând.",
    xpReward: 400,
    condition: (c) => c.streak >= 30,
    progress: (c) => [Math.min(c.streak, 30), 30],
  },
  {
    id: "streak-100",
    category: "consistency",
    rarity: "legendary",
    icon: "🛡️",
    name: "Fier neclintit",
    description: "Rezolvă provocarea zilei 100 de zile la rând.",
    xpReward: 1000,
    condition: (c) => c.streak >= 100,
    progress: (c) => [Math.min(c.streak, 100), 100],
  },

  // ---------------- perfectiune ----------------
  {
    id: "perfect-1",
    category: "perfection",
    rarity: "rare",
    icon: "💎",
    name: "Fără greșeală",
    description: "Rezolvă un puzzle fără nicio greșeală și fără indicii.",
    xpReward: 100,
    condition: (c) => c.perfectSolves >= 1,
    progress: (c) => [Math.min(c.perfectSolves, 1), 1],
  },
  {
    id: "perfect-10",
    category: "perfection",
    rarity: "epic",
    icon: "✨",
    name: "Precizie",
    description: "Rezolvă 10 puzzle-uri fără greșeli și fără indicii.",
    xpReward: 300,
    condition: (c) => c.perfectSolves >= 10,
    progress: (c) => [Math.min(c.perfectSolves, 10), 10],
  },
  {
    id: "perfect-50",
    category: "perfection",
    rarity: "legendary",
    icon: "🔮",
    name: "Perfecțiune",
    description: "Rezolvă 50 de puzzle-uri fără greșeli și fără indicii.",
    xpReward: 600,
    condition: (c) => c.perfectSolves >= 50,
    progress: (c) => [Math.min(c.perfectSolves, 50), 50],
  },
];

function anyBestUnder(context, seconds) {
  return Object.values(context.bestTimes ?? {}).some((t) => t > 0 && t < seconds);
}

/** Mapa id -> definitie. */
export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement])
);

/**
 * Evalueaza toate realizarile pe un context si returneaza id-urile
 * indeplinite. Nu tine cont de ce e deja deblocat — apelantul dedupeaza.
 */
export function evaluateAchievements(context) {
  return ACHIEVEMENTS.filter((achievement) => {
    try {
      return Boolean(achievement.condition(context));
    } catch {
      return false;
    }
  }).map((achievement) => achievement.id);
}

/** Progresul [curent, tinta] pentru o realizare, sigur pentru UI. */
export function achievementProgress(achievement, context) {
  try {
    const [current, target] = achievement.progress(context);
    return [Math.max(0, Math.min(Number(current) || 0, target)), Math.max(1, target)];
  } catch {
    return [0, 1];
  }
}
