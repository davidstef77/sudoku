/**
 * Tabla de Sudoku 9x9, desenata ca 9 blocuri de 3x3.
 * Celulele folosesc aspect-square si latime fluida, asa ca tabla
 * se micsoreaza singura pe telefoane si tablete.
 */

import { memo } from "react";
import { DIGITS, colOf, rowOf } from "../lib/sudoku.js";

/** Clasele unei celule, in functie de context. */
function cellClasses(index, state) {
  const { selected, values, givens, conflicts } = state;
  const isSelected = selected === index;
  const value = values[index];

  const sameRowCol =
    selected !== null &&
    !isSelected &&
    (rowOf(selected) === rowOf(index) || colOf(selected) === colOf(index));

  const sameBox =
    selected !== null &&
    !isSelected &&
    Math.floor(rowOf(selected) / 3) === Math.floor(rowOf(index) / 3) &&
    Math.floor(colOf(selected) / 3) === Math.floor(colOf(index) / 3);

  const sameValue = selected !== null && value !== 0 && value === values[selected];

  let bg = "bg-cell/80";
  if (isSelected) bg = "bg-accent/40";
  else if (sameValue) bg = "bg-accent/25";
  else if (sameRowCol || sameBox) bg = "bg-cellAlt/90";

  const text = conflicts.has(index)
    ? "text-rose"
    : givens[index]
    ? "text-slate-50"
    : "text-accentSoft";

  return [
    "relative flex aspect-square w-full select-none items-center justify-center rounded-[5px]",
    "font-semibold tabular-nums transition-colors duration-100",
    bg,
    text,
    isSelected ? "ring-2 ring-inset ring-white/70" : "hover:bg-cellAlt",
  ].join(" ");
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
        <span className="animate-pop font-mono font-bold text-[clamp(1.05rem,5.8vw,1.7rem)] leading-none">
          {value}
        </span>
      ) : note ? (
        <span className="grid h-full w-full grid-cols-3 grid-rows-3 p-[3px]">
          {DIGITS.map((digit) => (
            <span
              key={digit}
              className="flex items-center justify-center text-[clamp(0.4rem,1.6vw,0.6rem)] leading-none text-muted"
            >
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
    <div className="w-full max-w-[500px] rounded-2xl border border-white/10 bg-panel/90 p-1.5 shadow-card sm:p-3">
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
