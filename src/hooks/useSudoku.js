/**
 * Motorul jocului: stare, mutari, note (creion), undo, hint-uri si timer.
 *
 * Logica respecta regulile Sudoku si cerintele de validare stricta:
 *   - cifrele initiale (indicii) sunt fixe si nu pot fi modificate;
 *   - o cifra introdusa este validata instantaneu fata de solutia ascunsa:
 *     daca nu corespunde solutiei sau incalca regulile de rand / coloana /
 *     bloc 3x3, cifra NU este scrisa, celula ramane goala si se incrementeaza
 *     contorul de greseli;
 *   - la atingerea limitei de greseli (configurabila: 0 = nelimitat,
 *     3 sau 5) jocul se reseteaza automat;
 *   - timerul se opreste automat cand tab-ul este ascuns (document.hidden),
 *     ca sa nu curga timp care nu a fost jucat;
 *   - puzzle-ul este considerat rezolvat doar cand toate cele 81 de celule
 *     sunt completate corect, fara conflicte si conform solutiei.
 *
 * Persistarea in AsyncStorage se face din GameScreen cu ajutorul acestui hook.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CELLS,
  findConflicts,
  isSolved,
  isValidPlacement,
  parseBoard,
} from "../lib/sudoku.js";
import haptics from "../lib/haptics.js";
import { sounds } from "../lib/sound.js";

const MAX_HISTORY = 200;
const DEFAULT_MISTAKES_LIMIT = 5;

/** Notele se tin ca string-uri ("135") ca sa fie usor de salvat. */
const emptyNotes = () => Array.from({ length: CELLS }, () => "");

/**
 * Construieste tabla de start dintr-un progres salvat, respectand regulile:
 *   - celulele cu indicii initiale raman mereu valorile din puzzle;
 *   - din valorile salvate se pastreaza doar cele corecte (egale cu solutia)
 *     si care nu se repeta pe rand / coloana / bloc; un progres vechi sau
 *     corupt nu poate strica tabla.
 */
function sanitizeValues(savedValues, givens, solution) {
  const clean = [...givens];

  if (!Array.isArray(savedValues) || savedValues.length !== CELLS) {
    return clean;
  }

  for (let index = 0; index < CELLS; index++) {
    if (givens[index]) continue; // indiciile sunt fixe

    const value = savedValues[index];
    if (
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 9 &&
      value === solution[index] &&
      isValidPlacement(clean, index, value)
    ) {
      clean[index] = value;
    }
  }

  return clean;
}

/**
 * @param {object} puzzle  intrarea din puzzles.json
 * @param {object|null} saved  progresul salvat anterior
 * @param {object} options  { mistakesLimit: 0|3|5 } — 0 inseamna nelimitat
 */
