/**
 * Motorul jocului: stare, mutari, note (creion), undo, hint-uri si timer.
 * Persistarea in AsyncStorage se face din GameScreen cu ajutorul acestui hook.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CELLS,
  findConflicts,
  isSolved,
  parseBoard,
} from "../lib/sudoku.js";

const MAX_HISTORY = 200;

/** Notele se tin ca string-uri ("135") ca sa fie usor de salvat. */
const emptyNotes = () => Array.from({ length: CELLS }, () => "");

/**
 * @param {object} puzzle  intrarea din puzzles.json
 * @param {object|null} saved  progresul salvat anterior
 */
export function useSudoku(puzzle, saved) {
  const givens = useMemo(() => parseBoard(puzzle.puzzle), [puzzle.puzzle]);
  const solution = useMemo(() => parseBoard(puzzle.solution), [puzzle.solution]);

  // Valorile pornesc din progresul salvat sau din cifrele initiale.
  const [values, setValues] = useState(() =>
    saved?.values?.length === CELLS ? saved.values : givens
  );
  const [notes, setNotes] = useState(() =>
    saved?.notes?.length === CELLS ? saved.notes : emptyNotes()
  );
  const [selected, setSelected] = useState(null);
  const [noteMode, setNoteMode] = useState(false);
  // Cifra evidentiata pe tabla (apasata din tastatura / numpad sau din celula selectata).
  const [highlightDigit, setHighlightDigit] = useState(null);
  const [mistakes, setMistakes] = useState(saved?.mistakes ?? 0);
  const [hintsUsed, setHintsUsed] = useState(saved?.hintsUsed ?? 0);
  const [elapsed, setElapsed] = useState(saved?.elapsed ?? 0);
  const [completed, setCompleted] = useState(Boolean(saved?.completed));

  const history = useRef([]);

  // Cronometrul merge doar cat timp puzzle-ul nu e terminat.
  useEffect(() => {
    if (completed) return undefined;
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [completed]);

  const conflicts = useMemo(() => findConflicts(values), [values]);

  // Detectam terminarea jocului.
  useEffect(() => {
    if (!completed && isSolved(values, puzzle.solution)) {
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

      // Orice cifra apasata devine cifra evidentiata pe toata tabla.
      setHighlightDigit(digit);

      if (noteMode) {
        const current = notes[selected] ?? "";
        const has = current.includes(String(digit));
        const next = has
          ? current.replace(String(digit), "")
          : [...current, String(digit)].sort().join("");

        pushHistory(values, notes);
        setNotes((prev) => prev.map((value, i) => (i === selected ? next : value)));
        return;
      }

      pushHistory(values, notes);

      // Daca aceeasi cifra e deja acolo, o stergem (toggle).
      const nextValue = values[selected] === digit ? 0 : digit;
      setValues((prev) => prev.map((value, i) => (i === selected ? nextValue : value)));

      // Notele celulelor vecine se curata cand punem o cifra corecta.
      if (nextValue && nextValue === solution[selected]) {
        setNotes((prev) => {
          const copy = [...prev];
          for (let i = 0; i < CELLS; i++) {
            if (copy[i].includes(String(nextValue))) {
              copy[i] = copy[i].replace(String(nextValue), "");
            }
          }
          copy[selected] = "";
          return copy;
        });
      }

      if (nextValue && nextValue !== solution[selected]) {
        setMistakes((count) => count + 1);
      }
    },
    [selected, completed, givens, noteMode, notes, values, solution, pushHistory]
  );

  /** Sterge continutul celulei selectate. */
  const eraseCell = useCallback(() => {
    if (selected === null || completed || givens[selected]) return;
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
    setValues(previous.values);
    setNotes(previous.notes);
  }, [completed]);

  /** Reset complet la starea initiala a puzzle-ului. */
  const restart = useCallback(() => {
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
