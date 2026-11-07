/**
 * Functii pure pentru Sudoku (9x9).
 *
 * Toata logica de aici respecta regulile jocului:
 *   - pe fiecare rand cifrele 1-9 apar o singura data;
 *   - pe fiecare coloana cifrele 1-9 apar o singura data;
 *   - in fiecare bloc 3x3 cifrele 1-9 apar o singura data.
 *
 * O cifra poate fi plasata intr-o celula doar daca nu se repeta deja
 * in acelasi rand, coloana sau bloc (regula fundamentala).
 *
 * Tabla este un array de 81 de numere, 0 = celula goala.
 */

export const SIZE = 9;
export const CELLS = 81;
export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Transforma string-ul de 81 de caractere intr-un array de numere. */
export function parseBoard(text) {
  return [...text].map((ch) => (ch === "." || ch === "0" ? 0 : Number(ch)));
}

/** Indexul randului / coloanei / blocului 3x3 pentru o celula. */
export const rowOf = (index) => Math.floor(index / SIZE);
export const colOf = (index) => index % SIZE;
export const boxOf = (index) =>
  Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3);

/** Cei 9 indici ai unui rand. */
export function rowIndices(row) {
  const indices = [];
  for (let c = 0; c < SIZE; c++) indices.push(row * SIZE + c);
  return indices;
}

/** Cei 9 indici ai unei coloane. */
export function colIndices(col) {
  const indices = [];
  for (let r = 0; r < SIZE; r++) indices.push(r * SIZE + col);
  return indices;
}

/** Cei 9 indici ai unui bloc 3x3 (box = 0..8). */
export function boxIndices(box) {
  const startRow = Math.floor(box / 3) * 3;
  const startCol = (box % 3) * 3;
  const indices = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      indices.push((startRow + r) * SIZE + startCol + c);
    }
  }
  return indices;
}

/**
 * Toate cele 27 de unitati Sudoku: 9 randuri, 9 coloane, 9 blocuri.
 * unit = 0..8 randuri, 9..17 coloane, 18..26 blocuri.
 */
export function unitIndices(unit) {
  if (unit < 9) return rowIndices(unit);
  if (unit < 18) return colIndices(unit - 9);
  return boxIndices(unit - 18);
}

/** Toti indicii din acelasi rand, coloana sau bloc (fara celula insasi). */
export function peersOf(index) {
  const peers = new Set();

  for (const peer of rowIndices(rowOf(index))) peers.add(peer);
  for (const peer of colIndices(colOf(index))) peers.add(peer);
  for (const peer of boxIndices(boxOf(index))) peers.add(peer);

  peers.delete(index);
  return [...peers];
}

/**
 * True daca cifra `digit` poate fi pusa in `index` fara sa incalce
 * regulile (nu apare deja pe rand / coloana / bloc).
 * Daca celula are deja aceeasi cifra, plasarea este permisa (toggle).
 */
export function isValidPlacement(board, index, digit) {
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return false;
  if (board[index] === digit) return true;

  for (const peer of peersOf(index)) {
    if (board[peer] === digit) return false;
  }
  return true;
}

/**
 * Cifrele care NU pot fi puse in celula `index`, pentru ca apar deja
 * pe acelasi rand, coloana sau bloc. Returneaza un Set.
 */
export function blockedDigitsFor(board, index) {
  const blocked = new Set();
  for (const peer of peersOf(index)) {
    const value = board[peer];
    if (value) blocked.add(value);
  }
  return blocked;
}

/**
 * Celulele care se bat (au aceeasi cifra pe rand / coloana / bloc).
 * Returneaza un Set de indici. Pe o tabla corecta, Set-ul este gol.
 */
export function findConflicts(board) {
  const conflicts = new Set();

  for (let unit = 0; unit < 27; unit++) {
    const seen = new Map();

    for (const index of unitIndices(unit)) {
      const value = board[index];
      if (!value) continue;

      if (seen.has(value)) {
        conflicts.add(seen.get(value));
        conflicts.add(index);
      } else {
        seen.set(value, index);
      }
    }
  }

  return conflicts;
}

/** Toate cifrele valide pentru o celula goala (respecta regulile). */
export function candidatesFor(board, index) {
  if (board[index]) return [];
  return DIGITS.filter((digit) => isValidPlacement(board, index, digit));
}

/** True daca toate cele 81 de celule sunt completate. */
export function isComplete(board) {
  return board.every(Boolean);
}

/**
 * True daca tabla este completata corect.
 * Cu `solution` verificam si potrivirea cu solutia stocata;
 * fara `solution`, verificam doar regulile (plina + fara conflicte).
 */
export function isSolved(board, solution) {
  if (!isComplete(board)) return false;
  if (solution) {
    return board.every((value, index) => value === Number(solution[index]));
  }
  return findConflicts(board).size === 0;
}

/** Cate cifre au fost puse corect (fata de solutie). */
export function countCorrect(board, solution) {
  if (!solution) return board.filter(Boolean).length;
  return board.reduce(
    (total, value, index) => (value === Number(solution[index]) ? total + 1 : total),
    0
  );
}

