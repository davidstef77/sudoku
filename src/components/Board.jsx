/**
 * Tabla de Sudoku 9x9, desenata ca 9 blocuri de 3x3 (separare vizuala clara).
 * Evidentiaza celula selectata, randul/coloana/blocul, cifrele identice
 * si conflictele.
 */

import { memo } from "react";
import { colOf, rowOf } from "../lib/sudoku.js";

/** Clasele unei celule, in functie de context. */
function cellClasses(index, state) {
  const { selected, values, givens, conflicts } = state;

  const isSelected = selected === index;
  const sameUnit =
    selected !== null &&
    !isSelected &&
    (rowOf(selected) === rowOf(index) || colOf(selected) === colOf(index));
  const sameBox =
    selected !== null &&
    !isSelected &&
    Math.floor(rowOf(selected) / 3) === Math.floor(rowOf(index) / 3) &&
    Math.floor(colOf(selected) / 3) === Math.floor(colOf(index) / 3);

  const sameValue =
    selected !== null &&
    values[selected] !== 0 &&
    values[selected] === values[index];

  const bg = isSelected
    ? "bg-accent/35"
    : sameValue
    ? "bg-accent/20"
    : sameUnit || sameBox
    ? "bg-white/[0.06]"
    : "bg-cell/70";

  const text = conflicts.has(index)
    ? "text-rose"
    : givens[index]
    ? "text-slate-100"
    : "text-accentSoft";

  return `cell h-[clamp(32px,8.6vw,50px)] w-[clamp(32px,8.6vw,50px)] ${bg} ${text} ${
    isSelected ? "" : "hover:bg-cellAlt"
  }`;
}

function Cell({ index, state, onSelect }) {
  const value = state.values[index];
  const note = state.notes[index];

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className={cellClasses(index, state)}
      aria-label={`Celula randul ${rowOf(index) + 1}, coloana ${colOf(index) + 1}`}
    >
      {value ? (
        <span className="animate-pop">{value}</span>
      ) : note ? (
        <span className="grid h-full w-full grid-cols-3 grid-rows-3 text-[clamp(0.4rem,1.3vw,0.58rem)] leading-none text-muted">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <span key={digit} className="flex items-center justify-center">
              {note.includes(String(digit)) ? digit : ""}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

function Board({ values, givens, notes, conflicts, selected, onSelect }) {
  const state = { values, givens, notes, conflicts, selected };

  return (
    <div className="rounded-2xl border border-white/10 bg-panel p-2 shadow-card">
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }, (_, block) => {
          const blockRow = Math.floor(block / 3);
          const blockCol = block % 3;

          return (
            <div
              key={block}
              className="grid grid-cols-3 gap-px overflow-hidden rounded-lg ring-1 ring-inset ring-white/10"
            >
              {Array.from({ length: 9 }, (_, cellInBlock) => {
                const row = blockRow * 3 + Math.floor(cellInBlock / 3);
                const col = blockCol * 3 + (cellInBlock % 3);
                const index = row * 9 + col;

                return (
                  <Cell key={index} index={index} state={state} onSelect={onSelect} />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(Board);
