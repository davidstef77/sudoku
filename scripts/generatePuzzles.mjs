/**
 * Generator de puzzle-uri Sudoku cu solutie unica.
 * Scrie src/data/puzzles.json cu 1000 de puzzle-uri, pe sase niveluri de
 * dificultate ordonate crescator: easy -> medium -> hard -> expert -> master -> extreme.
 *
 * Dificultatea e data de numarul de cifre initiale (mai putine = mai greu).
 * Nivelurile de final (master / extreme) folosesc mai multe treceri de "sapare"
 * si reincearca cu grile rezolvate noi pana cand se atinge tinta.
 *
 * Rulare: npm run generate
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOTAL = 1000;

/**
 * Nivelurile, ordonate crescator dupa dificultate.
 * count = numarul de puzzle-uri generate pentru nivelul respectiv.
 */
const LEVELS = [
  { difficulty: "easy", givens: 40, count: 300 },
  { difficulty: "medium", givens: 33, count: 240 },
  { difficulty: "hard", givens: 28, count: 180 },
  { difficulty: "expert", givens: 25, count: 130 },
  { difficulty: "master", givens: 23, count: 100 },
  { difficulty: "extreme", givens: 21, count: 50 },
];

const ALL = 0b1111111110; // bitii 1..9

// ---------- utilitare ----------

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const bit = (v) => 1 << v;

function posToBox(r, c) {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

// ---------- solver cu bitmask-uri ----------

/**
 * Numara solutiile (pana la `limit`) si returneaza prima solutie gasita.
 * board: array de 81 de numere (0 = celula goala).
 */
function solve(board, limit = 2) {
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);

  for (let i = 0; i < 81; i++) {
    const v = board[i];
    if (v) {
      const r = Math.floor(i / 9), c = i % 9, b = posToBox(r, c);
      rows[r] |= bit(v); cols[c] |= bit(v); boxes[b] |= bit(v);
    }
  }

  let solutions = 0;
  const first = new Array(81).fill(0);

  function search() {
    // Alegem celula cu cele mai putine candidati (MRV).
    let best = -1, bestMask = 0, bestCount = 10;

    for (let i = 0; i < 81; i++) {
      if (board[i]) continue;
      const r = Math.floor(i / 9), c = i % 9, b = posToBox(r, c);
      const mask = ALL & ~(rows[r] | cols[c] | boxes[b]);
      let count = 0;
      for (let v = 1; v <= 9; v++) if (mask & bit(v)) count++;
      if (count === 0) return false;
      if (count < bestCount) {
        bestCount = count; best = i; bestMask = mask;
        if (count === 1) break;
      }
    }

    if (best === -1) {
      solutions++;
      if (solutions === 1) first.splice(0, 81, ...board);
      return solutions >= limit;
    }

    const r = Math.floor(best / 9), c = best % 9, b = posToBox(r, c);
    for (let v = 1; v <= 9; v++) {
      if (!(bestMask & bit(v))) continue;
      board[best] = v;
      rows[r] |= bit(v); cols[c] |= bit(v); boxes[b] |= bit(v);

      if (search()) {
        // Curatam inainte de a iesi, ca sa lasam tabla consistenta.
        board[best] = 0;
        rows[r] &= ~bit(v); cols[c] &= ~bit(v); boxes[b] &= ~bit(v);
        return true;
      }

      board[best] = 0;
      rows[r] &= ~bit(v); cols[c] &= ~bit(v); boxes[b] &= ~bit(v);
    }
    return false;
  }

  search();
  return { solutions, solution: first };
}

/** Genereaza o tabla completa si valida, aleatorie. */
function generateSolved() {
  const board = new Array(81).fill(0);
  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);

  function fill(index) {
    if (index === 81) return true;
    const r = Math.floor(index / 9), c = index % 9, b = posToBox(r, c);
    const mask = ALL & ~(rows[r] | cols[c] | boxes[b]);

    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (!(mask & bit(v))) continue;
      board[index] = v;
      rows[r] |= bit(v); cols[c] |= bit(v); boxes[b] |= bit(v);
      if (fill(index + 1)) return true;
      board[index] = 0;
      rows[r] &= ~bit(v); cols[c] &= ~bit(v); boxes[b] &= ~bit(v);
    }
    return false;
  }

  fill(0);
  return board;
}

