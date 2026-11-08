/**
 * Sistemul XP si nivele — logica PURA, partajata intre client si server.
 * Serverul este sursa adevarului: recalculeaza XP-ul din propriile date
 * (un puzzle poate primi XP o singura data — evenimente unice per puzzle).
 */

/** XP-ul acordat pentru un puzzle rezolvat, pe dificultate. */
export const XP_PER_DIFFICULTY = {
  easy: 10,
  medium: 20,
  hard: 35,
  expert: 50,
  master: 75,
  extreme: 100,
};

/** XP-ul primit pentru deblocarea unei realizari (primit din definitii). */

/**
 * Nivelul din XP total.
 * Curba: nivelul L necesita 100 + (L-1)*50 XP pentru urmatorul nivel,
 * adica o curba blanda la inceput, care se torde treptat.
 *
 * xpForLevel(1) = 0
 * xpForLevel(L) = 100*(L-1) + 50*(L-1)*(L-2)/2  (sumă aritmetica)
 */
export function totalXpForLevel(level) {
  const l = Math.max(1, Math.floor(level)) - 1;
  return 100 * l + (50 * l * (l - 1)) / 2;
}

/** Nivelul curent pentru un total de XP. */
export function levelForXp(xp) {
  const total = Math.max(0, Math.floor(xp));
  let level = 1;
  while (totalXpForLevel(level + 1) <= total) level += 1;
  return level;
}

/**
 * Detalii de progres in nivelul curent.
 * Returneaza { level, xp, xpInLevel, xpForNext, percent }.
 */
export function levelProgress(xp) {
  const total = Math.max(0, Math.floor(xp));
  const level = levelForXp(total);
  const levelStart = totalXpForLevel(level);
  const nextStart = totalXpForLevel(level + 1);
  const xpInLevel = total - levelStart;
  const xpForNext = nextStart - levelStart;
  const percent = xpForNext > 0 ? Math.min(100, Math.round((xpInLevel / xpForNext) * 100)) : 100;

  return { level, xp: total, xpInLevel, xpForNext, percent };
}

/** Titlul de rang afisat langa nivel (flavor gaming). */
const RANKS = [
  "Începător",
  "Novice",
  "Rezolvitor",
  "Logician",
  "Analist",
  "Strateg",
  "Expert",
  "Virtuoz",
  "Maestru",
  "Grandmaster",
  "Legendă",
];

export function rankForLevel(level) {
  return RANKS[Math.min(RANKS.length - 1, Math.max(0, Math.floor((level - 1) / 3)))];
}