export function useSudoku(puzzle, saved, options = {}) {
  const mistakesLimit =
    [0, 3, 5].includes(options.mistakesLimit) ? options.mistakesLimit : DEFAULT_MISTAKES_LIMIT;

  const givens = useMemo(() => parseBoard(puzzle.puzzle), [puzzle.puzzle]);
  const solution = useMemo(() => parseBoard(puzzle.solution), [puzzle.solution]);

  // Valorile pornesc din progresul salvat (igienizat) sau din cifrele initiale.
  const [values, setValues] = useState(() =>
    sanitizeValues(saved?.values, givens, solution)
  );
  const [notes, setNotes] = useState(() =>
    saved?.notes?.length === CELLS ? saved.notes : emptyNotes()
  );
  const [selected, setSelected] = useState(null);
  const [noteMode, setNoteMode] = useState(false);
  // Cifra evidentiata pe tastatura (apasata din tastatura / numpad sau din celula selectata).
  const [highlightDigit, setHighlightDigit] = useState(null);
  const [mistakes, setMistakes] = useState(saved?.mistakes ?? 0);
  const [hintsUsed, setHintsUsed] = useState(saved?.hintsUsed ?? 0);
  const [elapsed, setElapsed] = useState(saved?.elapsed ?? 0);
  const [completed, setCompleted] = useState(Boolean(saved?.completed));

  const history = useRef([]);

  // Cronometrul merge doar cat timp puzzle-ul nu e terminat SI tab-ul e vizibil.
  useEffect(() => {
    if (completed) return undefined;

    const id = window.setInterval(() => {
      // Pauza automata: tab-ul ascuns nu conteaza timp jucat.
      if (typeof document !== "undefined" && document.hidden) return;
      setElapsed((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, [completed]);

  const conflicts = useMemo(() => findConflicts(values), [values]);

  // Detectam terminarea jocului.
  useEffect(() => {
    if (!completed && isSolved(values, puzzle.solution)) {
      sounds.complete();
      haptics.complete();
      setCompleted(true);
    }
  }, [values, completed, puzzle.solution]);

  const pushHistory = useCallback((nextValues, nextNotes) => {
    history.current.push({ values: nextValues, notes: nextNotes });
    if (history.current.length > MAX_HISTORY) history.current.shift();
  }, []);

  /** Selecteaza o celula si evidentiaza cifra din ea (daca exista). */
  const selectCell = useCallback(
    (index) => {
      sounds.select();
      haptics.tick();
      setSelected(index);
      const value = values[index];
      setHighlightDigit(value !== 0 ? value : null);
    },
    [values]
  );

  /** Scrie o cifra in celula selectata (sau o noteaza, in modul creion). */
  const inputDigit = useCallback(
    (digit) => {
      if (selected === null || completed) return;
      if (givens[selected]) return; // cifrele initiale nu se pot schimba

      // Orice cifra apasata devine cifra evidentiata pe tastatura.
      setHighlightDigit(digit);

      if (noteMode) {
        const current = notes[selected] ?? "";
        const has = current.includes(String(digit));
        const next = has
          ? current.replace(String(digit), "")
          : [...current, String(digit)].sort().join("");

        sounds.note();
        haptics.tick();
        pushHistory(values, notes);
        setNotes((prev) => prev.map((value, i) => (i === selected ? next : value)));
        return;
      }

      // Daca aceeasi cifra e deja acolo, o stergem (toggle) — fara penalizare.
      const nextValue = values[selected] === digit ? 0 : digit;
      if (nextValue === 0) {
        sounds.erase();
        pushHistory(values, notes);
        setValues((prev) => prev.map((value, i) => (i === selected ? 0 : value)));
        return;
      }

      // Validare stricta (hard validation) fata de solutia ascunsa:
      // o cifra gresita — fie ca nu corespunde solutiei, fie ca incalca
      // regulile de rand / coloana / bloc — NU este scrisa in celula.
      const violatesRules = !isValidPlacement(values, selected, digit);
      const wrongForSolution = digit !== solution[selected];

      if (violatesRules || wrongForSolution) {
        sounds.wrong();
        haptics.wrong();
        setMistakes((count) => count + 1);
        return;
      }

      sounds.correct();
      haptics.light();
      pushHistory(values, notes);
      setValues((prev) => prev.map((value, i) => (i === selected ? digit : value)));

      // Notele celulelor vecine se curata cand punem o cifra corecta.
      setNotes((prev) => {
        const copy = [...prev];
        for (let i = 0; i < CELLS; i++) {
          if (copy[i].includes(String(digit))) {
            copy[i] = copy[i].replace(String(digit), "");
          }
        }
        copy[selected] = "";
        return copy;
      });
    },
    [selected, completed, givens, noteMode, notes, values, solution, pushHistory]
  );

  /** Sterge continutul celulei selectate. */
  const eraseCell = useCallback(() => {
    if (selected === null || completed || givens[selected]) return;
    sounds.erase();
    pushHistory(values, notes);
    setValues((prev) => prev.map((value, i) => (i === selected ? 0 : value)));
    setNotes((prev) => prev.map((value, i) => (i === selected ? "" : value)));
    setHighlightDigit(null);
  }, [selected, completed, givens, values, notes, pushHistory]);

  /** Umple o celula goala cu valoarea corecta (cea selectata, daca e goala). */
  const useHint = useCallback(() => {
    if (completed) return;

    // Celula selectata conteaza doar daca e goala si editabila;
    // altfel trecem la urmatoarea celula libera.
    const selectedIsUsable =
      selected !== null && !givens[selected] && !values[selected];
    const target = selectedIsUsable ? selected : firstEmpty(values, givens);
    if (target === -1) return;

    sounds.hint();
    pushHistory(values, notes);
    setValues((prev) => prev.map((value, i) => (i === target ? solution[target] : value)));
    setNotes((prev) => prev.map((value, i) => (i === target ? "" : value)));
    setHintsUsed((count) => count + 1);
    setSelected(target);
    setHighlightDigit(solution[target]);
  }, [completed, selected, givens, values, notes, solution, pushHistory]);

  /** Anuleaza ultima mutare. */
  const undo = useCallback(() => {
    const previous = history.current.pop();
    if (!previous || completed) return;
    sounds.undo();
    setValues(previous.values);
    setNotes(previous.notes);
  }, [completed]);

  /** Reset complet la starea initiala a puzzle-ului. */
  const restart = useCallback(() => {
    sounds.reset();
    history.current = [];
    setValues(givens);
    setNotes(emptyNotes());
    setMistakes(0);
    setHintsUsed(0);
    setElapsed(0);
    setCompleted(false);
    setSelected(null);
    setHighlightDigit(null);
  }, [givens]);

  // La atingerea limitei de greseli jocul se reia automat de la zero.
  // mistakesLimit = 0 inseamna "nelimitat" — fara reset.
  useEffect(() => {
    if (mistakesLimit > 0 && mistakes >= mistakesLimit) {
      sounds.wrong();
      haptics.wrong();
      restart();
    }
  }, [mistakes, mistakesLimit, restart]);

  /** Mutare cu tastatura (sageti). */
  const moveSelection = useCallback(
    (deltaRow, deltaCol) => {
      const current = selected ?? 0;
      const row = Math.min(8, Math.max(0, Math.floor(current / 9) + deltaRow));
      const col = Math.min(8, Math.max(0, (current % 9) + deltaCol));
      const next = row * 9 + col;
      setSelected(next);
      setHighlightDigit(values[next] !== 0 ? values[next] : null);
    },
    [selected, values]
  );

  return {
    givens,
    solution,
    values,
    notes,
    selected,
    setSelected,
    selectCell,
    highlightDigit,
    noteMode,
    setNoteMode,
    conflicts,
    mistakes,
    mistakesLimit,
    hintsUsed,
    elapsed,
    completed,
    inputDigit,
    eraseCell,
    useHint,
    undo,
    restart,
    moveSelection,
    // informatii pentru UI
    remaining: values.filter((value, i) => !value && !givens[i]).length,
    correct: values.reduce(
      (total, value, i) => (value === solution[i] ? total + 1 : total),
      0
    ),
  };
}

/** Prima celula goala care nu e cifra initiala. */
function firstEmpty(values, givens) {
  for (let i = 0; i < CELLS; i++) {
    if (!values[i] && !givens[i]) return i;
  }
  return -1;
}