/**
 * Sapa celule din solutia completa pana cand raman cel mult `target` cifre,
 * pastrand unicitatea solutiei. Repeta cu ordini aleatorii diferite (mai multe
 * treceri), pentru ca la nivelurile grele o singura trecere se blocheaza
 * deasupra tintei.
 */
function digToTarget(solution, target, maxPasses = 120) {
  const puzzle = [...solution];
  let passes = 0;

  while (puzzle.filter(Boolean).length > target && passes < maxPasses) {
    passes++;
    const order = shuffle([...Array(81).keys()]);
    let removed = 0;

    for (const index of order) {
      if (puzzle.filter(Boolean).length <= target) break;
      if (!puzzle[index]) continue;

      const backup = puzzle[index];
      puzzle[index] = 0;

      const { solutions } = solve([...puzzle], 2);
      if (solutions !== 1) {
        puzzle[index] = backup; // reintroducem cifra daca solutia nu mai e unica
      } else {
        removed++;
      }
    }

    if (removed === 0) break;
  }

  return puzzle;
}

/** Daca saparea a mers sub tinta, completam la loc pana la exact `target` cifre. */
function padToTarget(solution, puzzle, target) {
  const result = [...puzzle];
  const empty = [];
  for (let i = 0; i < 81; i++) if (!result[i]) empty.push(i);
  shuffle(empty);

  let givens = result.filter(Boolean).length;
  for (const index of empty) {
    if (givens >= target) break;
    result[index] = solution[index];
    givens++;
  }
  return result;
}

/**
 * Genereaza un puzzle cu cel mult `target` cifre initiale, reincercand cu grile
 * rezolvate noi daca e nevoie. La final puzzle-ul are exact `target` cifre date.
 */
function makePuzzle({ difficulty, givens: target }) {
  // Nivelurile cu putine cifre au nevoie de mai multe reincercari.
  const maxAttempts = target <= 22 ? 20000 : target <= 24 ? 8000 : 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const solution = generateSolved();
    const dug = digToTarget(solution, target, 120);

    if (dug.filter(Boolean).length <= target) {
      const puzzle = padToTarget(solution, dug, target);
      return { solution, puzzle };
    }
  }

  throw new Error(
    `Nu am reusit sa generez ${difficulty} cu ${target} cifre date (${maxAttempts} incercari).`
  );
}

// ---------- generare ----------

const puzzles = [];
let id = 1;

for (const level of LEVELS) {
  const { difficulty, givens, count } = level;
  let lastLog = Date.now();

  for (let i = 0; i < count; i++) {
    const { solution, puzzle } = makePuzzle(level);

    puzzles.push({
      id,
      difficulty,
      givens: puzzle.filter(Boolean).length,
      puzzle: puzzle.map((v) => v || 0).join(""),
      solution: solution.join(""),
    });

    id++;

    if (Date.now() - lastLog > 5000) {
      console.log(`  ... ${difficulty}: ${i + 1}/${count} (total ${puzzles.length}/${TOTAL})`);
      lastLog = Date.now();
    }
  }
  console.log(`OK ${difficulty}: ${count} puzzle-uri (${givens} cifre initiale)`);
}

// ---------- verificare finala ----------

console.log("\nVerific solutiile...");
for (const entry of puzzles) {
  const board = [...entry.puzzle].map(Number);
  const { solutions, solution } = solve(board, 2);
  if (solutions !== 1 || solution.join("") !== entry.solution) {
    throw new Error(`Puzzle-ul #${entry.id} nu are solutie unica sau solutia nu corespunde!`);
  }
}
console.log(`Toate cele ${puzzles.length} puzzle-uri au solutie unica.`);

// ---------- scriere ----------

const outPath = resolve(__dirname, "../src/data/puzzles.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(puzzles));

// Catalogul compact pentru server (doar dificultate + solutie), folosit la
// verificarea anti-cheat a puzzle-urilor raportate ca rezolvate.
const catalogPath = resolve(__dirname, "../server/src/data/catalog.json");
mkdirSync(dirname(catalogPath), { recursive: true });
const catalog = Object.fromEntries(
  puzzles.map((entry) => [entry.id, [entry.difficulty, entry.solution]])
);
writeFileSync(catalogPath, JSON.stringify(catalog));

console.log(`\nScris ${puzzles.length} puzzle-uri in ${outPath}`);
console.log(`Dimensiune fisier: ${(JSON.stringify(puzzles).length / 1024).toFixed(1)} KB`);
