/**
 * Teste pentru functiile pure de Sudoku (src/lib/sudoku.js).
 * Rulare: npm test
 */

import { describe, expect, it } from "vitest";
import {
  CELLS,
  DIGITS,
  blockedDigitsFor,
  boxIndices,
  boxOf,
  candidatesFor,
  colIndices,
  colOf,
  countCorrect,
  countSolutions,
  findConflicts,
  formatTime,
  isValidPlacement,
  isSolved,
  parseBoard,
  peersOf,
  rowIndices,
  rowOf,
  solveBoard,
} from "./sudoku.js";

// O tabela rezolvata corect (prima linie a solutiei celebre de pe Wikipedia).
const SOLVED = [
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
].join("");

const EMPTY = "0".repeat(81);

/** Un mini-puzzle valid construit din SOLVED (scoatem cateva cifre). */
function makePuzzle(text, removeCount) {
  const board = [...text];
  let removed = 0;
  for (let i = 0; i < CELLS && removed < removeCount; i += 7) {
    if (board[i] !== ".") {
      board[i] = ".";
      removed++;
    }
  }
  return board.join("");
}

describe("parseBoard", () => {
  it("parseaza cifre si puncte", () => {
    const board = parseBoard("1.3");
    expect(board).toEqual([1, 0, 3]);
  });

  it("parseaza '0' ca celula goala", () => {
    expect(parseBoard("0")).toEqual([0]);
  });

  it("returneaza exact 81 de celule", () => {
    expect(parseBoard(SOLVED)).toHaveLength(CELLS);
  });
});

describe("indexi rand / coloana / bloc", () => {
  it("rowOf / colOf / boxOf", () => {
    expect(rowOf(40)).toBe(4);
    expect(colOf(40)).toBe(4);
    expect(boxOf(40)).toBe(4); // centru
    expect(boxOf(0)).toBe(0); // stanga-sus
    expect(boxOf(80)).toBe(8); // dreapta-jos
  });

  it("randurile au exact 9 indici corecti", () => {
    expect(rowIndices(0)[0]).toBe(0);
    expect(rowIndices(0)[8]).toBe(8);
    expect(rowIndices(8)[0]).toBe(72);
  });

  it("coloanele au exact 9 indici corecti", () => {
    expect(colIndices(0)[0]).toBe(0);
    expect(colIndices(0)[8]).toBe(72);
  });

  it("blocurile au exact 9 indici corecti", () => {
    expect(boxIndices(0)[0]).toBe(0);
    expect(boxIndices(0)[8]).toBe(20);
    expect(boxIndices(8)[8]).toBe(80);
  });

  it("peersOf returneaza 20 de vecini unici", () => {
    expect(peersOf(40)).toHaveLength(20);
    expect(new Set(peersOf(40)).size).toBe(20);
    expect(peersOf(40)).not.toContain(40);
  });
});

describe("isValidPlacement / blockedDigitsFor / candidatesFor", () => {
  const board = parseBoard(SOLVED.replace("5", ".", 1).replace("3", ".", 1));
  // board[0] era 5, board[1] era 3 — am sters ambele.

  it("accepta cifra corecta din solutie", () => {
    expect(isValidPlacement(board, 0, 5)).toBe(true);
  });

  it("respinga cifra care se repeta pe acelasi rand", () => {
    // 5 exista deja in blocul 1 (celula 10 are 7, dar randul 1 are 6,7,8,9,2,1,4...)
    // Verificam direct: cifra 6 este pe randul 0 la index 3.
    expect(isValidPlacement(board, 0, 6)).toBe(false);
  });

  it("blockedDigitsFor exclude cifrele din rand/coloana/bloc", () => {
    const blocked = blockedDigitsFor(board, 0);
    expect(blocked.has(5)).toBe(false); // celula goala, 5 nu mai e nicieri conflictual?
    // 6 e pe acelasi rand (index 3), deci trebuie blocat:
    expect(blocked.has(6)).toBe(true);
  });

  it("candidatesFor ofera exact cifrele valide", () => {
    const candidates = candidatesFor(board, 0);
    expect(candidates).toContain(5);
    expect(candidates).not.toContain(6);
    for (const digit of DIGITS) {
      expect(candidates.includes(digit)).toBe(isValidPlacement(board, 0, digit));
    }
  });

  it("respinga valori in afara intervalului 1-9", () => {
    expect(isValidPlacement(board, 0, 0)).toBe(false);
    expect(isValidPlacement(board, 0, 10)).toBe(false);
    expect(isValidPlacement(board, 0, NaN)).toBe(false);
  });
});

describe("findConflicts", () => {
  it("tabla rezolvata corect nu are conflicte", () => {
    expect(findConflicts(parseBoard(SOLVED)).size).toBe(0);
  });

  it("dubleaza conflictul pe acelasi rand", () => {
    // Doua "5" pe primul rand: indici 0 si 5 (randul 0, coloanele 0 si 5).
    const bad = parseBoard(SOLVED);
    bad[5] = 5;
    const conflicts = findConflicts(bad);
    expect(conflicts.has(0)).toBe(true);
    expect(conflicts.has(5)).toBe(true);
  });
});

describe("isSolved / countCorrect", () => {
  it("tabla completa corecta e rezolvata", () => {
    expect(isSolved(parseBoard(SOLVED), SOLVED)).toBe(true);
  });

  it("tabla incompleta nu e rezolvata", () => {
    const incomplete = parseBoard(SOLVED);
    incomplete[0] = 0;
    expect(isSolved(incomplete, SOLVED)).toBe(false);
  });

  it("tabla completa dar greșita nu e rezolvata", () => {
    const wrong = parseBoard(SOLVED);
    wrong[0] = 9; // corect era 5 — dar 9 mai apare pe rand? schimbam intr-o cifra safe:
    wrong[0] = wrong[1]; // dublura garantata
    expect(isSolved(wrong, SOLVED)).toBe(false);
  });

  it("countCorrect numara celulele potrivite cu solutia", () => {
    const board = parseBoard(SOLVED);
    board[0] = 0;
    expect(countCorrect(board, SOLVED)).toBe(80);
  });
});

describe("solveBoard / countSolutions", () => {
  it("rezolva un puzzle valid", () => {
    const puzzle = makePuzzle(SOLVED, 30);
    const solution = solveBoard(parseBoard(puzzle));
    expect(solution).not.toBeNull();
    // Solutia gasita trebuie sa fie valida.
    expect(isSolved(solution, null)).toBe(true);
  });

  it("puzzle-ul complet are exact o solutie", () => {
    const { solutions } = countSolutions(parseBoard(SOLVED), 2);
    expect(solutions).toBe(1);
  });

  it("tabla goala are mai multe solutii (limita 2)", () => {
    const { solutions } = countSolutions(parseBoard(EMPTY), 2);
    expect(solutions).toBe(2);
  });

  it("tabla fara solutie returneaza null", () => {
    // Randul 0: doua cifre identice.
    const bad = parseBoard(EMPTY);
    bad[0] = 5;
    bad[8] = 5;
    expect(solveBoard(bad)).toBeNull();
  });
});

describe("formatTime", () => {
  it("formateaza corect minute si secunde", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(59)).toBe("00:59");
    expect(formatTime(60)).toBe("01:00");
    expect(formatTime(754)).toBe("12:34");
  });

  it("nu accepta valori negative", () => {
    expect(formatTime(-5)).toBe("00:00");
  });
});
