/**
 * Generator de puzzle-uri Sudoku cu solutie unica.
 * Scrie src/data/puzzles.json cu 1000 de puzzle-uri (easy / medium / hard).
 *
 * Rulare: npm run generate
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOTAL = 1000;

// Numarul de cifre afisate pentru fiecare nivel de dificultate.
const LEVELS = {
  easy: { givens: 40, count: 400 },
  medium: { givens: 33, count: 350 },
  hard: { givens: 28, count: 250 },
};

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
  return (Math.floor(r / 3) * 3) + Math.floor(c / 3);
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
 * Sapa celule din solutia completa pana raman `target` cifre,
 * pastrand unicitatea solutiei.
 */
function digHoles(solution, target) {
  const puzzle = [...solution];
  const order = shuffle([...Array(81).keys()]);
  let givens = 81;

  for (const index of order) {
    if (givens <= target) break;
    const backup = puzzle[index];
    puzzle[index] = 0;

    const { solutions } = solve([...puzzle], 2);
    if (solutions !== 1) {
      puzzle[index] = backup; // reintroducem cifra daca solutia nu mai e unica
    } else {
      givens--;
    }
  }

  return puzzle;
}

// ---------- generare ----------

const puzzles = [];
let id = 1;

for (const [difficulty, { givens, count }] of Object.entries(LEVELS)) {
  let lastLog = Date.now();
  for (let i = 0; i < count; i++) {
    const solution = generateSolved();
    const puzzle = digHoles(solution, givens);

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
  console.log(`OK ${difficulty}: ${count} puzzle-uri`);
}

const outPath = resolve(__dirname, "../src/data/puzzles.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(puzzles));

console.log(`\nScris ${puzzles.length} puzzle-uri in ${outPath}`);
console.log(`Dimensiune fisier: ${(JSON.stringify(puzzles).length / 1024).toFixed(1)} KB`);