/** Prima celula goala, sau -1. */
export function firstEmpty(board, from = 0) {
  for (let i = from; i < CELLS; i++) if (!board[i]) return i;
  return -1;
}

// ---------------------------------------------------------------------------
// Solver cu backtracking + MRV (celula cu cele mai putine candidat).
// Foloseste exclusiv regulile jocului (rand / coloana / bloc).
// ---------------------------------------------------------------------------

const ALL_BITS = 0b1111111110; // bitii 1..9
const bit = (v) => 1 << v;

/** Intoarce o solutie completa (array de 81) sau null daca nu exista. */
export function solveBoard(board) {
  const work = [...board];
  if (findConflicts(work).size > 0) return null;

  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);

  for (let i = 0; i < CELLS; i++) {
    const v = work[i];
    if (!v) continue;
    const r = rowOf(i);
    const c = colOf(i);
    const b = boxOf(i);
    rows[r] |= bit(v);
    cols[c] |= bit(v);
    boxes[b] |= bit(v);
  }

  function search() {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;

    for (let i = 0; i < CELLS; i++) {
      if (work[i]) continue;
      const r = rowOf(i);
      const c = colOf(i);
      const b = boxOf(i);
      const mask = ALL_BITS & ~(rows[r] | cols[c] | boxes[b]);

      let count = 0;
      for (let v = 1; v <= 9; v++) if (mask & bit(v)) count++;
      if (count === 0) return false;
      if (count < bestCount) {
        bestCount = count;
        best = i;
        bestMask = mask;
        if (count === 1) break;
      }
    }

    if (best === -1) return true; // toate celulele sunt pline

    const r = rowOf(best);
    const c = colOf(best);
    const b = boxOf(best);

    for (let v = 1; v <= 9; v++) {
      if (!(bestMask & bit(v))) continue;

      work[best] = v;
      rows[r] |= bit(v);
      cols[c] |= bit(v);
      boxes[b] |= bit(v);

      if (search()) return true;

      work[best] = 0;
      rows[r] &= ~bit(v);
      cols[c] &= ~bit(v);
      boxes[b] &= ~bit(v);
    }

    return false;
  }

  return search() ? work : null;
}

/** Numara solutiile (pana la `limit`) si returneaza prima solutie gasita. */
export function countSolutions(board, limit = 2) {
  const work = [...board];
  if (findConflicts(work).size > 0) return { solutions: 0, solution: null };

  const rows = new Array(9).fill(0);
  const cols = new Array(9).fill(0);
  const boxes = new Array(9).fill(0);

  for (let i = 0; i < CELLS; i++) {
    const v = work[i];
    if (!v) continue;
    const r = rowOf(i);
    const c = colOf(i);
    const b = boxOf(i);
    rows[r] |= bit(v);
    cols[c] |= bit(v);
    boxes[b] |= bit(v);
  }

  let solutions = 0;
  let first = null;

  function search() {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;

    for (let i = 0; i < CELLS; i++) {
      if (work[i]) continue;
      const r = rowOf(i);
      const c = colOf(i);
      const b = boxOf(i);
      const mask = ALL_BITS & ~(rows[r] | cols[c] | boxes[b]);

      let count = 0;
      for (let v = 1; v <= 9; v++) if (mask & bit(v)) count++;
      if (count === 0) return false;
      if (count < bestCount) {
        bestCount = count;
        best = i;
        bestMask = mask;
        if (count === 1) break;
      }
    }

    if (best === -1) {
      solutions++;
      if (solutions === 1) first = [...work];
      return solutions >= limit;
    }

    const r = rowOf(best);
    const c = colOf(best);
    const b = boxOf(best);

    for (let v = 1; v <= 9; v++) {
      if (!(bestMask & bit(v))) continue;

      work[best] = v;
      rows[r] |= bit(v);
      cols[c] |= bit(v);
      boxes[b] |= bit(v);

      if (search()) {
        work[best] = 0;
        rows[r] &= ~bit(v);
        cols[c] &= ~bit(v);
        boxes[b] &= ~bit(v);
        return true;
      }

      work[best] = 0;
      rows[r] &= ~bit(v);
      cols[c] &= ~bit(v);
      boxes[b] &= ~bit(v);
    }

    return false;
  }

  search();
  return { solutions, solution: first };
}

/** Formatare mm:ss. */
export function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Nivelurile, de la cel mai usor la cel mai greu. */
export const DIFFICULTY_ORDER = [
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
  "extreme",
];

export const DIFFICULTIES = {
  easy: { label: "Ușor", color: "text-white", dot: "bg-white", givens: 40 },
  medium: { label: "Mediu", color: "text-accentSoft", dot: "bg-accentSoft", givens: 33 },
  hard: { label: "Greu", color: "text-muted", dot: "bg-muted", givens: 28 },
  expert: { label: "Expert", color: "text-good", dot: "bg-good", givens: 25 },
  master: { label: "Maestru", color: "text-warn", dot: "bg-warn", givens: 23 },
  extreme: { label: "Extrem", color: "text-rose", dot: "bg-rose", givens: 21 },
};
