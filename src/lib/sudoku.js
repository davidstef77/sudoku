/**
 * Functii pure pentru Sudoku (9x9).
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

/** Toti indicii din acelasi rand, coloana sau bloc (fara celula insasi). */
export function peersOf(index) {
  const row = rowOf(index);
  const col = colOf(index);
  const peers = new Set();

  for (let i = 0; i < SIZE; i++) {
    peers.add(row * SIZE + i);
    peers.add(i * SIZE + col);
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      peers.add((boxRow + r) * SIZE + boxCol + c);
    }
  }

  peers.delete(index);
  return [...peers];
}

/**
 * Celulele care se bat (au aceeasi cifra pe rand / coloana / bloc).
 * Returneaza un Set de indici.
 */
export function findConflicts(board) {
  const conflicts = new Set();

  for (let index = 0; index < CELLS; index++) {
    const value = board[index];
    if (!value) continue;

    for (const peer of peersOf(index)) {
      if (board[peer] === value) {
        conflicts.add(index);
        conflicts.add(peer);
      }
    }
  }

  return conflicts;
}

/** Toate cifrele valide pentru o celula goala. */
export function candidatesFor(board, index) {
  if (board[index]) return [];

  const used = new Set();
  for (const peer of peersOf(index)) {
    if (board[peer]) used.add(board[peer]);
  }
  return DIGITS.filter((digit) => !used.has(digit));
}

/** True daca tabla este completata corect. */
export function isSolved(board, solution) {
  if (solution) {
    return board.every((value, index) => value === Number(solution[index]));
  }
  return board.every(Boolean) && findConflicts(board).size === 0;
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

/** Formatare mm:ss. */
export function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export const DIFFICULTIES = {
  easy: { label: "Usor", color: "text-white", dot: "bg-white" },
  medium: { label: "Mediu", color: "text-accentSoft", dot: "bg-accentSoft" },
  hard: { label: "Greu", color: "text-muted", dot: "bg-muted" },
};
